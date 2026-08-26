import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@mariozechner/pi-tui";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 50_000;
const MAX_OUTPUT_BYTES = 200_000;
const MAX_REDIRECTS = 5;
const MIN_USEFUL_CONTENT = 500;
const JINA_READER_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT_MS = 30000;

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
});

// ── Types ────────────────────────────────────────────────────────────

interface FetchResult {
	url: string;
	title: string;
	content: string;
	error: string | null;
	truncated?: boolean;
	originalChars?: number;
}

class ResponseTooLargeError extends Error {
	constructor(maxBytes: number) {
		super(`Response too large (limit ${Math.round(maxBytes / 1024 / 1024)}MB)`);
		this.name = "ResponseTooLargeError";
	}
}

function parseIPv4(address: string): number[] | null {
	const octets = address.split(".");
	if (octets.length !== 4) return null;
	const values = octets.map((octet) => {
		if (!/^\d{1,3}$/.test(octet)) return -1;
		return Number(octet);
	});
	return values.every((value) => value >= 0 && value <= 255) ? values : null;
}

function isNonPublicIPv4(address: string): boolean {
	const octets = parseIPv4(address);
	if (!octets) return true;
	const [a, b, c] = octets;

	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) || // shared address space
		(a === 169 && b === 254) || // link-local
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0) || // IETF protocol assignments
		(a === 192 && b === 2) || // TEST-NET-1
		(a === 192 && b === 88 && c === 99) || // 6to4 relay anycast
		(a === 192 && b === 168) ||
		(a === 198 && b >= 18 && b <= 19) || // benchmarking
		(a === 198 && b === 51 && c === 100) || // TEST-NET-2
		(a === 203 && b === 0 && c === 113) || // TEST-NET-3
		a >= 224 // multicast and reserved
	);
}

