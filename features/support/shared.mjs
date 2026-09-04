// Helpers shared by both suites. Nothing here asserts anything; the assertions
// live in the step definitions, next to the sentence they implement.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const SITE = path.join(ROOT, 'docs');
export const ORIGIN = 'https://drivestrata.io';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function abs(rel) {
	return path.join(ROOT, rel);
}

export function read(rel) {
	return fs.readFileSync(abs(rel), 'utf8');
}

export function exists(rel) {
	return fs.existsSync(abs(rel));
}

// Every file under dir, as paths relative to ROOT.
export function walk(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else if (entry.isFile()) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
	}
	return out;
}

// The scripts we wrote, as opposed to the ones we vendored. The distinction
// matters: our code is held to "names no external origin at all", while the
// vendored code is held to "is byte-identical to what upstream published".
export function firstPartyScripts() {
	return walk(SITE).filter((f) => f.endsWith('.js') && !f.startsWith('docs/vendor/'));
}

// _headers is a flat file of path patterns, each followed by indented headers.
// This returns the headers declared for the pattern given, keyed lower case.
export function declaredHeaders(pattern = '/*') {
	const headers = new Map();
	let section = null;
	for (const line of read('docs/_headers').split('\n')) {
		if (!line.trim()) continue;
		if (!/^\s/.test(line)) {
			section = line.trim();
			continue;
		}
		if (section !== pattern) continue;
		const at = line.indexOf(':');
		if (at === -1) continue;
		headers.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim());
	}
	return headers;
}

// "default-src 'self'; connect-src 'self' blob:" becomes
// { 'default-src': ["'self'"], 'connect-src': ["'self'", 'blob:'] }
export function parseCsp(policy) {
	const out = {};
	for (const clause of policy.split(';')) {
		const parts = clause.trim().split(/\s+/).filter(Boolean);
		if (!parts.length) continue;
		out[parts[0].toLowerCase()] = parts.slice(1);
	}
	return out;
}

// Absolute http(s) URLs appearing in a piece of text, de-duplicated. Trailing
// punctuation is trimmed because these are pulled out of prose as well as markup.
export function urlsIn(text) {
	const found = text.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
	return [...new Set(found.map((u) => u.replace(/[.,]+$/, '')))];
}

export function bytes(n) {
	return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}
