

export const PALETTES = {

	atlas: {
		label: 'atlas — upstream\'s map palette',
		void: '#141b24',
		land: '#1b232e',
		road: '#c3cedd',
		arterial: '#ffd27a',
		minor: '#6f7f95',
		casing: '#0a0e14',
		roadLo: '#8794a6',
		roadHi: '#e8f1ff',
		ring: '#0a0e15',
		ringAlpha: 0.0,
		ringEdge: '#c8a23a',
		blip: '#ff4d4d',
		blipEdge: '#0a0e14',

		route: '#7cc9ff',

		north: '#ffcc00',

		labelText: '#ffffff',
		labelBg: 'rgba(6,10,18,0.78)',
		fade: '#141b24',
	},

	gtaV: {
		label: 'GTA V — muted dark',
		void: '#0a0b09',
		land: '#161814',
		road: '#55584f',
		arterial: '#8e8a6a',
		minor: '#42453d',
		casing: '#2b2e28',
		roadLo: '#3d4038',
		roadHi: '#8e9184',
		ring: '#000000',
		ringAlpha: 0.72,
		ringEdge: '#3a3d36',
		blip: '#ffffff',
		blipEdge: '#0a0b09',
		route: '#f2c31a',
		north: '#d8442f',
		labelText: '#eaf0e4',
		labelBg: 'rgba(8,10,7,0.80)',
		fade: '#0a0b09',
	},

	gtaSA: {
		label: 'GTA SA — high contrast',
		void: '#000000',
		land: '#12120e',
		road: '#9a9a8e',
		arterial: '#ffd400',
		minor: '#6b6b60',
		casing: '#ffffff',
		roadLo: '#6e6e63',
		roadHi: '#cfcfc2',
		ring: '#000000',
		ringAlpha: 0.85,
		ringEdge: '#ffffff',
		blip: '#ffe14d',
		blipEdge: '#000000',
		route: '#ffd400',
		north: '#ff4a3d',
		labelText: '#ffffff',
		labelBg: 'rgba(0,0,0,0.85)',
		fade: '#000000',
	},

	amber: {
		label: 'amber — matched to the speedo',
		void: '#0d0904',
		land: '#1a1712',
		road: '#4a4238',
		arterial: '#ffb347',
		minor: '#332c25',
		casing: '#6b5732',
		roadLo: '#372f27',
		roadHi: '#7d7263',
		ring: '#120c06',
		ringAlpha: 0.86,
		ringEdge: '#6b5732',
		blip: '#ffd489',
		blipEdge: '#120c06',
		route: '#ffb347',
		north: '#ff6a52',
		labelText: '#ffd489',
		labelBg: 'rgba(18,12,6,0.88)',
		fade: '#0d0904',
	},
};

export const PALETTE_ORDER = ['atlas', 'gtaV', 'gtaSA', 'amber'];

export const TILTS = {

	vector: {
		label: 'vector projection',
		note: 'roads projected per segment; crisp at any depth, no magnification',
	},
	mode7: {
		label: 'mode-7 scanline',
		note: 'one drawImage per output row; cheapest tilt, but blurs up close',
	},
	css: {
		label: 'CSS 3D transform',
		note: 'cheapest; needs a gradient mask or the far edge is a hard cut',
	},
	none: {
		label: 'no tilt (flat)',
		note: 'tilt mode renders exactly like flat -- the A/B baseline',
	},
};

export const TILT_ORDER = ['vector', 'mode7', 'css', 'none'];
export const MODES = ['flat', 'tilt'];

export const SCALED_PX = [
	'blipR', 'bezelPx', 'compassH', 'compassW', 'compassGap',
	'labelPx', 'labelDrop', 'labelInsetPx',
	'casingPx', 'minRoadPx', 'planMaxRoadPx', 'maxRoadPx', 'fillBleedPx',
	'routeMinPx',
];

export const DEFAULTS = {
	size: 150,
	sizeMin: 110,
	sizeMax: 340,
	zoomM: 110,

	zoomMinM: 25,
	zoomMaxM: 900,
	atlasPxPerM: 3,
	atlasMaxPx: 4096,
	cellM: 3,
	stackM: 3,
	casingM: 1.1,

	fillBleedM: 0.4,

	flatRender: 'vector',
	casingPx: 2.5,
	minRoadPx: 1.6,
	maxRoadPx: 17,

	planMaxRoadPx: 48,

	fillBleedPx: 0.8,

	routeWidthM: 4.6,
	routeMinPx: 6,

	renderHz: 30,

	indexCellM: 25,
	streetR: 26,

	streetFarR: 120,
	namedCellM: 60,
	underR: 9,
	underM: 3.5,
	underAlpha: 0.42,

	streetHWeight: 3,

	streetHops: 8,

	arterialMinV: 17,
	minorMaxV: 4.5,

	blipR: 10,

	bezelPx: 13,
	compass: 'bezel',

	compassH: 6,
	compassW: 7.5,

	compassGap: -1,

	compassTone: 'ring',

	labelDrop: 16,

	labelInsetPx: 4,

	labelPx: 10,

	tiltCamH: 50,
	tiltCamBack: 18,
	tiltPitch: 62,
	tiltFov: 70,
	tiltRangeM: 260,
	tiltFadeFrom: 0.45,

	tiltNearM: 7,
	tiltFarM: 150,
	tiltSpread: 0.62,
	tiltTop: 0.16,
	tiltFade: 0.46,

	cssPerspective: 220,
	cssRotateX: 55,
};

function laneExtent(lanes) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const ln of lanes) {
		for (const p of ln.p) {
			if (p[0] < minX) minX = p[0];
			if (p[0] > maxX) maxX = p[0];
			if (p[2] < minZ) minZ = p[2];
			if (p[2] > maxZ) maxZ = p[2];
		}
	}
	if (!Number.isFinite(minX)) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
	return { minX, maxX, minZ, maxZ };
}

