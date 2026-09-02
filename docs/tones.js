

export const WORLD_TONES = {

	bench: {
		label: 'bench greys',
		road: 0x8d939c, slab: 0x5f646b, ground: 0x6f7a63, junctions: 0x9aa0a8,
		paint: 0xd8d8d0, surfaces: 0xb4ac96, buildings: 0x7d7f86,
		garages: 0x8f9089,

		piers: 0xac736e,
	},

	bright: {
		label: 'bright',
		road: 0x3f4653, slab: 0x2f343e, ground: 0x5c8a4a, junctions: 0x4a525f,
		paint: 0xf2efe2, surfaces: 0xc7b183, buildings: 0x8a94a6,
		garages: 0xa39c8f,
		piers: 0xac736e,
	},

	standard: {
		label: 'standard',
		road: 0x2a2f3a, slab: 0x22262f, ground: 0x3d4a35, junctions: 0x333a46,
		paint: 0xf2efe6, surfaces: 0xa89066, buildings: 0xd9d4c8,

		garages: 0xb3b0a8,
		piers: 0xac736e,

		variedBuildings: true,
	},

	poster: {
		label: 'poster',
		road: 0x474f5e, slab: 0x353b47, ground: 0x6aa54f, junctions: 0x525a69,
		paint: 0xfffdf0, surfaces: 0xd8bd82, buildings: 0x9aa6bb,
		garages: 0xb0a894,
		piers: 0xac736e,
	},

	vaporwave: {
		label: 'vaporwave',

		unify: 0.85,
		road: 0x32158c, slab: 0x04172a, ground: 0x0e1224, junctions: 0x0b3e6c,
		paint: 0xfee9ef, surfaces: 0xf65b8b, buildings: 0x140a1c,

		garages: 0x1c1046,
		piers: 0xe81c6a,
	},
};

export const TONE_CLASSES = ['road', 'slab', 'ground', 'junctions', 'paint', 'surfaces',
	'buildings', 'garages', 'piers'];

export function mixTone(hex, toward, t) {
	if (!t) return hex;
	const k = Math.max(0, Math.min(1, t));
	const a = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
	const b = [(toward >> 16) & 255, (toward >> 8) & 255, toward & 255];
	const c = a.map((x, i) => Math.round(x + (b[i] - x) * k));
	return (c[0] << 16) | (c[1] << 8) | c[2];
}

export function toneHex(v) {
	return `#${v.toString(16).padStart(6, '0')}`;
}

export function gradeTone(hex, gain) {
	if (!gain) return hex;
	const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * gain[0])));
	const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * gain[1])));
	const b = Math.max(0, Math.min(255, Math.round((hex & 255) * gain[2])));
	return (r << 16) | (g << 8) | b;
}

export const GRADES = {
	off: {
		label: 'none (as authored)',
		blurb: 'The albedo exactly as the palette declares it. The before-picture.',
		harmony: 0, sat: 1, lift: 0,
	},
	airy: {
		label: 'airy',
		blurb: 'A touch of sky in everything. Nothing else moves — the safest step away '
			+ 'from the current look.',
		harmony: 0.16, sat: 0.95, lift: 0.02,
	},
	hazy: {
		label: 'hazy',
		blurb: 'Air between you and the ground. Green stops arguing with the sky and the '
			+ 'whole frame reads as one time of day.',
		harmony: 0.32, sat: 0.85, lift: 0.05,
	},
	pastel: {
		label: 'pastel',
		blurb: 'Lowest contrast of the six. Soft, storybook, everything close together in '
			+ 'value — the furthest from a survey render.',
		harmony: 0.28, sat: 0.68, lift: 0.14,
	},
	dusty: {
		label: 'dusty',
		blurb: 'The strongest blend. At sunset the ground goes properly warm; at midnight '
			+ 'it goes properly blue. Most dramatic at the edges of the day.',
		harmony: 0.42, sat: 0.72, lift: 0.08,
	},
	crisp: {
		label: 'crisp',
		blurb: 'The other direction — more separation, not less. Here to prove the axis '
			+ 'has two ends rather than because anyone asked for it.',
		harmony: 0.08, sat: 1.12, lift: 0,
	},

	retro: {
		label: 'retro (vaporwave)',
		blurb: 'Cyan shadows, magenta highlights, lifted blacks. The lift is the signature — '
			+ 'a VHS dub never reaches true black, and that milky shadow is most of why the '
			+ 'era looks like the era.',
		harmony: 0, sat: 1, lift: 0,
		split: {
			shadowHue: 0.5, shadowAmt: 0.3, highlightHue: 0.88, highlightAmt: 0.26,
			satMult: 1.3, satFloor: 0.1, tilt: 0.045, contrast: 0.94,
			surfaceHue: 0.78, surfacePull: 0.18,
		},
	},
	cyber: {
		label: 'cyber (neon)',
		blurb: 'Hot pink against deep blue, crushed blacks, a violet carriageway. The strong '
			+ 'one — every axis further than retro, and the blacks go down rather than up '
			+ 'because that contrast is what makes neon read as neon.',
		harmony: 0, sat: 1, lift: 0,
		split: {
			shadowHue: 0.57, shadowAmt: 0.74, highlightHue: 0.92, highlightAmt: 0.82,
			satMult: 2.4, satFloor: 0.34, tilt: -0.05, contrast: 1.22,
			surfaceHue: 0.75, surfacePull: 0.62,
		},
	},
};