function parseIPv6(address: string): number[] | null {
	let normalized = address.toLowerCase();

	// Zone identifiers are not valid for public HTTP URLs. Fail closed if one
	// reaches this helper through a resolver or future call site.
	if (normalized.includes("%")) return null;

	if (normalized.includes(".")) {
		const separator = normalized.lastIndexOf(":");
		if (separator < 0) return null;
		const ipv4 = parseIPv4(normalized.slice(separator + 1));
		if (!ipv4) return null;
		const [a, b, c, d] = ipv4;
		normalized = `${normalized.slice(0, separator)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}

	const compressionIndex = normalized.indexOf("::");
	if (compressionIndex >= 0) {
		if (normalized.indexOf("::", compressionIndex + 2) >= 0) return null;
		const leftText = normalized.slice(0, compressionIndex);
		const rightText = normalized.slice(compressionIndex + 2);
		const left = leftText ? leftText.split(":") : [];
		const right = rightText ? rightText.split(":") : [];
		const parsePart = (part: string): number | null =>
			/^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : null;
		const leftValues = left.map(parsePart);
		const rightValues = right.map(parsePart);
		const zeroCount = 8 - left.length - right.length;
		if (zeroCount < 1 || leftValues.some((value) => value === null) || rightValues.some((value) => value === null)) {
			return null;
		}
		return [
			...leftValues as number[],
			...Array.from({ length: zeroCount }, () => 0),
			...rightValues as number[],
		];
	}

	const parts = normalized.split(":");
	if (parts.length !== 8) return null;
	const values = parts.map((part) => /^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : null);
	return values.every((value) => value !== null) ? values as number[] : null;
}

function matchesIPv6Prefix(words: number[], network: number[], prefixLength: number): boolean {
	let remaining = prefixLength;
	for (let i = 0; remaining > 0; i++) {
		const bits = Math.min(16, remaining);
		const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
		if ((words[i] & mask) !== ((network[i] ?? 0) & mask)) return false;
		remaining -= bits;
	}
	return true;
}

function isNonPublicIPv6(address: string): boolean {
	const words = parseIPv6(address);
	if (!words) return true;

	const firstFiveZero = words.slice(0, 5).every((word) => word === 0);
	if (firstFiveZero && words[5] === 0xffff) {
		const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
		return isNonPublicIPv4(ipv4);
	}

	// Deprecated IPv4-compatible IPv6 addresses are treated according to the
	// embedded IPv4 address rather than being allowed to bypass the policy.
	if (words.slice(0, 6).every((word) => word === 0)) {
		const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
		return isNonPublicIPv4(ipv4);
	}

	return (
		words.every((word) => word === 0) ||
		(words.slice(0, 7).every((word) => word === 0) && words[7] === 1) ||
		matchesIPv6Prefix(words, [0x0064, 0xff9b], 96) || // NAT64 well-known prefix
		matchesIPv6Prefix(words, [0x0100], 64) || // discard-only prefix
		matchesIPv6Prefix(words, [0x2001], 32) || // protocol assignments / Teredo
		matchesIPv6Prefix(words, [0x2001, 0x0001], 32) ||
		matchesIPv6Prefix(words, [0x2001, 0x0002], 48) || // benchmarking
		matchesIPv6Prefix(words, [0x2001, 0x0010], 28) || // ORCHID
		matchesIPv6Prefix(words, [0x2001, 0x0020], 28) || // ORCHIDv2
		matchesIPv6Prefix(words, [0x2001, 0x0db8], 32) || // documentation
		matchesIPv6Prefix(words, [0x3ffe], 16) || // 6bone
		matchesIPv6Prefix(words, [0x2002], 16) || // 6to4
		matchesIPv6Prefix(words, [0xfc00], 7) || // unique-local
		matchesIPv6Prefix(words, [0xfe80], 10) || // link-local
		matchesIPv6Prefix(words, [0xfec0], 10) || // deprecated site-local
		matchesIPv6Prefix(words, [0xff00], 8) // multicast
	);
}

function isNonPublicAddress(address: string): boolean {
	const normalized = address.replace(/^\[|\]$/g, "");
	const family = isIP(normalized);
	if (family === 4) return isNonPublicIPv4(normalized);
	if (family === 6) return isNonPublicIPv6(normalized);
	return true;
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error("Invalid URL");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Blocked URL: only http and https URLs are supported");
	}
	if (url.username || url.password) {
		throw new Error("Blocked URL: embedded credentials are not allowed");
	}

	const hostname = url.hostname.replace(/^\[|\]$/g, "");
	if (!hostname) throw new Error("Blocked URL: hostname is missing");

	if (isIP(hostname)) {
		if (isNonPublicAddress(hostname)) {
			throw new Error("Blocked URL: address is not public");
		}
		return url;
	}

	try {
		const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
		if (addresses.length === 0 || addresses.some(({ address }) => isNonPublicAddress(address))) {
			throw new Error("non-public address");
		}
	} catch {
		throw new Error(`Blocked URL: hostname does not resolve exclusively to public addresses`);
	}

	return url;
}

interface PublicFetchResponse {
	response: Response;
	url: string;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function discardResponseBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// The response is being discarded; cancellation failure is harmless.
	}
}

async function fetchPublic(
	url: string,
	init: RequestInit,
	signal?: AbortSignal,
): Promise<PublicFetchResponse> {
	let currentUrl = url;

	for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
		await assertPublicUrl(currentUrl);
		const response = await fetch(currentUrl, { ...init, redirect: "manual", signal });
		if (!REDIRECT_STATUSES.has(response.status)) {
			return { response, url: currentUrl };
		}

		const location = response.headers.get("location");
		if (!location) return { response, url: currentUrl };
		await discardResponseBody(response);
		if (redirectCount === MAX_REDIRECTS) {
			throw new Error(`Too many redirects (maximum ${MAX_REDIRECTS})`);
		}

		const nextUrl = new URL(location, currentUrl).toString();
		await assertPublicUrl(nextUrl);
		currentUrl = nextUrl;
	}

	throw new Error(`Too many redirects (maximum ${MAX_REDIRECTS})`);
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
	const contentLength = response.headers.get("content-length");
	if (contentLength) {
		const parsedLength = Number.parseInt(contentLength, 10);
		if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
			throw new ResponseTooLargeError(maxBytes);
		}
	}

	if (!response.body) {
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (bytes.byteLength > maxBytes) throw new ResponseTooLargeError(maxBytes);
		return bytes;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
			if (totalBytes > maxBytes - chunk.byteLength) {
				try {
					await reader.cancel();
				} catch {
					// Preserve the size-limit error.
				}
				throw new ResponseTooLargeError(maxBytes);
			}
			chunks.push(chunk);
			totalBytes += chunk.byteLength;
		}
	} finally {
		reader.releaseLock();
	}

	const result = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
	return new TextDecoder().decode(await readResponseBytes(response, maxBytes));
}

function truncateContent(content: string): { content: string; truncated: boolean } {
	const marker = "\n\n[Output truncated by web_fetch; use a more specific URL or retrieval tool for the remainder.]";
	if (content.length <= MAX_OUTPUT_CHARS && Buffer.byteLength(content, "utf8") <= MAX_OUTPUT_BYTES) {
		return { content, truncated: false };
	}

	const maxHeadChars = Math.max(0, MAX_OUTPUT_CHARS - marker.length);
	const maxHeadBytes = Math.max(0, MAX_OUTPUT_BYTES - Buffer.byteLength(marker, "utf8"));
	let low = 0;
	let high = Math.min(content.length, maxHeadChars);
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (Buffer.byteLength(content.slice(0, middle), "utf8") <= maxHeadBytes) low = middle;
		else high = middle - 1;
	}

	return {
		content: content.slice(0, low).trimEnd() + marker,
		truncated: true,
	};
}

function applyOutputLimit(result: FetchResult): FetchResult {
	if (result.error) return result;
	const limited = truncateContent(result.content);
	return {
		...result,
		content: limited.content,
		truncated: limited.truncated,
		originalChars: result.content.length,
	};
}

// ── PDF Extraction ───────────────────────────────────────────────────

function isPDF(url: string, contentType?: string): boolean {
	if (contentType?.includes("application/pdf")) return true;
	try {
		return new URL(url).pathname.toLowerCase().endsWith(".pdf");
	} catch {
		return false;
	}
}

async function extractPDF(
	buffer: ArrayBuffer | Uint8Array,
	url: string,
): Promise<FetchResult> {
	const { getDocumentProxy } = await import("unpdf");
	const pdf = await getDocumentProxy(
		buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
	);

	const metadata = await pdf.getMetadata();
	const metadataInfo =
		metadata.info && typeof metadata.info === "object"
			? (metadata.info as Record<string, unknown>)
			: null;

	const metaTitle =
		typeof metadataInfo?.Title === "string"
			? metadataInfo.Title.trim()
			: "";
	const metaAuthor =
		typeof metadataInfo?.Author === "string"
			? metadataInfo.Author.trim()
			: "";

	let urlTitle = "document";
	try {
		const { basename } = await import("node:path");
		urlTitle =
			basename(new URL(url).pathname, ".pdf")
				.replace(/[_-]+/g, " ")
				.trim() || "document";
	} catch {
		/* ignore */
	}
	const title = metaTitle || urlTitle;

	const maxPages = Math.min(pdf.numPages, 100);
	const pages: string[] = [];
	for (let i = 1; i <= maxPages; i++) {
		const page = await pdf.getPage(i);
		const textContent = await page.getTextContent();
		const pageText = textContent.items
			.map((item: unknown) => (item as { str?: string }).str || "")
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
		if (pageText) pages.push(pageText);
	}

	const lines: string[] = [
		`# ${title}`,
		"",
		`> Source: ${url}`,
		`> Pages: ${pdf.numPages}${pdf.numPages > maxPages ? ` (extracted first ${maxPages})` : ""}`,
	];
	if (metaAuthor) lines.push(`> Author: ${metaAuthor}`);
	lines.push("", "---", "");
	lines.push(pages.join("\n\n"));

	if (pdf.numPages > maxPages) {
		lines.push(
			"",
			"---",
			"",
			`*[Truncated: Only first ${maxPages} of ${pdf.numPages} pages extracted]*`,
		);
	}

	return { url, title, content: lines.join("\n"), error: null };
}