function assignLayers(lanes, cellM, stackM) {
	const cells = new Map();
	for (let i = 0; i < lanes.length; i++) {
		for (const p of lanes[i].p) {
			const key = `${Math.floor(p[0] / cellM)},${Math.floor(p[2] / cellM)}`;
			let bucket = cells.get(key);
			if (!bucket) { bucket = []; cells.set(key, bucket); }
			bucket.push([i, p[1]]);
		}
	}
	for (const ln of lanes) ln._layer = 0;
	let top = 0;
	for (const bucket of cells.values()) {
		if (bucket.length < 2) continue;
		let floor = Infinity;
		let ceil = -Infinity;
		for (const e of bucket) {
			if (e[1] < floor) floor = e[1];
			if (e[1] > ceil) ceil = e[1];
		}
		if (ceil - floor <= stackM) continue;
		for (const e of bucket) {

			const level = Math.floor((e[1] - floor) / stackM);
			if (level <= 0) continue;
			const ln = lanes[e[0]];
			if (level > ln._layer) ln._layer = level;
			if (level > top) top = level;
		}
	}
	return top;
}

function classifyLanes(lanes, arterialMinV, minorMaxV) {
	const top = new Map();
	for (const ln of lanes) {
		const cur = top.get(ln.r);
		if (cur === undefined || ln.v > cur) top.set(ln.r, ln.v);
	}
	const counts = [0, 0, 0];
	for (const ln of lanes) {
		const v = top.get(ln.r);
		ln._class = v >= arterialMinV ? 2 : (v < minorMaxV ? 0 : 1);
		counts[ln._class]++;
	}
	return counts;
}

const CLASS_KEYS = ['minor', 'road', 'arterial'];

const STREET_SUFFIX = {
	Avenue: 'Ave', Boulevard: 'Blvd', Circle: 'Cir', Court: 'Ct',
	Drive: 'Dr', Expressway: 'Expy', Freeway: 'Fwy', Highway: 'Hwy',
	Lane: 'Ln', Parkway: 'Pkwy', Place: 'Pl', Road: 'Rd',
	Square: 'Sq', Street: 'St', Terrace: 'Ter', Trail: 'Trl',
};

const STREET_DIR = {
	North: 'N', South: 'S', East: 'E', West: 'W',
	Northeast: 'NE', Northwest: 'NW', Southeast: 'SE', Southwest: 'SW',
};

export function abbreviateStreet(name) {
	if (!name) return '';
	const words = name.split(' ');
	const last = words.length - 1;
	return words
		.map((word, i) => {
			if (STREET_SUFFIX[word]) return STREET_SUFFIX[word];
			if ((i === 0 || i === last) && STREET_DIR[word]) return STREET_DIR[word];
			return word;
		})
		.join(' ');
}

export function buildIndex(lanes, cellM) {
	const cells = new Map();
	for (let i = 0; i < lanes.length; i++) {
		for (const p of lanes[i].p) {
			const key = `${Math.floor(p[0] / cellM)},${Math.floor(p[2] / cellM)}`;
			let bucket = cells.get(key);
			if (!bucket) { bucket = []; cells.set(key, bucket); }
			bucket.push(p[0], p[2], p[1], i);
		}
	}
	return { cells, cellM };
}

function buildNamedIndex(lanes, names, cellM) {
	const cells = new Map();
	if (!names) return { cells, cellM };
	for (let i = 0; i < lanes.length; i++) {
		if (!names[lanes[i].r]) continue;
		for (const p of lanes[i].p) {
			const key = `${Math.floor(p[0] / cellM)},${Math.floor(p[2] / cellM)}`;
			let bucket = cells.get(key);
			if (!bucket) { bucket = []; cells.set(key, bucket); }
			bucket.push(p[0], p[2], i);
		}
	}
	return { cells, cellM };
}

function resolveNames(lanes, names, hops) {
	const out = Object.create(null);
	if (!names) return out;

	const adj = new Map();
	const link = (a, b) => {
		if (a === b) return;
		let s = adj.get(a);
		if (!s) { s = new Set(); adj.set(a, s); }
		s.add(b);
	};
	for (const lane of lanes) {
		for (const pair of lane.n || []) { link(lane.r, pair[0]); link(pair[0], lane.r); }
	}

	let front = [];
	for (const lane of lanes) {
		const own = names[lane.r];
		if (own && !(lane.r in out)) { out[lane.r] = own; front.push(lane.r); }
	}
	for (let d = 0; d < hops && front.length; d++) {
		const next = [];
		for (const r of front) {
			const s = adj.get(r);
			if (!s) continue;
			for (const q of s) {
				if (q in out) continue;
				out[q] = out[r];
				next.push(q);
			}
		}
		front = next;
	}
	return out;
}

function probeNamed(nix, x, z, r) {
	const reach = Math.ceil(r / nix.cellM);
	const cx = Math.floor(x / nix.cellM);
	const cz = Math.floor(z / nix.cellM);
	let best = -1;
	let bestD2 = r * r;
	for (let gx = cx - reach; gx <= cx + reach; gx++) {
		for (let gz = cz - reach; gz <= cz + reach; gz++) {
			const bucket = nix.cells.get(`${gx},${gz}`);
			if (!bucket) continue;
			for (let i = 0; i < bucket.length; i += 3) {
				const dx = bucket[i] - x;
				const dz = bucket[i + 1] - z;
				const d2 = dx * dx + dz * dz;
				if (d2 < bestD2) { bestD2 = d2; best = bucket[i + 2]; }
			}
		}
	}
	return best;
}

export function probeIndex(index, lanes, x, z, y, searchR, overR, hWeight) {
	const cx = Math.floor(x / index.cellM);
	const cz = Math.floor(z / index.cellM);
	let best = -1;
	let bestD2 = searchR * searchR;
	let ceiling = -Infinity;
	const overR2 = overR * overR;
	const useY = Number.isFinite(y);
	for (let gx = cx - 1; gx <= cx + 1; gx++) {
		for (let gz = cz - 1; gz <= cz + 1; gz++) {
			const bucket = index.cells.get(`${gx},${gz}`);
			if (!bucket) continue;
			for (let i = 0; i < bucket.length; i += 4) {
				const dx = bucket[i] - x;
				const dz = bucket[i + 1] - z;
				const planD2 = dx * dx + dz * dz;

				const dy = useY ? (bucket[i + 2] - y) * hWeight : 0;
				const d2 = planD2 + dy * dy;
				if (d2 < bestD2) { bestD2 = d2; best = bucket[i + 3]; }

				if (planD2 < overR2 && bucket[i + 2] > ceiling) ceiling = bucket[i + 2];
			}
		}
	}
	return {
		lane: best >= 0 ? lanes[best] : null,
		d2: bestD2,
		ceiling,
	};
}

