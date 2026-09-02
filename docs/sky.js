

const DEG = Math.PI / 180;

export const DEFAULT_LATITUDE_DEG = 32.8;

export function sunVector(timeOfDay, latitudeDeg = DEFAULT_LATITUDE_DEG) {
	const H = 2 * Math.PI * (timeOfDay - 0.5);
	const phi = (latitudeDeg || 0) * DEG;
	const cH = Math.cos(H);
	const sH = Math.sin(H);
	const east = -sH;
	const north = -Math.sin(phi) * cH;
	const up = Math.cos(phi) * cH;
	const len = Math.hypot(east, north, up) || 1;

	return { x: east / len, y: up / len, z: -north / len };
}

export function moonVector(timeOfDay, latitudeDeg = DEFAULT_LATITUDE_DEG) {
	const s = sunVector(timeOfDay, latitudeDeg);
	return { x: -s.x, y: -s.y, z: -s.z };
}

export function dirFromAltAz(altDeg, aziDeg) {
	const alt = altDeg * DEG;
	const azi = aziDeg * DEG;
	const ca = Math.cos(alt);
	return { x: ca * Math.sin(azi), y: Math.sin(alt), z: -ca * Math.cos(azi) };
}

export const MOON_AT_NIGHT = { altDeg: 15, aziDeg: 150 };