// ── RSC Content Extraction (Next.js) ─────────────────────────────────

function extractRSCContent(
	html: string,
): { title: string; content: string } | null {
	if (!html.includes("self.__next_f.push")) return null;

	const chunkMap = new Map<string, string>();
	const scriptRegex =
		/<script>self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)<\/script>/g;

	for (const match of html.matchAll(scriptRegex)) {
		let content: string;
		try {
			content = JSON.parse('"' + match[1] + '"');
		} catch {
			continue;
		}
		for (const line of content.split("\n")) {
			if (!line.trim()) continue;
			const colonIdx = line.indexOf(":");
			if (colonIdx <= 0 || colonIdx > 4) continue;
			const id = line.slice(0, colonIdx);
			if (!/^[0-9a-f]+$/i.test(id)) continue;
			const payload = line.slice(colonIdx + 1);
			if (!payload) continue;
			const existing = chunkMap.get(id);
			if (!existing || payload.length > existing.length) {
				chunkMap.set(id, payload);
			}
		}
	}

	if (chunkMap.size === 0) return null;

	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
	const title = titleMatch?.[1]?.split("|")[0]?.trim() || "";

	const parsedCache = new Map<string, unknown>();
	function getParsedChunk(id: string): unknown | null {
		if (parsedCache.has(id)) return parsedCache.get(id);
		const chunk = chunkMap.get(id);
		if (!chunk || !chunk.startsWith("[")) {
			parsedCache.set(id, null);
			return null;
		}
		try {
			const parsed = JSON.parse(chunk);
			parsedCache.set(id, parsed);
			return parsed;
		} catch {
			parsedCache.set(id, null);
			return null;
		}
	}

	type Node = unknown;
	const visitedRefs = new Set<string>();

	function extractNode(node: Node, ctx = { inCode: false }): string {
		if (node === null || node === undefined) return "";
		if (typeof node === "string") {
			const refMatch = node.match(/^\$L([0-9a-f]+)$/i);
			if (refMatch) {
				const refId = refMatch[1];
				if (visitedRefs.has(refId)) return "";
				visitedRefs.add(refId);
				const refNode = getParsedChunk(refId);
				const result = refNode ? extractNode(refNode, ctx) : "";
				visitedRefs.delete(refId);
				return result;
			}
			if (
				!ctx.inCode &&
				(node === "$undefined" ||
					node === "$" ||
					/^\$[A-Z]/.test(node))
			)
				return "";
			return node.trim() ? node : "";
		}
		if (typeof node === "number") return String(node);
		if (typeof node === "boolean") return "";
		if (!Array.isArray(node)) return "";

		if (node[0] === "$" && typeof node[1] === "string") {
			const tag = node[1] as string;
			const props = (node[3] || {}) as Record<string, unknown>;
			const skipTags = [
				"script", "style", "svg", "path", "circle", "link", "meta",
				"template", "button", "input", "nav", "footer", "aside",
			];
			if (skipTags.includes(tag)) return "";

			if (tag.startsWith("$L")) {
				const refId = tag.slice(2);
				if (visitedRefs.has(refId)) return "";
				if (props.baseId && props.children)
					return `## ${String(props.children)}\n\n`;
				visitedRefs.add(refId);
				const refNode = getParsedChunk(refId);
				let result = "";
				if (refNode) result = extractNode(refNode, ctx);
				else if (props.children)
					result = extractNode(props.children as Node, ctx);
				visitedRefs.delete(refId);
				return result;
			}

			const children = props.children;
			const content = children
				? extractNode(children as Node, ctx)
				: "";

			switch (tag) {
				case "h1": return `# ${content.trim()}\n\n`;
				case "h2": return `## ${content.trim()}\n\n`;
				case "h3": return `### ${content.trim()}\n\n`;
				case "h4": return `#### ${content.trim()}\n\n`;
				case "h5": return `##### ${content.trim()}\n\n`;
				case "h6": return `###### ${content.trim()}\n\n`;
				case "p": return `${content.trim()}\n\n`;
				case "code": {
					const cc = children
						? extractNode(children as Node, { inCode: true })
						: "";
					return ctx.inCode ? cc : `\`${cc}\``;
				}
				case "pre": {
					const pc = children
						? extractNode(children as Node, { inCode: true })
						: "";
					return "```\n" + pc + "\n```\n\n";
				}
				case "strong": case "b": return `**${content}**`;
				case "em": case "i": return `*${content}*`;
				case "li": return `- ${content.trim()}\n`;
				case "ul": case "ol": return content + "\n";
				case "blockquote": return `> ${content.trim()}\n\n`;
				case "a": {
					const href = props.href as string | undefined;
					return href && !href.startsWith("#")
						? `[${content}](${href})`
						: content;
				}
				default: return content;
			}
		}

		return (node as Node[]).map((n) => extractNode(n, ctx)).join("");
	}

	const mainChunk = getParsedChunk("23");
	if (mainChunk) {
		const content = extractNode(mainChunk);
		if (content.trim().length > 100) {
			return {
				title,
				content: content.replace(/\n{3,}/g, "\n\n").trim(),
			};
		}
	}

	const contentParts: { order: number; text: string }[] = [];
	for (const [id] of chunkMap) {
		if (id === "23") continue;
		const parsed = getParsedChunk(id);
		if (!parsed) continue;
		visitedRefs.clear();
		const text = extractNode(parsed);
		if (
			text.trim().length > 50 &&
			!text.includes("page was not found") &&
			!text.includes("404")
		) {
			contentParts.push({
				order: parseInt(id, 16),
				text: text.trim(),
			});
		}
	}

	if (contentParts.length === 0) return null;
	contentParts.sort((a, b) => a.order - b.order);

	const seen = new Set<string>();
	const uniqueParts: string[] = [];
	for (const part of contentParts) {
		const key = part.text.slice(0, 150);
		if (!seen.has(key)) {
			seen.add(key);
			uniqueParts.push(part.text);
		}
	}

	const content = uniqueParts
		.join("\n\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	return content.length > 100 ? { title, content } : null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function isLikelyJSRendered(html: string): boolean {
	const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
	if (!bodyMatch) return false;
	const textContent = bodyMatch[1]
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const scriptCount = (html.match(/<script/gi) || []).length;
	return textContent.length < 500 && scriptCount > 3;
}

