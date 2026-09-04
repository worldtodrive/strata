// Steps for the live suite: everything that requires asking the public internet.

import { Given, When, Then, After, setDefaultTimeout } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

import { ORIGIN, read, declaredHeaders, parseCsp, urlsIn } from './shared.mjs';

setDefaultTimeout(120000);

// Third-party hosts are under no obligation to answer a build server quickly.
async function fetchWithRetry(url, options = {}, attempts = 3) {
	let last;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fetch(url, { redirect: 'follow', ...options });
		} catch (err) {
			last = err;
			await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
		}
	}
	throw last;
}

// ------------------------------------------------------------ the site

When('I request {string}', async function (path) {
	this.response = await fetchWithRetry(ORIGIN + path);
	const type = this.response.headers.get('content-type') || '';
	this.body = /text|json|xml/.test(type) ? await this.response.text() : null;
});

Then('the response status is {int}', function (status) {
	assert.equal(this.response.status, status, `${this.response.url} answered ${this.response.status}`);
});

Then('the response content type is {string}', function (type) {
	const actual = this.response.headers.get('content-type') || '';
	assert.ok(actual.startsWith(type), `expected ${type}, got ${actual || '(none)'}`);
});

Then('the response carries the header {string}', function (header) {
	assert.ok(this.response.headers.get(header), `${header} is absent from the live response`);
});

Then('the delivered policy limits {string} to this origin and blob URLs', function (directive) {
	const policy = parseCsp(this.response.headers.get('content-security-policy') || '');
	assert.deepEqual([...(policy[directive] || [])].sort(), ["'self'", 'blob:'].sort());
});

Then('the delivered policy limits {string} to this origin', function (directive) {
	const policy = parseCsp(this.response.headers.get('content-security-policy') || '');
	assert.deepEqual(policy[directive], ["'self'"]);
});

// The host rewrites and re-serves what the artefact declares, so this is where
// a silent transformation would show up.
Then('the delivered policy is identical to the one declared in the artefact', function () {
	const normalise = (s) => s.replace(/\s+/g, ' ').trim();
	assert.equal(
		normalise(this.response.headers.get('content-security-policy') || ''),
		normalise(declaredHeaders().get('content-security-policy') || ''),
		'the policy in production is not the policy in the artefact',
	);
});

// -------------------------------------------------------------- identity