function smoothstep(a, b, x) {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

const GOLDEN_CEILING_DEG = 14;
export const GOLDEN_CEILING_PHYSICAL_DEG = 6;

const ALT_DAY = Math.sin(GOLDEN_CEILING_DEG * DEG);
const ALT_GOLDEN = 0;

const ALT_CIVIL = Math.sin(-9 * DEG);
const ALT_NIGHT = Math.sin(-12 * DEG);

export const BOOT_TIME_OF_DAY = 0.36;
const ALT_ANCHOR = sunVector(BOOT_TIME_OF_DAY, DEFAULT_LATITUDE_DEG).y;
const ALT_HIGH = sunVector(0.5, DEFAULT_LATITUDE_DEG).y;
const ALT_DEEP = sunVector(0, DEFAULT_LATITUDE_DEG).y;

export function nightFactor(sunUp) {
	return 1 - smoothstep(ALT_NIGHT, ALT_GOLDEN, sunUp);
}

export function dayFactor(sunUp) {
	return smoothstep(Math.sin(-3 * DEG), ALT_GOLDEN, sunUp);
}

export function skyPhase(sunUp) {
	if (sunUp <= ALT_NIGHT) return 0;
	if (sunUp >= ALT_DAY) return 1;
	if (sunUp <= ALT_GOLDEN) return (0.5 * (sunUp - ALT_NIGHT)) / (ALT_GOLDEN - ALT_NIGHT);
	return 0.5 + (0.5 * sunUp) / ALT_DAY;
}

const SUN_TINT_NEUTRAL = '#fff2d8';
const SUN_LIGHT_NEUTRAL = '#fff1e0';
const HEMI_SKY_NEUTRAL = '#c6edff';

export const NIGHT_GROUNDS = {

	moonlit: [0.557, 0.581, 1.094],

	ash: [0.630, 0.420, 0.784],

	graphite: [0.478, 0.319, 0.595],

	pewter: [0.804, 0.536, 1.000],

	slate: [0.565, 0.420, 0.919],

	steel: [0.543, 0.413, 0.973],
};

export let NIGHT_GROUND = 'graphite';

export const NIGHT = {
	name: 'night',
	exposure: 1.05,
	sunIntensity: 0.0,
	moonIntensity: 0.35,
	hemiIntensity: 0.75,
	skyZenith: '#0c1b38',
	skyHorizon: '#20304e',
	skyGround: '#0a1119',
	skyBand: '#1a2348',

	skyBandAmt: 0,
	fogNear: 400,
	fogFar: 2600,
	sunTint: SUN_TINT_NEUTRAL,
	sunColor: '#9fb4d8',
	hemiSky: '#26364f',
	starAmt: 1,

	world: {
		road: [1.214, 1.234, 1.224],
		slab: [1.214, 1.234, 1.224],
		junctions: [1.214, 1.234, 1.224],

		ground: NIGHT_GROUNDS[NIGHT_GROUND],

		surfaces: Object.assign([0.304, 0.354, 0.618], { desat: 0.85 }),
		paint: [0.363, 0.405, 0.487],
		buildings: [0.34, 0.37, 0.48],

		garages: [0.363, 0.405, 0.487],
		piers: [0.363, 0.405, 0.487],
	},
};

export const DUSK = {
	name: 'dusk',
	exposure: 1.05,
	sunIntensity: 2.0,
	moonIntensity: 0.18,
	hemiIntensity: 1.3,
	skyZenith: '#1c2c48',
	skyHorizon: '#46566d',
	skyGround: '#1b232e',

	skyBand: '#6b4a86',
	skyBandAmt: 0.4,
	fogNear: 350,
	fogFar: 1800,
	sunTint: SUN_TINT_NEUTRAL,
	sunColor: SUN_LIGHT_NEUTRAL,
	hemiSky: HEMI_SKY_NEUTRAL,
	starAmt: 0.35,

	world: {
		road: [1, 1, 1],
		slab: [1, 1, 1],
		junctions: [1, 1, 1],
		ground: [0.525, 0.514, 0.547],
		surfaces: [0.518, 0.521, 0.52],
		paint: [0.521, 0.523, 0.53],
		buildings: [0.52, 0.52, 0.56],
		piers: [0.521, 0.523, 0.53],
		garages: [0.521, 0.523, 0.53],
	},
};

export const GOLDEN_GROUNDS = {

	olive: [1.35, 0.70, 0.55],

	chocolate: [1.02, 0.48, 0.65],

	rust: [1.55, 0.65, 0.78],

	tan: [1.83, 0.96, 1.24],

	taupe: [1.33, 0.77, 1.19],
};

export let GOLDEN_GROUND = 'chocolate';

export function setNightGround(name) {
	if (!NIGHT_GROUNDS[name]) return null;
	NIGHT_GROUND = name;
	NIGHT.world.ground = NIGHT_GROUNDS[name];

	for (const st of Object.values(STYLES)) {
		if (st && st.night && st.night.world && st.night.world.ground) {
			st.night.world.ground = NIGHT_GROUNDS[name];
		}
	}
	KEYFRAMES.clear();
	return name;
}

export function setGoldenGround(name) {
	if (!GOLDEN_GROUNDS[name]) return null;
	GOLDEN_GROUND = name;
	GOLDEN_HOUR.world.ground = GOLDEN_GROUNDS[name];

	KEYFRAMES.clear();
	return name;
}

export const GOLDEN_HOUR = {
	name: 'golden hour',

	exposure: 1.08,
	sunIntensity: 3.0,
	moonIntensity: 0.0,
	hemiIntensity: 1.35,

	skyZenith: '#e0313f',
	skyHorizon: '#ff9c2e',
	skyGround: '#5e3320',
	skyBand: '#f2414a',
	skyBandAmt: 0.70,
	fogNear: 500,
	fogFar: 3000,
	sunTint: '#ffd9a0',
	sunColor: '#ffb968',
	hemiSky: '#ffd0a0',
	starAmt: 0,

	world: {
		road: [1, 1, 1],
		slab: [1, 1, 1],
		junctions: [1, 1, 1],

		ground: GOLDEN_GROUNDS[GOLDEN_GROUND],
		surfaces: [0.929, 0.882, 0.765],
		paint: [0.856, 0.757, 0.591],
		buildings: [1.00, 0.94, 0.84],
		piers: [0.856, 0.757, 0.591],
		garages: [0.856, 0.757, 0.591],
	},
};

export const DAY = {
	name: 'day',
	exposure: 1.15,
	sunIntensity: 3.2,
	moonIntensity: 0.0,
	hemiIntensity: 1.7,
	skyZenith: '#3f78c0',
	skyHorizon: '#cfe0ec',
	skyGround: '#9aa7b0',
	skyBand: '#a9d7f0',
	skyBandAmt: 0.12,
	fogNear: 700,
	fogFar: 3400,
	sunTint: SUN_TINT_NEUTRAL,
	sunColor: SUN_LIGHT_NEUTRAL,
	hemiSky: HEMI_SKY_NEUTRAL,
	starAmt: 0,

	world: {
		road: [1, 1, 1],
		slab: [1, 1, 1],
		junctions: [1, 1, 1],
		ground: [1, 1, 1],
		surfaces: [1, 1, 1],
		paint: [1, 1, 1],
		buildings: [1, 1, 1],
		garages: [1, 1, 1],
		piers: [1, 1, 1],
	},
};

export const STYLES = {

	'first-pass': {
		label: 'first pass',
		blurb: 'The sky you approved. Hemisphere ambient only, smooth shading, bench greys.',
		day: {},
		env: 0,
		flat: false,
		matte: false,
		tone: 'aces',
		world: 'bench',
	},

	sunlit: {
		label: 'sunlit',
		blurb: 'Image-based ambient, strong key, saturated world tones. Colour that holds its '
			+ 'shadows instead of washing out.',
		day: {
			sunIntensity: 4.0,
			hemiIntensity: 1.1,
			skyZenith: '#4d8ed6',
			skyHorizon: '#d6e8f4',
			fogNear: 1400,
			fogFar: 5200,
		},
		env: 1.35,
		flat: false,
		matte: false,
		tone: 'aces',
		world: 'bright',
	},

	origami: {
		label: 'origami',
		blurb: 'Flat shading — every facet one tone, folded-paper. Matte, bright, and the '
			+ 'cheapest to draw: no extra geometry, and it kills the specular pass.',
		day: {
			sunIntensity: 3.6,
			hemiIntensity: 2.4,
			skyZenith: '#5fa8e8',
			skyHorizon: '#dceef8',
			skyBandAmt: 0.06,
			fogNear: 2000,
			fogFar: 6000,
		},
		env: 0.25,
		flat: true,
		matte: true,
		tone: 'cineon',
		world: 'poster',
	},

	'standard': {
		label: 'standard',
		blurb: 'Their daytime look, transcribed: bright flat sky, near-white faceted clouds, dark '
			+ 'saturated world under a very high fill.',

		day: {
			sunIntensity: 4.0,
			hemiIntensity: 3.9,
			skyZenith: '#7fbdff',
			skyHorizon: '#c2e2fe',
			skyGround: '#cbdae6',
			skyBand: '#9fd4fb',
			skyBandAmt: 0.1,
			fogNear: 1600,
			fogFar: 6000,
			sunTint: '#ffffff',
			sunColor: '#ffe9b8',
			hemiSky: '#f2f2f0',
		},

		night: {
			sunIntensity: 0.0,
			moonIntensity: 0.90,
			hemiIntensity: 1.90,
			exposure: 1.12,

			hemiSky: '#3a5170',
			world: {

				road: [1.214, 1.234, 1.224],
				slab: [1.214, 1.234, 1.224],
				junctions: [1.214, 1.234, 1.224],

				ground: Object.assign([0.478, 0.319, 0.595],
					{ tint: [0.93, 1.00, 1.12] }),

				surfaces: Object.assign([0.42, 0.47, 0.72],
					{ desat: 0.85, tint: [0.93, 1.00, 1.12] }),

				paint: [0.95, 0.97, 1.05],

				buildings: [0.52, 0.56, 0.68],
				garages: [0.55, 0.58, 0.68],
				piers: [0.55, 0.58, 0.68],
			},
		},
		env: 1.8,
		flat: false,
		matte: false,
		tone: 'aces',

		world: 'bright',

		clouds: 0.85,
		cloudKind: 'low',

		cloudShade: 0.45,

		road: 'off',
	},

	overcast: {
		label: 'overcast',
		blurb: 'Soft, high ambient and a low key. The other end of the contrast range.',
		day: {
			sunIntensity: 1.6,
			hemiIntensity: 2.2,
			skyZenith: '#8fa4b8',
			skyHorizon: '#cdd6dd',
			skyBandAmt: 0.03,
			fogNear: 500,
			fogFar: 2800,
		},
		env: 1.1,
		flat: false,
		matte: true,
		tone: 'reinhard',
		world: 'bench',
	},

	vaporwave: {
		label: 'vaporwave — pink sky',
		blurb: 'Pink sky, electric-blue clouds, violet carriageway over a near-black floor. '
			+ 'The default arm: "I prefer the cyber neon option with the pink sky."',

		day: {
			sunIntensity: 4.0,
			hemiIntensity: 3.9,
			skyZenith: '#7cc7ff',
			skyHorizon: '#f6d1e9',
			skyGround: '#efc5e1',
			skyBand: '#eea8d6',
			skyBandAmt: 0.1,
			fogNear: 1600,
			fogFar: 6000,
			sunTint: '#ffffff',
			sunColor: '#ffc5dd',
			hemiSky: '#f6fbfe',
			exposure: 0.930,
			cloudTint: '#00e5ff',
		},
		golden: {
			skyZenith: '#1483e4',
			skyHorizon: '#ff2f74',
			skyGround: '#112231',
			skyBand: '#ff207a',
			sunTint: '#ffa8cc',
			sunColor: '#ff67a6',
			hemiSky: '#abd8f8',
			exposure: 0.930,
			cloudTint: '#00e5ff',
		},
		dusk: {
			skyZenith: '#001423',
			skyHorizon: '#0c4577',
			skyGround: '#000102',
			skyBand: '#234a97',
			sunTint: '#ffeaf2',
			sunColor: '#fff3f8',
			hemiSky: '#d2edff',
			exposure: 0.849,
			cloudTint: '#00e5ff',
		},
		night: {
			skyZenith: '#000000',
			skyHorizon: '#00182f',
			skyGround: '#000000',
			skyBand: '#001020',
			sunTint: '#ffeaf2',
			sunColor: '#f477bc',
			hemiSky: '#001f37',
			exposure: 0.849,
			cloudTint: '#00e5ff',
		},

		env: 2.41,
		flat: false,
		matte: false,
		tone: 'aces',
		world: 'vaporwave',
		clouds: 0.42,
		cloudKind: 'low',
		cloudShade: 0.45,
		road: 'off',

		grid: 'cyan',

		buildings: 'neon',
		neon: true,

		tree: {

			shades: [
				{ base: 0x1a0d04, glow: 0xff7a1f },
				{ base: 0x1c0a04, glow: 0xff5c14 },
				{ base: 0x200f06, glow: 0xff9a3d },
				{ base: 0x1a0b06, glow: 0xff6b33 },
				{ base: 0x1e1006, glow: 0xffb05c },
			],
			glowI: 0.8,
			bark: 0xc2ccd6,
		},
	},

	'vaporwave-blue': {
		label: 'vaporwave — blue sky',
		blurb: 'The blue sky with pink clouds, and the soft orange sunset the grade found on '
			+ 'its own. Same neon world underneath.',
		day: {
			sunIntensity: 4.0,
			hemiIntensity: 3.9,
			skyZenith: '#8ddfff',
			skyHorizon: '#d9e0fb',
			skyGround: '#d7dbeb',
			skyBand: '#becdf9',
			skyBandAmt: 0.1,
			fogNear: 1600,
			fogFar: 6000,
			sunTint: '#ffffff',
			sunColor: '#ffd9d6',
			hemiSky: '#f2f9f7',
			exposure: 1.196,
			cloudTint: '#ff11e6',
		},
		golden: {
			skyZenith: '#9d8891',
			skyHorizon: '#ff8b64',
			skyGround: '#624f3a',
			skyBand: '#ff4670',
			sunTint: '#ffc7c7',
			sunColor: '#ff9fa3',
			hemiSky: '#dae8d1',
			exposure: 1.196,
			cloudTint: '#ff11e6',
		},
		dusk: {
			skyZenith: '#18516b',
			skyHorizon: '#4a6c84',
			skyGround: '#233847',
			skyBand: '#6a63a0',
			sunTint: '#ffecea',
			sunColor: '#ffeff0',
			hemiSky: '#d0f7ff',
			exposure: 1.092,
			cloudTint: '#ff11e6',
		},
		night: {
			skyZenith: '#083e5d',
			skyHorizon: '#20496c',
			skyGround: '#0f2836',
			skyBand: '#193c68',
			sunTint: '#ffecea',
			sunColor: '#c4aadd',
			hemiSky: '#1f5d73',
			exposure: 1.092,
			cloudTint: '#ff11e6',
		},
		env: 2.41,
		flat: false,
		matte: false,
		tone: 'aces',
		world: 'vaporwave',
		clouds: 0.42,
		cloudKind: 'low',
		cloudShade: 0.45,
		road: 'off',
		grid: 'magenta',

		buildings: 'neon',
		neon: true,

		tree: {

			shades: [
				{ base: 0x1a0d04, glow: 0xff7a1f },
				{ base: 0x1c0a04, glow: 0xff5c14 },
				{ base: 0x200f06, glow: 0xff9a3d },
				{ base: 0x1a0b06, glow: 0xff6b33 },
				{ base: 0x1e1006, glow: 0xffb05c },
			],
			glowI: 0.8,
			bark: 0xc2ccd6,
		},
	},
};

export const DEFAULT_STYLE = 'standard';

export const SKY_BLUES = {
	style: { label: 'as the style says' },
	standard: { label: 'standard', skyZenith: '#7fbdff', skyHorizon: '#c2e2fe' },
	accent: { label: 'accent (unlightened)', skyZenith: '#58a6ff', skyHorizon: '#b9dcfb' },
	azure: { label: 'azure', skyZenith: '#5aa6ff', skyHorizon: '#c8e6ff' },
	sky: { label: 'sky', skyZenith: '#8ecbff', skyHorizon: '#d4edff' },
	powder: { label: 'powder', skyZenith: '#a3d5ff', skyHorizon: '#e2f2ff' },
	cobalt: { label: 'cobalt', skyZenith: '#3d7fd6', skyHorizon: '#a9cdeb' },
	'first-pass': { label: 'first pass', skyZenith: '#3f78c0', skyHorizon: '#cfe0ec' },
};

export const DEFAULT_BLUE = 'style';

export function blueSpread(id) {
	const b = SKY_BLUES[id];
	if (!b || !b.skyZenith) return null;
	const v = (h) => {
		const n = parseInt(h.slice(1), 16);
		return (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 765;
	};
	return Math.abs(v(b.skyHorizon) - v(b.skyZenith));
}

const lerp = (a, b, t) => a + (b - a) * t;

export function lerpHex(a, b, t) {
	if (t <= 0) return a;
	if (t >= 1) return b;
	const A = oklabOf(a), B = oklabOf(b);
	return hexOfOklab(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function oklabOf(hex) {
	const v = parseInt(hex.slice(1), 16);
	const r = toLinear(((v >> 16) & 255) / 255);
	const g = toLinear(((v >> 8) & 255) / 255);
	const bl = toLinear((v & 255) / 255);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
	return [
		0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
	];
}

function hexOfOklab(L, A, B) {
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
	const ch = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
	].map((c) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, Math.min(1, c))) * 255))));
	return `#${((ch[0] << 16) | (ch[1] << 8) | ch[2]).toString(16).padStart(6, '0')}`;
}

