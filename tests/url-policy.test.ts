import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicHttpUrl, isPrivateIpAddress } from "../extensions/web-fetch/url-policy.ts";

test("classifies private and reserved IPv4 ranges", () => {
	for (const address of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.0.2.1", "192.88.99.1", "192.168.1.1"]) {
		assert.equal(isPrivateIpAddress(address), true, address);
	}
	assert.equal(isPrivateIpAddress("8.8.8.8"), false);
});

test("classifies private IPv6 ranges", () => {
	for (const address of [
		"::",
		"::1",
		"fd00::1",
		"fe80::1",
		"ff02::1",
		"2001:db8::1",
		"2002:c0a8:0101::1",
		"::ffff:127.0.0.1",
		"::ffff:192.168.1.1",
	]) {
		assert.equal(isPrivateIpAddress(address), true, address);
	}
	assert.equal(isPrivateIpAddress("2001:4860:4860::8888"), false);
	assert.equal(isPrivateIpAddress("::ffff:8.8.8.8"), false);
});

test("accepts a public IPv6 literal without reverse DNS", async () => {
	const url = await assertPublicHttpUrl("https://[2001:4860:4860::8888]/");
	assert.equal(url.hostname, "[2001:4860:4860::8888]");
});

test("rejects local, credential-bearing, and non-HTTP URLs before DNS lookup", async () => {
	await assert.rejects(assertPublicHttpUrl("http://localhost:3000"), /Private or local/);
	await assert.rejects(assertPublicHttpUrl("https://user:pass@example.com"), /embedded credentials/);
	await assert.rejects(assertPublicHttpUrl("file:///etc/passwd"), /Only http/);
});
