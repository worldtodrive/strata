// Steps for the artefact suite: everything that can be decided by reading the
// files that are about to ship.

import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
	ROOT, SITE, MAX_FILE_BYTES,
	abs, read, exists, walk, firstPartyScripts,
	declaredHeaders, parseCsp, urlsIn, bytes,
} from './shared.mjs';

const CACHE = path.join(ROOT, '.cache', 'upstream');

Given('the shipped artefact', function () {
	assert.ok(fs.existsSync(SITE), 'docs/ is missing — there is no artefact to check');
	this.files = walk(SITE);
	assert.ok(this.files.length > 0, 'docs/ is empty');
});

Given('the vendor manifest', function () {
	this.manifest = JSON.parse(read('vendor-manifest.json'));
});

// ---------------------------------------------------------------- payload

Then('no file is larger than {int} MiB', function (limitMiB) {
	const limit = limitMiB * 1024 * 1024;
	assert.equal(limit, MAX_FILE_BYTES, 'the feature file and shared.mjs disagree about the limit');

	const over = this.files
		.map((f) => ({ f, size: fs.statSync(abs(f)).size }))
		.filter((x) => x.size > limit);

	assert.deepEqual(
		over.map((x) => `${x.f} (${bytes(x.size)})`),
		[],
		`files over the ${limitMiB} MiB hosting limit`,
	);
});

Then('the ten largest files are listed for the record', function () {
	const top = this.files
		.map((f) => ({ f, size: fs.statSync(abs(f)).size }))
		.sort((a, b) => b.size - a.size)
		.slice(0, 10);

	const headroom = 100 - (top[0].size / MAX_FILE_BYTES) * 100;
	this.log(
		top.map((x) => `${bytes(x.size).padStart(9)}  ${x.f}`).join('\n') +
		`\n\n${headroom.toFixed(1)}% of the per-file limit is still unused.`,
	);
});

// -------------------------------------------------------------- isolation

Then('the header file declares a Content-Security-Policy', function () {
	this.csp = declaredHeaders().get('content-security-policy');
	assert.ok(this.csp, 'no Content-Security-Policy is declared for /* in docs/_headers');
	this.policy = parseCsp(this.csp);
});

Then('the policy limits {string} to this origin and blob URLs', function (directive) {
	assert.deepEqual(
		[...(this.policy[directive] || [])].sort(),
		["'self'", 'blob:'].sort(),
		`${directive} must permit this origin and blob URLs, and nothing else`,
	);
});

Then('the policy limits {string} to this origin', function (directive) {
	assert.deepEqual(this.policy[directive], ["'self'"], `${directive} must permit only this origin`);
});

Then('the policy sets {string} to none', function (directive) {
	assert.deepEqual(this.policy[directive], ["'none'"], `${directive} must be 'none'`);
});

Then('the header file declares {string}', function (header) {
	const value = declaredHeaders().get(header.toLowerCase());
	assert.ok(value, `${header} is not declared for /* in docs/_headers`);
});

Then('no first-party script contains an absolute http or https URL', function () {
	const offenders = [];
	for (const file of firstPartyScripts()) {
		for (const url of urlsIn(read(file))) offenders.push(`${file}: ${url}`);
	}
	assert.deepEqual(offenders, [], 'first-party scripts must name no external origin');
});

Then('no first-party script opens a WebSocket', function () {
	const offenders = firstPartyScripts().filter((f) => /\bnew\s+WebSocket\b/.test(read(f)));
	assert.deepEqual(offenders, [], 'first-party scripts must not open WebSockets');
});

Then('no first-party script constructs an XMLHttpRequest', function () {
	const offenders = firstPartyScripts().filter((f) => /\bXMLHttpRequest\b/.test(read(f)));
	assert.deepEqual(offenders, [], 'first-party scripts must not construct XMLHttpRequests');
});

// The rule is self-maintaining on purpose: rather than checking the page's
// outbound links against a list somebody keeps up to date by hand, it checks
// them against NOTICE. A new external link therefore has to be credited before
// it is allowed, which is the obligation anyway.
Then('every external URL in the home page is an attribution link', function () {
	const credited = new Set(urlsIn(read('NOTICE')));
	const stray = urlsIn(read('docs/index.html'))
		.filter((u) => !u.startsWith('https://drivestrata.io'))
		.filter((u) => !credited.has(u));

	assert.deepEqual(stray, [], 'external links on the page must be credited in NOTICE');
});

// ------------------------------------------------------------- provenance

Then('every vendored file matches its recorded fingerprint', function () {
	const wrong = [];
	for (const entry of this.manifest.files) {
		assert.ok(exists(entry.path), `${entry.path} is in the manifest but does not ship`);
		const actual = crypto.createHash('sha256').update(fs.readFileSync(abs(entry.path))).digest('hex');
		if (actual !== entry.sha256) wrong.push(`${entry.path}\n  recorded ${entry.sha256}\n  actual   ${actual}`);
	}
	assert.deepEqual(wrong, [], 'vendored files no longer match their recorded fingerprints');
});