const NUMERIC = ['exposure', 'sunIntensity', 'moonIntensity', 'hemiIntensity',
	'skyBandAmt', 'fogNear', 'fogFar', 'starAmt'];
const COLOUR = ['skyZenith', 'skyHorizon', 'skyGround', 'skyBand', 'sunTint',
	'sunColor', 'hemiSky'];

const WORLD_CLASSES = ['road', 'slab', 'junctions', 'ground', 'surfaces', 'paint',
	'buildings', 'garages', 'piers'];

function blend(a, b, t) {
	const out = { name: t < 0.5 ? a.name : b.name };
	for (const k of NUMERIC) out[k] = lerp(a[k], b[k], t);
	for (const k of COLOUR) out[k] = lerpHex(a[k], b[k], t);

	out.world = {};
	for (const k of WORLD_CLASSES) {
		const ga = (a.world && a.world[k]) || ONE;
		const gb = (b.world && b.world[k]) || ONE;
		out.world[k] = [lerp(ga[0], gb[0], t), lerp(ga[1], gb[1], t),
			lerp(ga[2], gb[2], t)];

		const da = ga.desat || 0;
		const db = gb.desat || 0;
		if (da || db) out.world[k].desat = lerp(da, db, t);

		const ta = ga.tint;
		const tb = gb.tint;
		if (ta || tb) {
			const A = ta || ONE;
			const B = tb || ONE;
			out.world[k].tint = [lerp(A[0], B[0], t), lerp(A[1], B[1], t),
				lerp(A[2], B[2], t)];
		}
	}

	if (a.cloudTint || b.cloudTint) {
		out.cloudTint = lerpHex(a.cloudTint || b.cloudTint, b.cloudTint || a.cloudTint, t);
	}
	return out;
}