function laneHeight(ln) {
	let sum = 0;
	for (const p of ln.p) sum += p[1];
	return ln.p.length ? sum / ln.p.length : 0;
}

function mixHex(a, b, t) {
	const pa = parseInt(a.slice(1), 16);
	const pb = parseInt(b.slice(1), 16);
	const f = Math.min(1, Math.max(0, t));
	const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * f);
	const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * f);
	const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * f);
	return `rgb(${r},${g},${bl})`;
}

function strokeLane(ctx, ln, originX, originZ, pxPerM) {
	const p = ln.p;
	if (p.length < 2) return;
	ctx.beginPath();
	ctx.moveTo((p[0][0] - originX) * pxPerM, (p[0][2] - originZ) * pxPerM);
	for (let i = 1; i < p.length; i++) {
		ctx.lineTo((p[i][0] - originX) * pxPerM, (p[i][2] - originZ) * pxPerM);
	}
	ctx.stroke();
}

export function prepareLanes(lanes, opts) {
	const o = Object.assign({}, DEFAULTS, opts || {});
	const layers = assignLayers(lanes, o.cellM, o.stackM);
	const classes = classifyLanes(lanes, o.arterialMinV, o.minorMaxV);
	for (const ln of lanes) {
		let sx = 0;
		let sz = 0;
		for (const p of ln.p) { sx += p[0]; sz += p[2]; }
		ln._cx = sx / ln.p.length;
		ln._cz = sz / ln.p.length;
		let r2 = 0;
		for (const p of ln.p) {
			const d = (p[0] - ln._cx) ** 2 + (p[2] - ln._cz) ** 2;
			if (d > r2) r2 = d;
		}
		ln._r = Math.sqrt(r2);
	}

	let lo = Infinity;
	let hi = -Infinity;
	if (o.heightTint) {
		for (const ln of lanes) {
			const hm = laneHeight(ln);
			ln._h = hm;
			if (hm < lo) lo = hm;
			if (hm > hi) hi = hm;
		}
	}
	return { layers, classes, lo, hi, span: hi - lo || 1, ext: laneExtent(lanes) };
}

export function bakeAtlas(lanes, palette, opts) {
	const o = Object.assign({}, DEFAULTS, opts || {});
	const t0 = performance.now();
	const ext = laneExtent(lanes);
	const pad = o.casingM * 3;
	const originX = ext.minX - pad;
	const originZ = ext.minZ - pad;
	const spanX = (ext.maxX - ext.minX) + pad * 2;
	const spanZ = (ext.maxZ - ext.minZ) + pad * 2;

	const want = o.atlasPxPerM;
	const cap = o.atlasMaxPx / Math.max(spanX, spanZ);
	const pxPerM = Math.min(want, cap);
	const w = Math.max(1, Math.ceil(spanX * pxPerM));
	const h = Math.max(1, Math.ceil(spanZ * pxPerM));

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = palette.land;
	ctx.fillRect(0, 0, w, h);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	const prep = prepareLanes(lanes, o);
	const layers = prep.layers;
	const classes = prep.classes;
	const lo = prep.lo;
	const span = prep.span;

	for (let layer = 0; layer <= layers; layer++) {
		const band = lanes.filter((ln) => ln._layer === layer);
		if (!band.length) continue;
		ctx.strokeStyle = palette.casing;
		for (const ln of band) {
			ctx.lineWidth = (ln.w + o.casingM * 2) * pxPerM;
			strokeLane(ctx, ln, originX, originZ, pxPerM);
		}
		for (let rank = 0; rank < CLASS_KEYS.length; rank++) {
			const tier = band.filter((ln) => ln._class === rank);
			if (!tier.length) continue;

			if (!o.heightTint) ctx.strokeStyle = palette[CLASS_KEYS[rank]];
			for (const ln of tier) {
				if (o.heightTint) {
					ctx.strokeStyle = mixHex(palette.roadLo, palette.roadHi,
						(ln._h - lo) / span);
				}
				ctx.lineWidth = (ln.w + o.fillBleedM) * pxPerM;
				strokeLane(ctx, ln, originX, originZ, pxPerM);
			}
		}
	}

	const ms = performance.now() - t0;
	return { canvas, pxPerM, originX, originZ, w, h, layers, classes, ms,
		requested: want };
}

export function clampWidget(el) {
	if (!el || el.style.left === '') return;
	const r = el.getBoundingClientRect();
	const x = Math.min(Math.max(parseFloat(el.style.left) || 0, 0),
		Math.max(0, window.innerWidth - r.width));
	const y = Math.min(Math.max(parseFloat(el.style.top) || 0, 0),
		Math.max(0, window.innerHeight - r.height));
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;
}

export function makeWidgetDraggable(el, storeKey, onTap) {
	if (!el) return;
	const pin = (x, y) => {
		el.style.left = `${x}px`;
		el.style.top = `${y}px`;
		el.style.right = 'auto';
		el.style.bottom = 'auto';
		el.style.transform = 'none';
	};
	try {
		const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
		if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
			pin(saved.x, saved.y);
			clampWidget(el);
		}
	} catch (err) {   }

	let dragging = false;
	let offX = 0;
	let offY = 0;
	let travelled = 0;
	el.addEventListener('pointerdown', (e) => {
		const r = el.getBoundingClientRect();
		pin(r.left, r.top);
		offX = e.clientX - r.left;
		offY = e.clientY - r.top;
		travelled = 0;
		dragging = true;
		el.classList.add('dragging');
		el.setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	});
	el.addEventListener('pointermove', (e) => {
		if (!dragging) return;
		const before = el.getBoundingClientRect();
		pin(e.clientX - offX, e.clientY - offY);
		clampWidget(el);
		const after = el.getBoundingClientRect();
		travelled += Math.abs(after.left - before.left)
			+ Math.abs(after.top - before.top);
	});
	const drop = () => {
		if (!dragging) return;
		dragging = false;
		el.classList.remove('dragging');
		try {
			localStorage.setItem(storeKey, JSON.stringify({
				x: parseFloat(el.style.left) || 0,
				y: parseFloat(el.style.top) || 0,
			}));
		} catch (err) {   }

		if (travelled < 4 && typeof onTap === 'function') onTap();
	};
	el.addEventListener('pointerup', drop);
	el.addEventListener('pointercancel', drop);
	window.addEventListener('resize', () => clampWidget(el));
}