function extractHeadingTitle(text: string): string | null {
	const match = text.match(/^#{1,2}\s+(.+)/m);
	if (!match) return null;
	const cleaned = match[1].replace(/\*+/g, "").trim();
	return cleaned || null;
}

// ── Jina Reader Fallback ─────────────────────────────────────────────

async function extractWithJinaReader(
	url: string,
	signal?: AbortSignal,
): Promise<FetchResult | null> {
	try {
		const res = await fetch(JINA_READER_BASE + url, {
			headers: { Accept: "text/markdown", "X-No-Cache": "true" },
			signal: AbortSignal.any([
				AbortSignal.timeout(JINA_TIMEOUT_MS),
				...(signal ? [signal] : []),
			]),
		});
		if (!res.ok) return null;

		const content = await readResponseText(res, MAX_RESPONSE_SIZE);
		const contentStart = content.indexOf("Markdown Content:");
		if (contentStart < 0) return null;

		const markdownPart = content.slice(contentStart + 17).trim();
		if (
			markdownPart.length < 100 ||
			markdownPart.startsWith("Loading...") ||
			markdownPart.startsWith("Please enable JavaScript")
		) {
			return null;
		}

		const title =
			extractHeadingTitle(markdownPart) ??
			new URL(url).pathname.split("/").pop() ??
			url;
		return { url, title, content: markdownPart, error: null };
	} catch {
		return null;
	}
}

// ── Main HTTP Extraction ─────────────────────────────────────────────

async function extractViaHttp(
	url: string,
	signal?: AbortSignal,
): Promise<FetchResult> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	const onAbort = () => controller.abort();
	signal?.addEventListener("abort", onAbort);

	try {
		const fetched = await fetchPublic(
			url,
			{
				headers: {
					"User-Agent": USER_AGENT,
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.9",
					"Cache-Control": "no-cache",
					"Sec-Fetch-Dest": "document",
					"Sec-Fetch-Mode": "navigate",
					"Sec-Fetch-Site": "none",
					"Sec-Fetch-User": "?1",
					"Upgrade-Insecure-Requests": "1",
				},
			},
			controller.signal,
		);
		const response = fetched.response;
		const responseUrl = fetched.url;

		if (!response.ok) {
			return {
				url: responseUrl, title: "", content: "",
				error: `HTTP ${response.status}: ${response.statusText}`,
			};
		}

		const contentType = response.headers.get("content-type") || "";
		const contentLengthHeader = response.headers.get("content-length");
		const isPDFContent = isPDF(responseUrl, contentType);
		const maxSize = isPDFContent ? MAX_PDF_SIZE : MAX_RESPONSE_SIZE;

		if (contentLengthHeader) {
			const contentLength = Number.parseInt(contentLengthHeader, 10);
			if (Number.isFinite(contentLength) && contentLength > maxSize) {
				return {
					url: responseUrl, title: "", content: "",
					error: `Response too large (${Math.ceil(contentLength / 1024 / 1024)}MB)`,
				};
			}
		}

		if (isPDFContent) {
			const buffer = await readResponseBytes(response, maxSize);
			return await extractPDF(buffer, responseUrl);
		}

		if (
			contentType.includes("application/octet-stream") ||
			contentType.includes("image/") ||
			contentType.includes("audio/") ||
			contentType.includes("video/") ||
			contentType.includes("application/zip")
		) {
			return {
				url: responseUrl, title: "", content: "",
				error: `Unsupported content type: ${contentType.split(";")[0]}`,
			};
		}

		const text = await readResponseText(response, maxSize);
		const isHTML =
			contentType.includes("text/html") ||
			contentType.includes("application/xhtml+xml");

		if (!isHTML) {
			const title =
				extractHeadingTitle(text) ??
				new URL(responseUrl).pathname.split("/").pop() ??
				responseUrl;
			return { url: responseUrl, title, content: text, error: null };
		}

		const { document } = parseHTML(text);
		const reader = new Readability(document as unknown as Document);
		const article = reader.parse();

		if (!article) {
			const rscResult = extractRSCContent(text);
			if (rscResult) {
				return {
					url: responseUrl,
					title: rscResult.title,
					content: rscResult.content,
					error: null,
				};
			}

			const jsRendered = isLikelyJSRendered(text);
			return {
				url: responseUrl, title: "", content: "",
				error: jsRendered
					? "Page appears to be JavaScript-rendered (content loads dynamically)"
					: "Could not extract readable content from HTML structure",
			};
		}

		const markdown = turndown.turndown(article.content);

		if (markdown.length < MIN_USEFUL_CONTENT) {
			return {
				url: responseUrl,
				title: article.title || "",
				content: markdown,
				error: isLikelyJSRendered(text)
					? "Page appears to be JavaScript-rendered (content loads dynamically)"
					: "Extracted content appears incomplete",
			};
		}

		return {
			url: responseUrl,
			title: article.title || "",
			content: markdown,
			error: null,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { url, title: "", content: "", error: message };
	} finally {
		clearTimeout(timeoutId);
		signal?.removeEventListener("abort", onAbort);
	}
}

// ── Public Fetch Function ────────────────────────────────────────────

async function fetchAndExtract(
	url: string,
	signal?: AbortSignal,
): Promise<FetchResult> {
	if (signal?.aborted) {
		return { url, title: "", content: "", error: "Aborted" };
	}

	try {
		await assertPublicUrl(url);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { url, title: "", content: "", error: message };
	}

	const httpResult = await extractViaHttp(url, signal);
	if (signal?.aborted)
		return { url, title: "", content: "", error: "Aborted" };
	if (!httpResult.error) return applyOutputLimit(httpResult);

	if (
		httpResult.error.startsWith("Unsupported content type") ||
		httpResult.error.startsWith("Response too large") ||
		httpResult.error.startsWith("Blocked URL") ||
		httpResult.error.startsWith("Too many redirects")
	) {
		return httpResult;
	}

	const jinaResult = await extractWithJinaReader(url, signal);
	if (jinaResult) return applyOutputLimit(jinaResult);
	if (signal?.aborted)
		return { url, title: "", content: "", error: "Aborted" };

	return {
		...httpResult,
		error: `${httpResult.error}\n\nThe page may be JavaScript-rendered. Try:\n  • A different URL for the same content\n  • web_search to find cached/alternative versions`,
	};
}

// ── Extension Registration ───────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description:
			"Fetch a public web page and extract readable content as clean markdown. Uses Readability + Turndown for high-quality HTML→markdown conversion. Handles PDFs, plain text, and falls back to Jina Reader for JS-rendered pages. Local, private, and reserved network addresses are blocked; response bodies and tool output are bounded.",
		promptSnippet:
			"Fetch a public HTTP(S) URL and extract readable content as markdown. Supports HTML pages, PDFs, and plain text.",

		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch" }),
		}),

		async execute(_toolCallId, params, signal) {
			const result = await fetchAndExtract(params.url, signal);

			if (result.error) {
				throw new Error(`${params.url}: ${result.error}`);
			}

			const header = result.title
				? `# ${result.title}\n\nSource: ${result.url}\n\n---\n\n`
				: "";
			return {
				content: [
					{
						type: "text" as const,
						text: header + result.content,
					},
				],
				details: {
					url: result.url,
					title: result.title,
					chars: result.content.length,
					originalChars: result.originalChars ?? result.content.length,
					truncated: result.truncated ?? false,
				},
			};
		},

		renderCall(args, theme, context) {
			const text =
				(context.lastComponent as Text | undefined) ??
				new Text("", 0, 0);
			const { url } = args as { url?: string };
			if (!url) {
				text.setText(
					theme.fg("toolTitle", theme.bold("fetch ")) +
						theme.fg("error", "(no URL)"),
				);
				return text;
			}
			const display =
				url.length > 70 ? url.slice(0, 67) + "..." : url;
			text.setText(
				theme.fg("toolTitle", theme.bold("fetch ")) +
					theme.fg("accent", display),
			);
			return text;
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			const text =
				(context.lastComponent as Text | undefined) ??
				new Text("", 0, 0);

			if (isPartial) {
				text.setText(theme.fg("warning", "Fetching…"));
				return text;
			}

			if (context.isError) {
				const msg =
					result.content?.find((c) => c.type === "text")?.text ||
					"Error";
				text.setText(theme.fg("error", msg));
				return text;
			}

			const details = result.details as {
				title?: string;
				chars?: number;
				originalChars?: number;
				truncated?: boolean;
			};

			const title = details?.title || "Untitled";
			const chars = details?.chars ?? 0;
			const truncationNote = details?.truncated
				? `; truncated from ${details.originalChars ?? "more"} chars`
				: "";
			const status =
				theme.fg("success", title) +
				theme.fg("muted", ` (${chars} chars${truncationNote})`);

			if (!expanded) {
				text.setText(status);
				return text;
			}

			const content =
				result.content.find((c) => c.type === "text")?.text || "";
			const preview =
				content.length > 500
					? content.slice(0, 500) + "..."
					: content;
			text.setText(status + "\n" + theme.fg("dim", preview));
			return text;
		},
	});
}