const ONE = [1, 1, 1];

function shade(hex, dL, dC) {
	const [L, a, b] = oklabOf(hex);
	return hexOfOklab(L * dL, a * dC, b * dC);
}

function companion(base, name, mul, tint) {
	const out = { ...base, name };
	for (const k in mul) out[k] = base[k] * mul[k];
	for (const k in tint) {
		if (base[k]) out[k] = shade(base[k], tint[k][0], tint[k][1]);
	}
	return out;
}

function noonOf(day) {
	return companion(day, 'noon', {
		sunIntensity: 1.05, hemiIntensity: 1.03, exposure: 0.99,
		skyBandAmt: 0.78, fogNear: 1.04, fogFar: 1.07,
	}, {
		skyZenith: [0.97, 1.06], skyHorizon: [1.02, 0.95],
		skyBand: [1.01, 0.97], skyGround: [1.02, 0.98],
	});
}

function shoulderOf(day) {
	return companion(day, 'day', {
		sunIntensity: 0.96, hemiIntensity: 0.98, exposure: 1.01,
		skyBandAmt: 1.20, fogNear: 0.97, fogFar: 0.94,
	}, {
		skyZenith: [1.03, 0.95], skyHorizon: [0.99, 1.04],
		skyBand: [1.00, 1.02], skyGround: [0.99, 1.01],
	});
}