// npm pack is used rather than a bare download so that the registry's own
// integrity checking applies to the tarball before anything is extracted.
When('the pinned packages are downloaded from the npm registry', function () {
	this.upstream = new Map();

	for (const spec of Object.keys(this.manifest.packages)) {
		const dir = path.join(CACHE, spec.replace(/[^a-zA-Z0-9.-]/g, '_'));
		if (!fs.existsSync(path.join(dir, 'package'))) {
			fs.mkdirSync(dir, { recursive: true });
			execFileSync('npm', ['pack', spec, '--pack-destination', dir, '--silent'], { stdio: 'pipe' });
			const tgz = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
			assert.ok(tgz, `npm pack produced no tarball for ${spec}`);
			execFileSync('tar', ['-xzf', path.join(dir, tgz), '-C', dir]);
		}
		this.upstream.set(spec, path.join(dir, 'package'));
	}
});

Then('every vendored file is byte-identical to its upstream original', function () {
	const differ = [];
	const matched = [];

	for (const entry of this.manifest.files) {
		const source = path.join(this.upstream.get(entry.package), entry.upstream);
		assert.ok(fs.existsSync(source), `${entry.upstream} is not in ${entry.package}`);

		if (fs.readFileSync(abs(entry.path)).equals(fs.readFileSync(source))) {
			matched.push(`${entry.path}  ==  ${entry.package}/${entry.upstream}`);
		} else {
			differ.push(`${entry.path} differs from ${entry.package}/${entry.upstream}`);
		}
	}

	this.log(matched.join('\n'));
	assert.deepEqual(differ, [], 'vendored files must be byte-identical to upstream');
});

// Licence texts and notices are checked by licences.feature; this is about code.
Then('every file in the vendor directory is listed in the manifest', function () {
	const listed = new Set(this.manifest.files.map((f) => f.path));
	const shipped = walk(path.join(SITE, 'vendor')).filter((f) => /\.(js|mjs|cjs|wasm)$/.test(f));
	const unlisted = shipped.filter((f) => !listed.has(f));

	assert.deepEqual(unlisted, [], 'every executable file in docs/vendor/ must be accounted for');
});

Then('NOTICE names the version of every vendored library', function () {
	const notice = read('NOTICE');
	const missing = [];

	for (const spec of Object.keys(this.manifest.packages)) {
		const at = spec.lastIndexOf('@');
		const name = spec.slice(0, at);
		const version = spec.slice(at + 1);

		// three.js is published to npm as 0.160.0 but names itself r160
		// everywhere else, including in its own copyright header.
		const accepted = [version];
		if (name === 'three') accepted.push(`r${parseInt(version.split('.')[1], 10)}`);

		if (!accepted.some((v) => notice.includes(v))) {
			missing.push(`${name} ${version} is vendored but NOTICE names no version of it`);
		}
	}

	assert.deepEqual(missing, [], 'NOTICE must agree with what actually ships');
});

// --------------------------------------------------------------- licences

Then('{string} exists and is not empty', function (file) {
	assert.ok(exists(file), `${file} is missing`);
	assert.ok(fs.statSync(abs(file)).size > 0, `${file} is empty`);
});

// Licence texts are hard-wrapped, so a phrase that sits on one line today can
// straddle a line break after any reflow. Collapsing whitespace on both sides
// keeps this check about the wording rather than about the margins.
Then('{string} contains {string}', function (file, text) {
	assert.ok(exists(file), `${file} is missing`);
	const flat = (s) => s.replace(/\s+/g, ' ');
	assert.ok(flat(read(file)).includes(flat(text)), `${file} does not contain ${JSON.stringify(text)}`);
});

// -------------------------------------------------------- vulnerabilities

When('the OSV database is asked about every pinned library', async function () {
	const queries = Object.keys(this.manifest.packages).map((spec) => {
		const at = spec.lastIndexOf('@');
		return { package: { name: spec.slice(0, at), ecosystem: 'npm' }, version: spec.slice(at + 1) };
	});

	const response = await fetch('https://api.osv.dev/v1/querybatch', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ queries }),
	});
	assert.equal(response.status, 200, 'OSV did not answer');

	this.osv = { specs: Object.keys(this.manifest.packages), results: (await response.json()).results };
});

Then('no pinned library has a known vulnerability', function () {
	const found = [];
	this.osv.results.forEach((result, i) => {
		for (const vuln of result.vulns || []) found.push(`${this.osv.specs[i]}: ${vuln.id}`);
	});

	this.log(`${this.osv.specs.length} pinned libraries queried, ${found.length} advisories found.`);
	assert.deepEqual(found, [], 'a pinned library has a published advisory against it');
});

Then('the declared dependencies have no known vulnerabilities at high severity or above', function () {
	let report;
	try {
		report = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
	} catch (err) {
		// npm audit exits non-zero when it finds anything at all, including the
		// low-severity findings this step deliberately tolerates.
		report = err.stdout;
	}

	const counts = JSON.parse(report).metadata.vulnerabilities;
	this.log(`npm audit: ${JSON.stringify(counts)}`);
	assert.equal(counts.high + counts.critical, 0, 'a declared dependency has a high or critical advisory');
});
