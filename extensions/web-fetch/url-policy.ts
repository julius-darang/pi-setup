import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function ipv4ToNumber(address: string): number | null {
	const parts = address.split(".");
	if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
	const octets = parts.map(Number);
	if (octets.some((octet) => octet < 0 || octet > 255)) return null;
	return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function inIpv4Range(address: string, start: string, end: string): boolean {
	const value = ipv4ToNumber(address);
	const lower = ipv4ToNumber(start);
	const upper = ipv4ToNumber(end);
	return value !== null && lower !== null && upper !== null && value >= lower && value <= upper;
}

function parseIpv6(address: string): number[] | null {
	let normalized = address.toLowerCase();
	if (normalized.includes("%")) return null;

	// Convert an embedded IPv4 suffix to its two hexadecimal words first.
	if (normalized.includes(".")) {
		const separator = normalized.lastIndexOf(":");
		if (separator < 0) return null;
		const ipv4 = normalized.slice(separator + 1);
		const octets = ipv4ToNumber(ipv4);
		if (octets === null) return null;
		const a = (octets >>> 24) & 0xff;
		const b = (octets >>> 16) & 0xff;
		const c = (octets >>> 8) & 0xff;
		const d = octets & 0xff;
		normalized = `${normalized.slice(0, separator)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}

	const parseWord = (word: string): number | null =>
		/^[0-9a-f]{1,4}$/.test(word) ? Number.parseInt(word, 16) : null;
	const compression = normalized.indexOf("::");
	if (compression >= 0) {
		if (normalized.indexOf("::", compression + 2) >= 0) return null;
		const left = normalized.slice(0, compression) ? normalized.slice(0, compression).split(":") : [];
		const right = normalized.slice(compression + 2) ? normalized.slice(compression + 2).split(":") : [];
		const leftWords = left.map(parseWord);
		const rightWords = right.map(parseWord);
		const zeroCount = 8 - left.length - right.length;
		if (zeroCount < 1 || leftWords.some((word) => word === null) || rightWords.some((word) => word === null)) return null;
		return [
			...(leftWords as number[]),
			...Array.from({ length: zeroCount }, () => 0),
			...(rightWords as number[]),
		];
	}

	const words = normalized.split(":").map(parseWord);
	return words.length === 8 && words.every((word) => word !== null) ? words as number[] : null;
}

function matchesIpv6Prefix(words: number[], network: number[], prefixLength: number): boolean {
	let remaining = prefixLength;
	for (let index = 0; remaining > 0; index++) {
		const bits = Math.min(16, remaining);
		const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
		if ((words[index] & mask) !== ((network[index] ?? 0) & mask)) return false;
		remaining -= bits;
	}
	return true;
}

/** Return true for loopback, link-local, private, reserved, or otherwise non-public IPs. */
export function isPrivateIpAddress(address: string): boolean {
	const value = address.replace(/^\[|\]$/g, "").toLowerCase();
	if (isIP(value) === 4) {
		return [
			["0.0.0.0", "0.255.255.255"],
			["10.0.0.0", "10.255.255.255"],
			["100.64.0.0", "100.127.255.255"],
			["127.0.0.0", "127.255.255.255"],
			["169.254.0.0", "169.254.255.255"],
			["172.16.0.0", "172.31.255.255"],
			["192.0.0.0", "192.0.0.255"],
			["192.0.2.0", "192.0.2.255"],
			["192.88.99.0", "192.88.99.255"],
			["192.168.0.0", "192.168.255.255"],
			["198.18.0.0", "198.19.255.255"],
			["198.51.100.0", "198.51.100.255"],
			["203.0.113.0", "203.0.113.255"],
			["224.0.0.0", "255.255.255.255"],
		].some(([start, end]) => inIpv4Range(value, start, end));
	}
	if (isIP(value) !== 6) return true;

	const words = parseIpv6(value);
	if (!words) return true;

	const firstFiveZero = words.slice(0, 5).every((word) => word === 0);
	if (firstFiveZero && words[5] === 0xffff) {
		const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
		return isPrivateIpAddress(ipv4);
	}
	// Deprecated IPv4-compatible IPv6 addresses also inherit the embedded IPv4 policy.
	if (words.slice(0, 6).every((word) => word === 0)) {
		const ipv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
		return isPrivateIpAddress(ipv4);
	}

	return (
		words.every((word) => word === 0) ||
		(words.slice(0, 7).every((word) => word === 0) && words[7] === 1) ||
		matchesIpv6Prefix(words, [0x0064, 0xff9b], 96) || // NAT64 well-known prefix
		matchesIpv6Prefix(words, [0x0100], 64) || // discard-only prefix
		matchesIpv6Prefix(words, [0x2001, 0x0000], 32) || // Teredo
		matchesIpv6Prefix(words, [0x2001, 0x0002], 48) || // benchmarking
		matchesIpv6Prefix(words, [0x2001, 0x0010], 28) || // ORCHID
		matchesIpv6Prefix(words, [0x2001, 0x0020], 28) || // ORCHIDv2
		matchesIpv6Prefix(words, [0x2001, 0x0db8], 32) || // documentation
		matchesIpv6Prefix(words, [0x3ffe], 16) || // 6bone
		matchesIpv6Prefix(words, [0x2002], 16) || // 6to4
		matchesIpv6Prefix(words, [0xfc00], 7) || // unique-local
		matchesIpv6Prefix(words, [0xfe80], 10) || // link-local
		matchesIpv6Prefix(words, [0xfec0], 10) || // deprecated site-local
		matchesIpv6Prefix(words, [0xff00], 8) // multicast
	);
}

function isPrivateHostname(hostname: string): boolean {
	const host = hostname.replace(/\.$/, "").toLowerCase();
	return (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal") ||
		host.endsWith(".lan") ||
		host === "home.arpa"
	);
}

/** Validate a URL and reject destinations that could reach local/private services. */
export async function assertPublicHttpUrl(input: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new Error("Invalid URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Only http:// and https:// URLs are supported");
	}
	if (url.username || url.password) {
		throw new Error("URLs with embedded credentials are not allowed");
	}
	const hostWithoutBrackets = url.hostname.replace(/^\[|\]$/g, "");
	if (isPrivateHostname(url.hostname)) {
		throw new Error("Private or local network URLs are not allowed");
	}
	const addressFamily = isIP(hostWithoutBrackets);
	if (addressFamily !== 0) {
		if (isPrivateIpAddress(hostWithoutBrackets)) {
			throw new Error("Private or local network URLs are not allowed");
		}
		// IP literals are already fully resolved. Passing bracketed IPv6 hostnames
		// to dns.lookup would reject valid public literals, and a reverse lookup
		// would add no useful SSRF protection.
		return url;
	}

	let addresses: Array<{ address: string }>;
	try {
		addresses = await lookup(url.hostname, { all: true, verbatim: true });
	} catch {
		throw new Error(`Could not resolve hostname: ${url.hostname}`);
	}
	if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIpAddress(address))) {
		throw new Error("URL resolves to a private or local network address");
	}
	return url;
}