function midnightOf(night) {
	return companion(night, 'night', {
		moonIntensity: 1.12, hemiIntensity: 0.88, exposure: 0.97,
		fogNear: 0.90, fogFar: 0.88,
	}, {
		skyZenith: [0.78, 1.06], skyHorizon: [0.76, 1.04],
		skyGround: [0.82, 1.0], skyBand: [0.80, 1.0],
	});
}

const KEYFRAMES = new Map();

function keyframes(style, blue, arm) {

	const cacheKey = `${style}::${blue}::${arm}`;
	const hit = KEYFRAMES.get(cacheKey);
	if (hit) return hit;

	const s = STYLES[style];
	let day = s && s.day ? { ...DAY, ...s.day, name: 'day' } : DAY;

	const armSpec = s && s.golden ? null : GOLDEN_ARMS[arm];
	const golden = s && s.golden
		? { ...GOLDEN_HOUR, ...s.golden, name: 'golden hour' }
		: (armSpec && armSpec.skyZenith

			? { ...GOLDEN_HOUR, ...armSpec, label: undefined, name: 'golden hour' }
			: GOLDEN_HOUR);
	const dusk = s && s.dusk ? { ...DUSK, ...s.dusk, name: 'dusk' } : DUSK;
	const night = s && s.night ? { ...NIGHT, ...s.night, name: 'night' } : NIGHT;

	const b = SKY_BLUES[blue];
	if (b && b.skyZenith) {
		day = { ...day, skyZenith: b.skyZenith, skyHorizon: b.skyHorizon, name: 'day' };
	}

	const set = { day, golden, dusk, night,
		noon: noonOf(day), shoulder: shoulderOf(day), midnight: midnightOf(night) };
	KEYFRAMES.set(cacheKey, set);
	return set;
}