function faceSvg(size, outer, pal, blipR, o) {

	const c = outer / 2;
	const ringR = size / 2 - 1;

	const fused = o.compassTone === 'ring';
	const pipFill = fused ? pal.ringEdge : pal.north;

	const pipEdge = fused ? 'none' : pal.blipEdge;
	const base = o.compass === 'bezel' ? ringR + o.compassGap + 1 : size / 2 - 12;
	const tip = o.compass === 'bezel'
		? Math.min(c - 1, base + o.compassH)
		: size / 2 - 4;
	return `<svg class="mm-face" viewBox="0 0 ${outer} ${outer}" width="${outer}" `
		+ `height="${outer}">`
		+ `<circle class="mm-ring" cx="${c}" cy="${c}" r="${ringR}" fill="none" `
		+ `stroke="${pal.ringEdge}" stroke-width="2"/>`
		+ `<g class="mm-northg"><path class="mm-north" `
		+ `d="M ${c} ${c - tip} L ${c + o.compassW} ${c - base} `
		+ `L ${c - o.compassW} ${c - base} Z" `
		+ `fill="${pipFill}" stroke="${pipEdge}" stroke-width="0.8" `
		+ `stroke-linejoin="round"/></g>`
		+ `<g class="mm-blipg">`

		+ `<path class="mm-blip" d="M 0 ${-blipR} L ${blipR * 0.78} ${blipR * 0.86} `
		+ `L 0 ${blipR * 0.40} L ${-blipR * 0.78} ${blipR * 0.86} Z" `
		+ `fill="${pal.blip}" stroke="${pal.blipEdge}" stroke-width="1.8" `
		+ `stroke-linejoin="round"/></g>`
		+ `</svg>`;
}