export const DEFAULT_GRADE = 'off';

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const LUMA = [0.2126, 0.7152, 0.0722];
const luma = (c) => LUMA[0] * c[0] + LUMA[1] * c[1] + LUMA[2] * c[2];

export function gradeWorld(hex, gain, ambient, g, side = 'auto') {
	let c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
	if (gain) {
		c = [c[0] * gain[0], c[1] * gain[1], c[2] * gain[2]];

		if (gain.desat > 0) {
			const y = luma(c);
			c = c.map((x) => y + (x - y) * (1 - gain.desat));
		}

		if (gain.tint) {
			c = [c[0] * gain.tint[0], c[1] * gain.tint[1], c[2] * gain.tint[2]];
		}
	}

	if (g && g.split) return splitTone(c, g.split, side);
	if (!g || (g.harmony === 0 && g.sat === 1 && g.lift === 0)) {
		return (clamp255(c[0]) << 16) | (clamp255(c[1]) << 8) | clamp255(c[2]);
	}

	if (g.sat !== 1) {
		const y = luma(c);
		c = c.map((x) => y + (x - y) * g.sat);
	}

	if (g.harmony > 0 && ambient !== null && ambient !== undefined) {
		const a = [(ambient >> 16) & 255, (ambient >> 8) & 255, ambient & 255];
		const ay = luma(a);
		if (ay > 1) {
			const k = luma(c) / ay;
			c = c.map((x, i) => x + (a[i] * k - x) * g.harmony);
		}
	}

	if (g.lift > 0) c = c.map((x) => x + (128 - x) * g.lift);
	return (clamp255(c[0]) << 16) | (clamp255(c[1]) << 8) | clamp255(c[2]);
}

function splitTone(c, s, side) {
	const hsl = rgbToHsl(c[0] / 255, c[1] / 255, c[2] / 255);
	const h = hsl[0], sat = hsl[1], l = hsl[2];
	const shadow = side === 'auto' ? l < 0.5 : side === 'shadow';
	const toward = side === 'surface' ? s.surfaceHue
		: shadow ? s.shadowHue : s.highlightHue;
	const graded = (x) => Math.min(1, Math.max(x, s.satFloor) * s.satMult);
	const toned = (lit) => Math.min(1, Math.max(0, 0.5 + (lit + s.tilt - 0.5) * s.contrast));
	const isSurface = side === 'surface';
	const pull = isSurface ? s.surfacePull : shadow ? s.shadowAmt : s.highlightAmt;
	const k = Math.min(1, Math.max(0, pull));

	const targetS = side === 'auto' ? graded(sat) : graded(Math.max(sat, 0.55));

	const lit = isSurface ? Math.min(0.62, toned(l) + SURFACE_LIFT * k) : toned(l);
	const T = hslToRgb(toward, targetS, lit);
	const B = hslToRgb(h, graded(sat), lit);
	return (clamp255((B[0] + (T[0] - B[0]) * k) * 255) << 16)
		| (clamp255((B[1] + (T[1] - B[1]) * k) * 255) << 8)
		| clamp255((B[2] + (T[2] - B[2]) * k) * 255);
}

const SURFACE_LIFT = 0.17;

function rgbToHsl(r, g, b) {
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2, d = max - min;
	if (d === 0) return [0, 0, l];
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else h = ((r - g) / d + 4) / 6;
	return [h, s, l];
}

function hslToRgb(h, s, l) {
	if (s === 0) return [l, l, l];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hue = (t) => {
		let x = t;
		if (x < 0) x += 1;
		if (x > 1) x -= 1;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}