export function lookAt(timeOfDay, latitudeDeg = DEFAULT_LATITUDE_DEG,
	style = DEFAULT_STYLE, blue = DEFAULT_BLUE, goldenArm = DEFAULT_GOLDEN) {
	const sun = sunVector(timeOfDay, latitudeDeg);
	const moon = moonVector(timeOfDay, latitudeDeg);
	const up = sun.y;

	const { day, golden, dusk, night, noon, shoulder, midnight }
		= keyframes(style, blue, goldenArm);

	let look;
	if (up >= ALT_HIGH) look = blend(noon, noon, 0);
	else if (up >= ALT_ANCHOR) look = blend(day, noon, (up - ALT_ANCHOR) / (ALT_HIGH - ALT_ANCHOR));
	else if (up >= ALT_DAY) look = blend(shoulder, day, (up - ALT_DAY) / (ALT_ANCHOR - ALT_DAY));
	else if (up >= ALT_GOLDEN) look = blend(golden, shoulder, up / ALT_DAY);
	else if (up >= ALT_CIVIL) look = blend(dusk, golden, (up - ALT_CIVIL) / -ALT_CIVIL);
	else if (up >= ALT_NIGHT) look = blend(night, dusk, (up - ALT_NIGHT) / (ALT_CIVIL - ALT_NIGHT));
	else if (up >= ALT_DEEP) look = blend(midnight, night, (up - ALT_DEEP) / (ALT_NIGHT - ALT_DEEP));
	else look = blend(midnight, midnight, 0);
	return { sun, moon, look, sunUp: up, phase: skyPhase(up),
		night: nightFactor(up), day: dayFactor(up) };
}