function meta(html, attr, name) {
	const re = new RegExp(`<meta[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
	return (html.match(re) || [])[1];
}

Then('the canonical link is {string}', function (expected) {
	const found = (this.body.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) || [])[1];
	assert.equal(found, expected);
});

Then('the og:url is {string}', function (expected) {
	assert.equal(meta(this.body, 'property', 'og:url'), expected);
});

Then('the og:image is served from {string}', function (origin) {
	const image = meta(this.body, 'property', 'og:image');
	assert.ok(image && image.startsWith(origin), `og:image is ${image}`);
});

Then('the page declares no {string}', function (token) {
	const robots = meta(this.body, 'name', 'robots') || '';
	assert.ok(!robots.includes(token), `the page declares robots="${robots}"`);
});

Then('the response carries no {string} forbidding indexing', function (header) {
	const value = this.response.headers.get(header) || '';
	assert.ok(!/noindex/i.test(value), `${header} is "${value}"`);
});

Then('it names a sitemap', function () {
	const found = (this.body.match(/^\s*Sitemap:\s*(\S+)/im) || [])[1];
	assert.ok(found, 'robots.txt names no sitemap');
	this.sitemap = found;
});

Then('that sitemap is served', async function () {
	const response = await fetchWithRetry(this.sitemap);
	assert.equal(response.status, 200, `${this.sitemap} answered ${response.status}`);
});

// ----------------------------------------------------------- the browser

Given('a headless browser', async function () {
	const { chromium } = await import('playwright');
	this.browser = await chromium.launch();
	this.page = await this.browser.newPage({ viewport: { width: 1280, height: 720 } });

	this.pageErrors = [];
	this.requested = [];
	this.succeeded = [];
	this.blocked = new Map();

	this.page.on('pageerror', (err) => this.pageErrors.push(err.message));
	this.page.on('request', (req) => this.requested.push(req.url()));
	this.page.on('requestfailed', (req) => this.blocked.set(req.url(), req.failure()?.errorText || 'unknown'));
	this.page.on('response', (res) => {
		if (res.status() < 400) this.succeeded.push(res.url());
	});
});

// blob: and data: URLs are the page talking to itself out of memory; they never
// touch the network, so only real network schemes are of interest here.
function foreign(urls, origin) {
	return [...new Set(urls.filter((u) => /^https?:/.test(u)).filter((u) => !u.startsWith(origin)))];
}

After(async function () {
	if (this.browser) await this.browser.close();
});

When('it opens the home page', async function () {
	await this.page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
});

// The loading screen removes itself from the document once the level is up. It
// stays put, showing a message, if loading fails — so its absence is the signal.
async function waitForWorld(page, seconds) {
	await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: seconds * 1000 });
}

Then('the loading screen goes away within {int} seconds', async function (seconds) {
	await waitForWorld(this.page, seconds);
});

When('it waits for the world to finish loading', async function () {
	await waitForWorld(this.page, 90);
});

Then('a rendering canvas is present at a non-zero size', async function () {
	const box = await this.page.locator('canvas').first().boundingBox();
	assert.ok(box, 'there is no canvas on the page');
	assert.ok(box.width > 0 && box.height > 0, `the canvas is ${box.width}x${box.height}`);
});

Then('the display does not report a failure', async function () {
	const hud = await this.page.locator('#hud').textContent();
	assert.ok(!/fail/i.test(hud || ''), `the display reads "${hud}"`);
});

Then('no uncaught error was raised', function () {
	assert.deepEqual(this.pageErrors, [], 'the page raised uncaught errors');
});

Then('no response came from an origin other than {string}', function (origin) {
	const leaked = foreign(this.succeeded, origin);

	this.log(`${this.requested.length} requests observed, ${this.succeeded.length} of them answered.`);
	assert.deepEqual(leaked, [], 'the page successfully loaded something from another origin');
});

// The host injects its own analytics beacon into every response. It is not in
// the artefact and cannot be removed from here, so what is checked is that the
// policy stops it: every foreign request must have failed, and failed for that
// reason rather than because the far end happened to be down.
Then('every request to another origin was blocked by the policy', function () {
	const attempted = foreign(this.requested, ORIGIN);
	const notBlocked = attempted.filter((u) => this.blocked.get(u) !== 'csp');

	if (attempted.length) {
		this.log(
			`Reached for ${attempted.length} foreign resource(s), all refused by the policy:\n` +
			attempted.map((u) => `  ${this.blocked.get(u) || 'not blocked'}  ${u}`).join('\n'),
		);
	} else {
		this.log('The page reached for no foreign origin at all.');
	}

	assert.deepEqual(notBlocked, [], 'a request to another origin was not blocked by the policy');
});

// ----------------------------------------------------------- attribution

Given('the attribution URLs in {string}', function (file) {
	this.urls = urlsIn(read(file)).filter((u) => !u.startsWith(ORIGIN));
	assert.ok(this.urls.length > 0, `${file} names no attribution URLs`);
});

// A dead link is a 404, a 410, or a host that no longer exists. A 403 or a 429
// is a host declining to talk to a build server, which says nothing about
// whether the resource is still published — so it is reported, not failed.
// Overstating this check would make it useless: it would be red most weeks and
// nobody would look.
async function resolves(url) {
	try {
		const response = await fetchWithRetry(url, { headers: { 'user-agent': 'strata-link-check' } });
		if (response.status === 404 || response.status === 410) return `${url} → ${response.status} gone`;
		if (response.status >= 400) return { soft: `${url} → ${response.status}, reachable but declined` };
		return null;
	} catch (err) {
		return `${url} → unreachable (${err.cause?.code || err.message})`;
	}
}

Then('every one of them resolves', async function () {
	const dead = [];
	const declined = [];

	for (const url of this.urls) {
		const result = await resolves(url);
		if (!result) continue;
		if (result.soft) declined.push(result.soft);
		else dead.push(result);
	}

	if (declined.length) this.log(`Declined to answer:\n${declined.join('\n')}`);
	this.log(`${this.urls.length} attribution URLs checked.`);
	assert.deepEqual(dead, [], 'an attribution link has rotted');
});

Then('the source link for the vehicle model resolves', async function () {
	const url = this.urls.find((u) => u.includes('sketchfab.com'));
	assert.ok(url, 'NOTICE no longer links the vehicle model source, which CC BY 4.0 requires');

	const result = await resolves(url);
	assert.ok(!result || result.soft, `the vehicle model source is gone: ${result}`);
});