export function createPlanVector() {

const binBufs = [];
const binLens = [];

function binReset(n) {
	for (let i = 0; i < n; i++) binLens[i] = 0;
}

function binPush(i, x0, y0, x1, y1, w) {
	let buf = binBufs[i];
	const n = binLens[i] | 0;
	if (buf === undefined) {
		buf = new Float32Array(320);
		binBufs[i] = buf;
	}
	if (n + 5 > buf.length) {
		const grown = new Float32Array(buf.length * 2);
		grown.set(buf);
		buf = grown;
		binBufs[i] = buf;
	}
	buf[n] = x0;
	buf[n + 1] = y0;
	buf[n + 2] = x1;
	buf[n + 3] = y1;
	buf[n + 4] = w;
	binLens[i] = n + 5;
}

function strokeBin(c2, buf, len, pxPerM, extraPx, maxPx, minPx) {
	c2.beginPath();
	for (let i = 0; i < len; i += 5) {
		c2.moveTo(buf[i], buf[i + 1]);
		c2.lineTo(buf[i + 2], buf[i + 3]);
	}
	const raw = buf[4] * pxPerM;
	const w = Math.min(maxPx, Math.max(minPx, raw));
	c2.lineWidth = w + extraPx;
	c2.stroke();
}

return function drawPlanVector(c2, W, H, v) {

	const { lanes, prep, pal, o, pxPerM, cx, cz } = v;
	c2.save();
	c2.fillStyle = pal.void;
	c2.fillRect(0, 0, W, H);
	c2.lineCap = 'round';
	c2.lineJoin = 'round';
	if (!prep) { c2.restore(); return; }

	const ch = Math.cos(v.heading);
	const sh = Math.sin(v.heading);
	const hw = W / 2;
	const hh = H / 2;

	const ext = prep.ext;
	c2.fillStyle = pal.land;
	c2.beginPath();
	for (let k = 0; k < 4; k++) {
		const ex = (k === 0 || k === 3) ? ext.minX : ext.maxX;
		const ez = (k < 2) ? ext.minZ : ext.maxZ;
		const rx = ex - cx;
		const rz = ez - cz;
		const px = hw + (-rx * sh + rz * ch) * pxPerM;
		const py = hh - (rx * ch + rz * sh) * pxPerM;
		if (k === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
	}
	c2.closePath();
	c2.fill();

	const reach = Math.sqrt(hw * hw + hh * hh) / pxPerM + 8;
	const reach2 = reach * reach;
	const nLayer = prep.layers + 1;
	const nCls = CLASS_KEYS.length;
	binReset(nLayer * nCls);

	const bleedPx = Math.max(o.fillBleedPx, o.fillBleedM * pxPerM);

	for (let li = 0; li < lanes.length; li++) {
		const ln = lanes[li];
		const dx = ln._cx - cx;
		const dz = ln._cz - cz;
		const rr = Math.sqrt(dx * dx + dz * dz) - ln._r;
		if (rr > 0 && rr * rr > reach2) continue;
		const p = ln.p;
		const slot = ln._layer * nCls + ln._class;
		let ax = 0;
		let ay = 0;
		let aOk = false;
		for (let i = 0; i < p.length; i++) {
			const rx = p[i][0] - cx;
			const rz = p[i][2] - cz;
			const bx = hw + (-rx * sh + rz * ch) * pxPerM;
			const by2 = hh - (rx * ch + rz * sh) * pxPerM;

			const ok = bx > -W && bx < 2 * W && by2 > -H && by2 < 2 * H;
			if (aOk && (ok || (ax > -W && ax < 2 * W && ay > -H && ay < 2 * H))) {
				binPush(slot, ax, ay, bx, by2, ln.w);
			}
			ax = bx;
			ay = by2;
			aOk = true;
		}
	}

	for (let layer = 0; layer < nLayer; layer++) {
		let any = false;
		for (let c = 0; c < nCls; c++) {
			if (binLens[layer * nCls + c]) { any = true; break; }
		}
		if (!any) continue;
		c2.strokeStyle = pal.casing;
		for (let c = 0; c < nCls; c++) {
			const i = layer * nCls + c;
			if (binLens[i]) {
				strokeBin(c2, binBufs[i], binLens[i], pxPerM,
					o.casingPx * 2, o.planMaxRoadPx, o.minRoadPx);
			}
		}
		for (let c = 0; c < nCls; c++) {
			const i = layer * nCls + c;
			if (!binLens[i]) continue;
			c2.strokeStyle = pal[CLASS_KEYS[c]];
			strokeBin(c2, binBufs[i], binLens[i], pxPerM, bleedPx,
				o.planMaxRoadPx, o.minRoadPx);
		}
	}
	c2.restore();
};
}

export function createMinimap(opts) {
	const o = Object.assign({}, DEFAULTS, opts || {});
	const id = o.id || 'minimap';
	let size = o.size;

	const basePx = {};
	for (const key of SCALED_PX) basePx[key] = o[key];
	let pal = PALETTES[o.palette] || PALETTES.atlas;
	let palName = PALETTES[o.palette] ? o.palette : 'atlas';
	let mode = MODES.indexOf(o.mode) >= 0 ? o.mode : 'flat';
	let tilt = TILTS[o.tilt] ? o.tilt : 'vector';
	let zoomM = o.zoomM;
	let heightTint = !!o.heightTint;
	let route = null;
	let atlas = null;
	let pose = { x: 0, z: 0, y: null, heading: 0 };
	let names = o.names || null;
	let street = '';
	let labelOn = o.label !== false;

	let labelText = null;
	let labelY = -1;
	let labelPal = null;
	let index = null;
	let namedIndex = null;

	let resolved = Object.create(null);

	let lastPaint = -1e9;
	let under = false;
	let prep = null;

	const planVector = createPlanVector();
	let flatRender = o.flatRender === 'atlas' ? 'atlas' : 'vector';

	const adopted = !!o.el;
	const el = o.el || document.createElement('div');
	if (!adopted) {
		el.id = id;
		el.className = 'mm';
	}
	const canvas = document.createElement('canvas');
	canvas.className = 'mm-map';
	el.appendChild(canvas);
	const face = document.createElement('div');
	face.className = 'mm-faceholder';
	face.innerHTML = faceSvg(size, size, pal, o.blipR, o);
	el.appendChild(face);

	const veil = document.createElement('div');
	veil.className = 'mm-veil';
	el.appendChild(veil);

	const label = document.createElement('div');
	label.className = 'mm-label';

	function applyLabelStyle() {
		label.style.cssText = 'position:absolute;left:50%;'
			+ 'transform:translateX(-50%);'
			+ 'pointer-events:none;white-space:nowrap;overflow:hidden;'
			+ `text-overflow:ellipsis;font:600 ${o.labelPx}px/1.5 ui-sans-serif,`
			+ `system-ui,sans-serif;padding:${labelPadY}px ${labelPadX}px;`
			+ `border-radius:${Math.round(o.labelPx / 2)}px;letter-spacing:0.02em;`
			+ 'text-align:center;display:none;';

		labelText = null;
		labelY = NaN;
	}
	el.appendChild(label);

	if (!adopted) (o.mount || document.body).appendChild(el);

	const dpr = Math.min(window.devicePixelRatio || 1, 2);

	let bezel = 0;
	let outer = size;
	let labelPadY = 0;
	let labelPadX = 0;
	let labelH = 0;
	let rulerFont = '';

	function layout() {
		const k = size / DEFAULTS.size;
		for (const key of SCALED_PX) o[key] = basePx[key] * k;
		bezel = o.compass === 'bezel' ? Math.max(0, o.bezelPx) : 0;
		outer = size + bezel * 2;
		labelPadY = Math.round(o.labelPx / 6);
		labelPadX = Math.round(o.labelPx * 0.58);
		labelH = Math.round(o.labelPx * 1.5) + labelPadY * 2;
		rulerFont = `600 ${o.labelPx}px ui-sans-serif,system-ui,sans-serif`;
		applyLabelStyle();
		sizeCanvas();
	}

	function sizeCanvas() {
	canvas.width = Math.round(size * dpr);
	canvas.height = Math.round(size * dpr);

	canvas.style.width = `${size}px`;
	canvas.style.height = `${size}px`;
	canvas.style.left = `${bezel}px`;
	canvas.style.top = `${bezel}px`;
	canvas.style.right = 'auto';
	canvas.style.bottom = 'auto';
	canvas.style.borderRadius = '50%';

	veil.style.left = `${bezel}px`;
	veil.style.top = `${bezel}px`;
	veil.style.right = 'auto';
	veil.style.bottom = 'auto';
	veil.style.width = `${size}px`;
	veil.style.height = `${size}px`;
	veil.style.borderRadius = '50%';

	el.style.width = `${outer}px`;
	el.style.height = `${outer}px`;
	}
	const ctx = canvas.getContext('2d');
	layout();

	const ruler = document.createElement('canvas').getContext('2d');
	function labelWidth(text) {
		ruler.font = rulerFont;
		return ruler.measureText(text).width;
	}

	const scratch = document.createElement('canvas');
	const sctx = scratch.getContext('2d');

	function probe() {
		if (!index) return;
		const hit = probeIndex(index, o.lanes || [], pose.x, pose.z, pose.y,
			o.streetR, o.underR, o.streetHWeight);

		let n = hit.lane && names ? names[hit.lane.r] : null;
		if (!n && hit.lane) n = resolved[hit.lane.r] || null;
		if (!n && names && namedIndex) {
			const far = probeNamed(namedIndex, pose.x, pose.z, o.streetFarR);
			if (far >= 0) n = names[(o.lanes || [])[far].r];
		}
		if (n) street = n;
		if (hit.lane) {
			const carY = Number.isFinite(pose.y) ? pose.y : hit.lane.p[0][1];
			under = Number.isFinite(hit.ceiling)
				&& hit.ceiling > carY + o.underM;
		} else {
			under = false;
		}
	}

	function rebake() {
		prep = prepareLanes(o.lanes || [], {
			cellM: o.cellM,
			stackM: o.stackM,
			arterialMinV: o.arterialMinV,
			minorMaxV: o.minorMaxV,
			heightTint,
		});
		atlas = bakeAtlas(o.lanes || [], pal, {
			atlasPxPerM: o.atlasPxPerM,
			atlasMaxPx: o.atlasMaxPx,
			cellM: o.cellM,
			stackM: o.stackM,
			casingM: o.casingM,
			heightTint,
		});
		return atlas;
	}

	function refreshFace() {
		face.innerHTML = faceSvg(size, outer, pal, o.blipR, o);
		veil.style.background = `linear-gradient(to bottom, ${pal.fade} 0%, `
			+ `${pal.fade}00 ${Math.round(o.tiltFade * 100)}%)`;
	}

	function drawPlanVector(c2, W, H, pxPerM, cx, cz) {
		planVector(c2, W, H, {
			lanes: o.lanes || [], prep, pal, o, pxPerM, cx, cz,
			heading: pose.heading,
		});
	}

	function drawPlan(c2, w, h, pxPerM, cx, cz) {
		if (flatRender === 'vector') drawPlanVector(c2, w, h, pxPerM, cx, cz);
		else drawPlanAtlas(c2, w, h, pxPerM, cx, cz);
		drawRoute(c2, w, h, pxPerM, cx, cz);
	}

	function drawPlanAtlas(c2, w, h, pxPerM, cx, cz) {
		const phi = -Math.PI / 2 - pose.heading;
		c2.save();
		c2.fillStyle = pal.void;
		c2.fillRect(0, 0, w, h);
		c2.translate(w / 2, h / 2);
		c2.rotate(phi);
		c2.scale(pxPerM, pxPerM);
		c2.translate(-cx, -cz);
		if (atlas) {
			c2.drawImage(atlas.canvas,
				atlas.originX, atlas.originZ,
				atlas.w / atlas.pxPerM, atlas.h / atlas.pxPerM);
		}
		c2.restore();
	}

	function drawRoute(c2, W, H, pxPerM, cx, cz) {
		if (!route || route.length < 2) return;
		const ch = Math.cos(pose.heading);
		const sh = Math.sin(pose.heading);
		const hw = W / 2;
		const hh = H / 2;
		c2.save();
		c2.lineCap = 'round';
		c2.lineJoin = 'round';
		c2.beginPath();
		for (let i = 0; i < route.length; i++) {
			const rx = route[i][0] - cx;
			const rz = route[i][1] - cz;
			const px = hw + (-rx * sh + rz * ch) * pxPerM;
			const py = hh - (rx * ch + rz * sh) * pxPerM;
			if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
		}

		const w = Math.min(o.planMaxRoadPx,
			Math.max(o.routeMinPx, o.routeWidthM * pxPerM));

		c2.strokeStyle = pal.casing;
		c2.lineWidth = w + o.casingPx * 2;
		c2.stroke();
		c2.strokeStyle = pal.route;
		c2.lineWidth = w;
		c2.stroke();
		c2.restore();
	}

	function renderFlat() {
		const px = (size * dpr) / zoomM;
		drawPlan(ctx, canvas.width, canvas.height, px, pose.x, pose.z);
	}

	function renderTilt() {
		const W = canvas.width;
		const H = canvas.height;
		ctx.save();
		ctx.fillStyle = pal.void;
		ctx.fillRect(0, 0, W, H);

		const srcCap = flatRender === 'atlas' && atlas ? atlas.pxPerM : Infinity;
		const sPxM = Math.min(srcCap, 1024 / (2 * o.tiltFarM));
		const sSide = Math.max(64, Math.round(2 * o.tiltFarM * sPxM));
		if (scratch.width !== sSide) {
			scratch.width = sSide;
			scratch.height = sSide;
		}
		drawPlan(sctx, sSide, sSide, sPxM, pose.x, pose.z);

		const yTop = Math.round(o.tiltTop * H);
		const near = o.tiltNearM;
		const far = o.tiltFarM;
		const A = far / near;
		const yh = (H - 1 - A * yTop) / (1 - A);
		const k = near * (H - 1 - yh);
		const scx = sSide / 2;
		const scy = sSide / 2;
		const fadeRows = Math.max(1, o.tiltFade * H);

		for (let y = yTop; y < H; y++) {
			const d0 = k / (y - yh);
			const d1 = k / (y + 1 - yh);
			const halfW = d0 * o.tiltSpread;
			const sw = 2 * halfW * sPxM;
			const sy = scy - d0 * sPxM;
			const sh = Math.max(0.5, (d0 - d1) * sPxM);
			ctx.globalAlpha = Math.min(1, (y - yTop) / fadeRows);
			ctx.drawImage(scratch, scx - sw / 2, sy, sw, sh, 0, y, W, 1);
		}
		ctx.globalAlpha = 1;
		ctx.restore();
	}

	function tiltCamera() {
		const W = canvas.width;
		const H = canvas.height;
		const th = (o.tiltPitch * Math.PI) / 180;
		const st = Math.sin(th);
		const ct = Math.cos(th);
		const tanHalf = Math.tan(((o.tiltFov * Math.PI) / 180) / 2);
		const f = (H / 2) / tanHalf;
		const camH = o.tiltCamH;
		const camBack = o.tiltCamBack;
		const denom = st + tanHalf * ct;
		const zBottom = denom !== 0 ? (camH * (ct - tanHalf * st)) / denom : 0;
		return {
			W, H, st, ct, f, camH, camBack,
			behind: zBottom - camBack,
			project(ahead, lat) {
				const Z = ahead + camBack;
				const yc = -camH * ct + Z * st;
				const zc = camH * st + Z * ct;
				return {
					sx: W / 2 + (lat / zc) * f,
					sy: H / 2 - (yc / zc) * f,
					zc,
				};
			},
		};
	}

	function renderTiltVector() {
		const W = canvas.width;
		const H = canvas.height;
		ctx.save();
		ctx.fillStyle = pal.void;
		ctx.fillRect(0, 0, W, H);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		const cam = tiltCamera();
		const st = cam.st;
		const ct = cam.ct;
		const f = cam.f;
		const camH = cam.camH;
		const camBack = cam.camBack;
		const range = o.tiltRangeM;
		const fadeFrom = o.tiltFadeFrom * range;
		const ch = Math.cos(pose.heading);
		const sh = Math.sin(pose.heading);
		const NB = 18;

		const zcOf = (ahead) => camH * st + (ahead + camBack) * ct;

		const behind = cam.behind - 6;
		const zNear = Math.max(0.5, zcOf(behind));
		const zFar = zcOf(range);
		const logSpan = Math.log(zFar / Math.max(0.5, zNear));

		const bins = [];
		const lanes = o.lanes || [];
		const cull2 = (range * 1.15) * (range * 1.15);

		for (const ln of lanes) {

			const dx = ln._cx - pose.x;
			const dz = ln._cz - pose.z;
			const rr = Math.sqrt(dx * dx + dz * dz) - ln._r;
			if (rr > 0 && rr * rr > cull2) continue;
			const p = ln.p;
			let px = 0;
			let py = 0;
			let pz = 0;
			let pOk = false;
			for (let i = 0; i < p.length; i++) {
				const rx = p[i][0] - pose.x;
				const rz = p[i][2] - pose.z;
				const ahead = rx * ch + rz * sh;
				const lat = -rx * sh + rz * ch;
				let sx = 0;
				let sy = 0;
				let zc = 0;
				let ok = ahead > behind && ahead < range;
				if (ok) {
					const Z = ahead + camBack;
					const yc = -camH * ct + Z * st;
					zc = camH * st + Z * ct;
					ok = zc > 0.5;
					if (ok) {
						sx = W / 2 + (lat / zc) * f;
						sy = H / 2 - (yc / zc) * f;

						if (sx < -W || sx > 2 * W) ok = false;
					}
				}
				if (ok && pOk) {
					const zMid = (zc + pz) * 0.5;
					let b = Math.floor((Math.log(zMid / zNear) / logSpan) * NB);
					b = Math.min(NB - 1, Math.max(0, b));
					const layer = ln._layer;
					const cls = ln._class;
					if (!bins[layer]) bins[layer] = [];
					if (!bins[layer][cls]) bins[layer][cls] = [];
					if (!bins[layer][cls][b]) bins[layer][cls][b] = [];
					bins[layer][cls][b].push(px, py, sx, sy, ln.w);
				}
				px = sx;
				py = sy;
				pz = zc;
				pOk = ok;
			}
		}

		const strokeBin = (segs, pxPerM, extraPx) => {
			ctx.beginPath();
			for (let i = 0; i < segs.length; i += 5) {
				ctx.moveTo(segs[i], segs[i + 1]);
				ctx.lineTo(segs[i + 2], segs[i + 3]);
			}
			const raw = segs[4] * pxPerM;
			const w = Math.min(o.maxRoadPx, Math.max(o.minRoadPx, raw));
			ctx.lineWidth = w + extraPx;
			ctx.stroke();
		};

		const sweep = (tiers, extra, isCasing) => {
			for (let b = NB - 1; b >= 0; b--) {
				const zc = zNear * Math.exp(((b + 0.5) / NB) * logSpan);

				const ahead = (zc - camH * st) / ct - camBack;
				ctx.globalAlpha = ahead <= fadeFrom ? 1
					: Math.max(0, 1 - (ahead - fadeFrom) / (range - fadeFrom));
				for (const cls of tiers) {
					const segs = bins[cls[0]] && bins[cls[0]][cls[1]]
						&& bins[cls[0]][cls[1]][b];
					if (!segs || !segs.length) continue;
					ctx.strokeStyle = isCasing ? pal.casing : pal[CLASS_KEYS[cls[1]]];
					strokeBin(segs, f / zc, extra);
				}
			}
		};

		for (let layer = 0; layer < bins.length; layer++) {
			if (!bins[layer]) continue;
			const all = [];
			for (let c = 0; c < CLASS_KEYS.length; c++) all.push([layer, c]);
			sweep(all, o.casingPx * 2, true);
			for (let c = 0; c < CLASS_KEYS.length; c++) {
				sweep([[layer, c]], o.fillBleedPx, false);
			}
		}

		if (route && route.length > 1) {
			ctx.globalAlpha = 1;
			ctx.beginPath();
			let drew = false;
			let pAhead = 0;
			let pLat = 0;
			let pOk = false;
			for (let i = 0; i < route.length; i++) {
				const rx = route[i][0] - pose.x;
				const rz = route[i][1] - pose.z;
				const ahead = rx * ch + rz * sh;
				const lat = -rx * sh + rz * ch;
				const ok = ahead > cam.behind + 0.5 && ahead < range;
				if (ok && pOk) {
					const a = cam.project(pAhead, pLat);
					const b = cam.project(ahead, lat);
					ctx.moveTo(a.sx, a.sy);
					ctx.lineTo(b.sx, b.sy);
					drew = true;
				}
				pAhead = ahead;
				pLat = lat;
				pOk = ok;
			}
			if (drew) {
				const rw = Math.max(o.routeMinPx, o.routeWidthM * 2);
				ctx.strokeStyle = pal.casing;
				ctx.lineWidth = rw + o.casingPx * 2;
				ctx.stroke();
				ctx.strokeStyle = pal.route;
				ctx.lineWidth = rw;
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;
		ctx.restore();
	}

	function render() {

		if (!prep) return;
		if (mode === 'tilt' && tilt === 'vector') renderTiltVector();
		else if (mode === 'tilt' && tilt === 'mode7') renderTilt();
		else renderFlat();

		const g = face.querySelector('.mm-blipg');
		const ng = face.querySelector('.mm-northg');

		const tilted = mode === 'tilt' && tilt !== 'none';
		const bx = outer / 2;
		let by = tilted ? size * 0.82 : size / 2;
		if (mode === 'tilt' && tilt === 'vector') {
			by = tiltCamera().project(0, 0).sy / dpr;
		}
		if (g) {
			g.setAttribute('transform', `translate(${bx} ${by + bezel})`);

			g.setAttribute('opacity', under ? String(o.underAlpha) : '1');
		}

		if (ng) {
			const phiDeg = ((-Math.PI / 2 - pose.heading) * 180) / Math.PI;
			ng.setAttribute('transform',
				`rotate(${phiDeg.toFixed(2)} ${outer / 2} ${outer / 2})`);
		}

		if (labelOn && street) {
			const text = abbreviateStreet(street);

			const need = labelWidth(text) + labelPadX * 2 + 4;
			const rFit = outer / 2 - o.labelInsetPx;
			const cyFit = outer / 2;

			const halfNeed = Math.min(rFit - 1, (need + 8) / 2);
			const dyMax = Math.sqrt(Math.max(0, rFit * rFit - halfNeed * halfNeed));
			const lyElMax = cyFit + dyMax - labelH + o.labelPx / 4;
			let ly = Math.min(by + o.blipR + o.labelDrop, lyElMax - bezel);

			ly = Math.max(ly, by + o.blipR + 2);
			if (text !== labelText || ly !== labelY || pal !== labelPal) {

				const r = outer / 2 - o.labelInsetPx;
				const lyEl = ly + bezel;

				const cy = outer / 2;
				const dy = Math.max(Math.abs(lyEl - cy), Math.abs(lyEl + labelH - cy))
					- o.labelPx / 4;
				const half = Math.sqrt(Math.max(16, r * r - dy * dy));
				label.textContent = text;
				label.style.display = 'block';
				label.style.top = `${(ly + bezel).toFixed(1)}px`;
				label.style.maxWidth = `${Math.max(30, half * 2 - 6).toFixed(0)}px`;
				label.style.color = pal.labelText;
				label.style.background = pal.labelBg;
				labelText = text;
				labelY = ly;
				labelPal = pal;
			}
		} else if (labelText !== null) {
			label.style.display = 'none';
			labelText = null;
		}

		if (mode === 'tilt' && tilt === 'css') {
			canvas.style.transform = `perspective(${o.cssPerspective}px) `
				+ `rotateX(${o.cssRotateX}deg)`;
			canvas.style.transformOrigin = '50% 100%';
			veil.style.display = 'block';
		} else {
			canvas.style.transform = 'none';
			veil.style.display = 'none';
		}
	}

	rebake();

	index = buildIndex(o.lanes || [], o.indexCellM);
	namedIndex = buildNamedIndex(o.lanes || [], names, o.namedCellM);
	resolved = resolveNames(o.lanes || [], names, o.streetHops);
	refreshFace();

	if (o.draggable !== false) makeWidgetDraggable(el, `drive.pos.${id}`);
	render();

	return {
		el,
		canvas,
		get atlas() { return atlas; },
		get palette() { return palName; },
		get mode() { return mode; },
		get tilt() { return tilt; },
		get zoom() { return zoomM; },
		options: o,

		update(next) {
			if (next) {
				if (Number.isFinite(next.x)) pose.x = next.x;
				if (Number.isFinite(next.z)) pose.z = next.z;
				if (Number.isFinite(next.y)) pose.y = next.y;
				if (Number.isFinite(next.heading)) pose.heading = next.heading;
			}

			probe();
			const now = (typeof performance !== 'undefined' && performance.now)
				? performance.now() : 0;
			if (o.renderHz > 0 && now - lastPaint < 1000 / o.renderHz) return;
			lastPaint = now;
			render();
		},

		setNames(map) {
			names = map || null;
			street = '';
			namedIndex = buildNamedIndex(o.lanes || [], names, o.namedCellM);
			resolved = resolveNames(o.lanes || [], names, o.streetHops);
			probe();
			render();
		},
		setLabel(on) {
			labelOn = !!on;

			labelText = null;
			render();
		},

		setFlatRender(name) {
			flatRender = name === 'atlas' ? 'atlas' : 'vector';
			render();
			return flatRender;
		},
		get flatRender() { return flatRender; },

		get prep() { return prep; },
		get street() { return street; },
		get under() { return under; },

		get namesCount() { return names ? Object.keys(names).length : 0; },
		get pose() {
			return { x: pose.x, z: pose.z, y: pose.y, heading: pose.heading };
		},
		get extent() { return prep ? prep.ext : null; },
		setMode(name) {
			if (MODES.indexOf(name) >= 0) mode = name;
			render();
		},
		setTilt(name) {
			if (TILTS[name]) tilt = name;
			render();
		},
		setPalette(name) {
			if (!PALETTES[name]) return;
			palName = name;
			pal = PALETTES[name];
			rebake();
			refreshFace();
			render();
		},

		setSize(px) {
			const want = Math.round(Math.min(o.sizeMax,
				Math.max(o.sizeMin, Number(px) || DEFAULTS.size)));
			if (want === size) return size;

			zoomM = Math.min(o.zoomMaxM,
				Math.max(o.zoomMinM, zoomM * (want / size)));
			size = want;
			layout();
			refreshFace();
			render();
			clampWidget(el);
			return size;
		},
		get size() { return size; },

		zoomBy(f) {
			zoomM = Math.min(o.zoomMaxM, Math.max(o.zoomMinM, zoomM * f));
			render();
			return zoomM;
		},
		get zoom() { return zoomM; },
		setZoom(m) {
			zoomM = Math.min(o.zoomMaxM, Math.max(o.zoomMinM, m));
			render();
		},
		setHeightTint(on) {
			heightTint = !!on;
			rebake();
			render();
		},

		setRoute(points) {
			route = points && points.length > 1 ? points : null;
			render();
		},

		setOption(key, value) {
			o[key] = value;

			if (key === 'flatRender') {
				flatRender = value === 'atlas' ? 'atlas' : 'vector';
			}
			if (key === 'atlasPxPerM' || key === 'casingM' || key === 'stackM'
				|| key === 'cellM' || key === 'atlasMaxPx'
				|| key === 'arterialMinV' || key === 'minorMaxV') rebake();
			if (key === 'tiltFade') refreshFace();
			render();
		},
		setVisible(on) { el.classList.toggle('hidden', !on); },

		destroy() {
			if (adopted) { canvas.remove(); face.remove(); veil.remove(); } else el.remove();
		},
	};
}

export async function loadLanes(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	const data = await res.json();
	return data.lanes || [];
}

export async function loadNames(url) {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const data = await res.json();
		return data.names || null;
	} catch (err) {
		return null;
	}
}