export const GOLDEN_ARMS = {

	upstream: {
		label: 'natural (standard)',
		skyZenith: '#2f6bb4',
		skyHorizon: '#f0a45e',
		skyGround: '#8f6a4e',
		skyBand: '#ff5f9e',
		skyBandAmt: 0.55,
		hemiSky: HEMI_SKY_NEUTRAL,
	},

	red: { label: 'red sky (2026-08-20)' },
};

export const DEFAULT_GOLDEN = 'upstream';

export const PRESETS = [
	{ id: 'dawn', label: 'dawn', t: 0.255 },
	{ id: 'morning', label: 'morning', t: 0.34 },
	{ id: 'noon', label: 'noon', t: 0.5 },
	{ id: 'afternoon', label: 'afternoon', t: 0.66 },
	{ id: 'golden', label: 'golden hour', t: 0.735 },

	{ id: 'sunset', label: 'sunset', t: 0.750 },
	{ id: 'afterglow', label: 'afterglow', t: 0.764 },
	{ id: 'dusk', label: 'dusk', t: 0.782 },
	{ id: 'night', label: 'night', t: 0.95 },
];

export function clockText(t) {
	const mins = Math.round(((t % 1) + 1) % 1 * 24 * 60);
	return `${String(Math.floor(mins / 60)).padStart(2, '0')}:`
		+ `${String(mins % 60).padStart(2, '0')}`;
}
