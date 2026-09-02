const LEVEL_NAME = (typeof window !== 'undefined' && window.__levelName) || "Strata 01";

import * as THREE from 'three';
import { newGLTFLoader } from './glbload.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	initRapier, createPhysicsWorld, createVehicle, parityLine, addTrimeshCollider,
	GROUND_FRICTION,
	HANDLING_ORDER, DRIVEN_DEFAULTS, FIXED_DT, GRAVITY_Y, setCarLamps,
	DRIFT_MODES, setDriftMode, getDriftMode, setDriftAngle, getDriftAngle,
	setDriftCatch, getDriftCatch, setDriftGain, getDriftGain, setHbSlip, getHbSlip,
	STEER_FEELS, setSteerFeel, getSteerFeel, setSteerCurve, getSteerCurve,
	setSteerLock, getSteerLock,
	POWER_LEVELS, setPowerLevel, getPowerLevel, setPower, getPower,
} from './vehicle.js';
import { JitterMeter } from './jitter.js';
import {
	CAMERAS, CAM_ZOOM_STEPS, applyCamera, setLagMode,
	setViewAngles, setFovTrim, currentFov, VIEW_PITCH_LIMIT, setFrameBelow,
	setSpeedFovGain, speedFovApplied, cameraReadout, framingProbe,
	cameraOrder, setTiltTrim, getTiltTrim,
	TURN_MODES, setTurnMode, getTurnMode, setCraneMode, getCraneMode, setFreeLook,
	defaultCamera, setStabilise, getStabilise,
	setSteady, getSteady, setPinBoom, getPinBoom, setPinRate, getPinRate,
	setPinAnchorRate, getPinAnchorRate,
	setHoldFrame, getHoldFrame,
	setHoldAim, getHoldAim,
	setBoomMode, getBoomMode,
	setBoomPull, getBoomPull,
	setRigSwing, getRigSwing,
	setFitCar, getFitCar,
	setTiltStops,
} from './chasecam.js';
import { WORLD_TONES, TONE_CLASSES, toneHex, gradeTone, GRADES, DEFAULT_GRADE,
	gradeWorld, mixTone } from './tones.js';

import { TINT_LEVELS, SHADE_LEVELS } from './buildingtint.js';

import { WINDOW_SIZES } from './windows.js';

import { DEFAULT_CAR, CAR_LOOK } from './carmesh.js';

const CHUNK = window.__level;

function _vec3Param(name) {
	const raw = new URLSearchParams(location.search).get(name);
	if (!raw) return null;
	const parts = raw.split(',').map((v) => parseFloat(v));
	return parts.length === 3 && parts.every(Number.isFinite) ? parts : null;
}
const EYE = _vec3Param('eye');
const LOOK_AT = _vec3Param('at');

let RAPIER = null;
let world = null;
let car = null;
let chunk = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b0d6);
scene.fog = new THREE.Fog(0x93b0d6, 900, 2600);

const camera = new THREE.PerspectiveCamera(
	62, window.innerWidth / window.innerHeight, 0.1, 10000);

const renderer = new THREE.WebGLRenderer({

	antialias: (window.devicePixelRatio || 1) < 2,

	logarithmicDepthBuffer: false,

	powerPreference: 'high-performance',
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3) * 0.5);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

let lighting = null;

const lightFocus = new THREE.Vector3();

const trafficFocus = new THREE.Vector3();

const TIME_AT_BOOT = (() => {
	const q = parseFloat(new URLSearchParams(location.search).get('time'));
	return Number.isFinite(q) ? ((q % 1) + 1) % 1 : 0.36;
})();

let worldTones = 'bright';

let categoryTones = true;

let pavements = true;

function applyPavements() {
	const L = chunk.layers && chunk.layers.surfaces;
	if (!L || !L.root) return;
	L.root.traverse((o) => {
		if (o.isMesh && o.userData && o.userData.category === 'path') {
			o.visible = pavements;
		}
	});
}

const WELD_LAYERS = ['ground', 'surfaces'];

const UNQUANTISE_LAYERS = ['ground', 'surfaces', 'buildings'];
let weldNormals = true;

let variedBuildings = true;

let garageDeckAsRoad = true;

let garageCars = null;

let garageFootprints = null;
let garageCarsOn = true;
let garageFill = 0.5;

let buildingsTinted = false;
let tintMod = null;

let buildingTintLevel = 'bold';

let tintedAtLevel = null;

let buildingShade = 'deep';

let tintedAtShade = null;

let windowsOn = true;

let windowSize = 'upstream';
let winMod = null;
let windowGroup = null;
let windowStats = null;

let neonOn = false;

let windowsLit = true;

let neonMinHeight = 4;
let neonMod = null;
let neonEdges = null;

async function applyWindows(want) {
	const layer = chunk && chunk.layers && chunk.layers.buildings;
	if (!layer || !layer.root) return null;
	if (want && !winMod) {
		try {
			winMod = await import(`./windows.js${MODULE_STAMP}`);
		} catch (err) {
			console.warn('[windows] unavailable:', err);
			return null;
		}
	}

	if (windowGroup) {
		if (windowGroup.parent) windowGroup.parent.remove(windowGroup);
		windowGroup.traverse((o) => {
			if (!o.isMesh) return;
			o.geometry.dispose();
			o.material.dispose();
		});
		windowGroup = null;
	}
	if (!want) { windowStats = null; return null; }

	const gl = chunk.layers && chunk.layers.ground;
	const ground = winMod.groundGrid(gl && gl.root ? gl.root : null);
	const built = winMod.buildWindows(layer.root, {
		size: windowSize, ground, lit: windowsLit,
	});
	windowGroup = built.group;
	layer.root.add(windowGroup);

	if (lighting) lighting.dress(windowGroup, { cast: false, receive: true });
	windowStats = built;
	;
	return built;
}

async function applyNeon(want) {
	const layer = chunk && chunk.layers && chunk.layers.buildings;
	if (!layer || !layer.root) return null;
	if (want && !neonMod) {
		try {
			neonMod = await import(`./neonedges.js${MODULE_STAMP}`);
		} catch (err) {
			console.warn('[neon] unavailable:', err);
			return null;
		}
	}
	if (neonEdges) { neonEdges.dispose(); neonEdges = null; }
	if (!want) return null;
	const built = neonMod.buildNeonEdges(layer.root, { minHeight: neonMinHeight });
	neonEdges = built;

	built.setResolution(renderer.domElement.width, renderer.domElement.height);
	const s = built.stats;
	;
	return built;
}

let lastTintPass = null;

async function applyBuildingTint(want) {
	const layer = chunk && chunk.layers && chunk.layers.buildings;
	if (!layer || !layer.root) return;
	if (want && !tintMod) {
		try {
			tintMod = await import(`./buildingtint.js${MODULE_STAMP}`);
		} catch (err) {
			console.warn('[buildings] tint unavailable:', err);
			return;
		}
	}
	layer.root.traverse((o) => {
		if (!o.isMesh || !o.material) return;

		if (o.geometry && o.geometry.userData && o.geometry.userData.windows) return;
		o.material.vertexColors = want;

		o.material.needsUpdate = true;
	});
	let painted = 0;
	if (want && (!buildingsTinted || tintedAtLevel !== buildingTintLevel
			|| tintedAtShade !== buildingShade)) {
		painted = tintMod.tintBuildings(layer.root, buildingTintLevel, buildingShade);
		tintedAtLevel = buildingTintLevel;
		tintedAtShade = buildingShade;
		;
	}
	buildingsTinted = want;

	if (painted || (windowsOn && !windowGroup)) await applyWindows(windowsOn);

	if (painted || (neonOn && !neonEdges)) await applyNeon(neonOn);

	return { painted, sat: medianTintSat(layer.root) };
}

function medianTintSat(root) {
	const vals = [];
	root.traverse((o) => {
		if (!o.isMesh || !o.geometry) return;
		const c = o.geometry.getAttribute('color');
		if (!c) return;

		for (let i = 0; i < c.count; i += 97) {
			const r = c.getX(i); const g = c.getY(i); const b = c.getZ(i);
			const hi = Math.max(r, g, b); const lo = Math.min(r, g, b);
			vals.push(hi <= 0 ? 0 : (hi - lo) / hi);
		}
	});
	if (!vals.length) return null;
	vals.sort((a, b) => a - b);
	return vals[Math.floor(vals.length / 2)];
}

function worldGrade() {

	const s = lighting && lighting.look;
	return (s && s.look && s.look.world) || null;
}

let worldGradeName = DEFAULT_GRADE;

function ambientHex() {
	const s = lighting && lighting.look;
	const h = s && s.look && s.look.skyHorizon;
	return h ? parseInt(h.slice(1), 16) : null;
}

function tonedFrom(base, key) {
	const G = worldGrade();
	return gradeWorld(base, G && G[key], ambientHex(),
		GRADES[worldGradeName] || GRADES.off);
}

function tonedColour(key) {
	const P = WORLD_TONES[worldTones] || WORLD_TONES.bench;
	if (P[key] === undefined) return undefined;
	return tonedFrom(P[key], key);
}

function applyWorldTones() {
	const P = WORLD_TONES[worldTones] || WORLD_TONES.bench;
	if (chunk && chunk.layers) {
		for (const spec of LAYERS) {
			const L = chunk.layers[spec.key];
			if (!L || !L.root || P[spec.key] === undefined) continue;

			if (spec.key === 'buildings' && variedBuildings) {
				const G = worldGrade();
				const white = gradeWorld(0xffffff, G && G.buildings, ambientHex(),
					GRADES[worldGradeName] || GRADES.off);
				L.root.traverse((o) => {
					if (o.isMesh && o.material && o.material.color) o.material.color.setHex(white);
				});
				continue;
			}

			const hex = tonedColour(spec.key);

			const unify = spec.key === 'surfaces' && P.ground !== undefined
				? (P.unify || 0) : 0;

			const coverHex = unify
				? tonedFrom(mixTone(P[spec.key], P.ground, unify), spec.key) : hex;
			L.root.traverse((o) => {
				if (!o.isMesh || !o.material || !o.material.color) return;
				let albedo = categoryTones
					? o.material.userData.albedo : undefined;
				if (albedo !== undefined && unify) {
					albedo = mixTone(albedo, P.ground, unify);
				}

				if (spec.key === 'garages' && garageDeckAsRoad
					&& o.material.userData.role === 'deck' && P.road !== undefined) {
					o.material.color.setHex(tonedFrom(P.road, 'road'));
					return;
				}
				o.material.color.setHex(albedo === undefined
					? coverHex : tonedFrom(albedo, spec.key));
			});
		}
	}

	lastTintPass = applyBuildingTint(variedBuildings);

	const roadHex = tonedColour('road');
	for (const name in variantMesh) {
		const M = variantMesh[name];
		if (!M || !M.root) continue;
		M.root.traverse((o) => {
			if (o.isMesh && o.material && o.material.color) o.material.color.setHex(roadHex);
		});
	}
	applySheen();

	applyDebug();
	tonedSignature = signatureNow();
	tonedAtMs = performance.now();
}

const SHEEN = {
	day: null,

	sunset: { ground: 0.62, surfaces: 0.68 },

	night: null,
};

function applySheen() {
	if (!chunk || !chunk.layers) return;
	const want = SHEEN[SKY_MODES[skyMode] ? SKY_MODES[skyMode].id : 'day'] || null;
	for (const spec of LAYERS) {
		const L = chunk.layers[spec.key];
		if (!L || !L.root) continue;
		const r = want ? want[spec.key] : undefined;
		L.root.traverse((o) => {
			if (!o.isMesh || !o.material || o.material.roughness === undefined) return;

			if (o.material.userData._sheen === undefined) {
				o.material.userData._sheen = o.material.roughness;
			}
			const to = r === undefined ? o.material.userData._sheen : r;
			if (o.material.roughness !== to) o.material.roughness = to;
		});
	}
}

let tonedSignature = '';
let tonedAtMs = 0;

function signatureNow() {
	const P = WORLD_TONES[worldTones] || WORLD_TONES.bench;
	const G = worldGrade();

	const amb = ambientHex();
	const gr = GRADES[worldGradeName] || GRADES.off;

	let s = `${worldTones}/${variedBuildings}/${garageDeckAsRoad}/${worldGradeName}/${amb}`
		+ `/${buildingTintLevel}/${categoryTones}`
		+ `/${SKY_MODES[skyMode].id}`;
	for (const k of TONE_CLASSES) {
		if (P[k] === undefined) continue;
		s += ':' + gradeWorld(P[k], G && G[k], amb, gr);
	}
	return s;
}

function tickWorldTones() {
	if (!lighting || !chunk) return;
	const now = performance.now();
	if (now - tonedAtMs < 120) return;
	if (signatureNow() === tonedSignature) { tonedAtMs = now; return; }
	applyWorldTones();
}

function applyStyleExtras(id) {
	if (!lighting) return null;
	const st = lighting.styles.find((s) => s.id === id);
	if (!st) return null;
	if (WORLD_TONES[st.world]) worldTones = st.world;

	const wantTint = st.buildings && TINT_LEVELS[st.buildings] ? st.buildings : 'bold';
	if (wantTint !== buildingTintLevel) {
		buildingTintLevel = wantTint;

		buildingsTinted = false;

		if (!variedBuildings) variedBuildings = true;
	}
	neonOn = !!st.neon;

	const wantLitPanes = true;
	if (wantLitPanes !== windowsLit) {
		windowsLit = wantLitPanes;

		buildingsTinted = false;
	}
	applyWorldTones();
	if (st.clouds !== undefined) lighting.clouds = st.clouds;

	if (st.cloudKind) lighting.cloudKind = st.cloudKind;
	if (st.cloudShade !== undefined) lighting.cloudShade = st.cloudShade;
	if (st.road && ROAD_SURFACES[st.road]) {
		roadSurface = st.road;
		texOn = st.road !== 'off';
	}

	gridOn = !!st.grid;
	if (st.grid && st.grid !== 'off') gridPalette = st.grid;
	applyGrid();
	applyTreeTint(st.tree);
	applyDebug();
	return st;
}

function applyTreeTint(spec) {
	if (!forest || !forest.group) return;
	const on = spec !== undefined && spec !== null;

	const shades = on
		? (Array.isArray(spec) ? spec : (spec.shades || [spec]))
		: null;
	const gi = on && !Array.isArray(spec) && spec.glowI !== undefined ? spec.glowI : 0.55;
	const names = new Set();
	forest.group.traverse((o) => {
		if (o.isMesh && o.material && o.material.name
			&& o.material.name.startsWith('leaf-')) names.add(o.material.name);
	});
	const order = [...names].sort();

	const bark = on && !Array.isArray(spec) ? spec.bark : undefined;
	forest.group.traverse((o) => {
		if (!o.isMesh || !o.material || o.material.name !== 'tree-bark') return;
		const m = o.material;
		if (m.userData.barkBase === undefined) m.userData.barkBase = m.color.getHex();
		m.color.setHex(bark === undefined ? m.userData.barkBase : bark);
		if (m.emissive) {

			m.emissive.setHex(bark === undefined ? 0x000000 : bark);
			m.emissiveIntensity = bark === undefined ? 0 : 0.12;
		}
	});
	forest.group.traverse((o) => {
		if (!o.isMesh || !o.material || !o.material.name) return;
		if (!o.material.name.startsWith('leaf-')) return;
		const m = o.material;

		if (m.userData.leafBase === undefined) m.userData.leafBase = m.color.getHex();
		if (!on) {
			m.color.setHex(m.userData.leafBase);
			if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }

			m.roughness = 0.88;
			m.metalness = 0;
			return;
		}
		const sh = shades[Math.max(0, order.indexOf(m.name)) % shades.length];
		m.color.setHex(sh.base);

		m.roughness = 0.28;
		m.metalness = 0.15;
		if (m.emissive) {
			m.emissive.setHex(sh.glow === undefined ? sh.base : sh.glow);

			m.emissiveIntensity = sh.glowI === undefined ? gi : sh.glowI;
		}
	});
}

function dressScene() {
	if (!lighting) return;
	if (chunk && chunk.layers) {
		for (const spec of LAYERS) {
			const L = chunk.layers[spec.key];
			if (L && L.root) lighting.dress(L.root);
		}
	}
	for (const name in variantMesh) {
		const M = variantMesh[name];
		if (M && M.root) lighting.dress(M.root);
	}

	if (signals) lighting.dress(signals.group, { receive: false });

	if (forest) lighting.dress(forest.group, { receive: false });
}

let pixelScale = 0.5;

const DPR_CEIL = 3;

const isTouchDevice = () => (typeof window !== 'undefined'
	&& (('ontouchstart' in window)
		|| (navigator.maxTouchPoints || 0) > 0)
	&& (!window.matchMedia || window.matchMedia('(pointer: coarse)').matches));
const basePixelRatio = () => Math.min(window.devicePixelRatio || 1, DPR_CEIL);
function applyPixelScale() {
	renderer.setPixelRatio(basePixelRatio() * pixelScale);
	renderer.setSize(window.innerWidth, window.innerHeight);

	if (neonEdges) neonEdges.setResolution(renderer.domElement.width, renderer.domElement.height);

	try {
		renderer.render(scene, camera);
	} catch (err) {   }
}

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	applyPixelScale();
});

const CACHE_BUST = (typeof window !== 'undefined' && window.__dataStamp)
	? `?v=${window.__dataStamp}` : '';
const url = (stem, ext) => `./chunks/${stem}.${ext}${CACHE_BUST}`;

const sidecarCache = new Map();
function sidecarJson(stem, soft = false) {
	const u = url(stem, 'json');
	if (sidecarCache.has(u)) return sidecarCache.get(u);
	const p = (async () => {
		const res = await fetch(u);
		if (!res.ok) {

			if (soft) return null;
			throw new Error(`HTTP ${res.status}`);
		}
		return res.json();
	})().catch((err) => {
		sidecarCache.delete(u);
		if (soft) return null;
		throw err;
	});
	sidecarCache.set(u, p);
	return p;
}

const LAYERS = [
	{ key: 'road', drive: true, tone: 0x8d939c, bias: 'deck',
		note: 'the lane ribbons — the drivable surface itself' },
	{ key: 'slab', drive: true, tone: 0x5f646b, bias: 'slab',
		note: 'the thickness under the road, and its side walls' },
	{ key: 'ground', drive: true, tone: 0x6f7a63, bias: 'terrain',
		note: 'the fitted terrain the road is seated in' },
	{ key: 'junctions', drive: false, tone: 0x9aa0a8, bias: 'junction',
		note: 'the flat caps over junction mouths' },
	{ key: 'paint', drive: false, tone: 0xd8d8d0, bias: 'paint',
		note: 'lane lines and markings, drawn only' },

	{ key: 'surfaces', drive: false, tone: 0xb4ac96,
		note: 'ground cover: car parks, grass, water, drawn only' },

	{ key: 'buildings', drive: false, tone: 0x7d7f86,
		note: 'massing blocks, drawn only' },

	{ key: 'garages', drive: true, tone: 0xb3b0a8,
		note: 'multi-storey car parks — drawn AND driven on' },

	{ key: 'piers', drive: false, tone: 0xac736e,
		note: 'support columns under the flyovers, drawn only' },

	{ key: 'landmarks', drive: false, tone: 0xd6dbe1,
		note: 'hero structures the map names but a box cannot draw — the London Eye. '
			+ 'Scenery, never collided' },
];

const shown = LAYERS.map(() => true);

const VARIANT_REPLACES = ['road', 'slab', 'junctions'];
const ROAD_TONE = 0x8d939c;

function roadTone() {
	if (roadTint !== 'palette' && ROAD_TINTS[roadTint]) return ROAD_TINTS[roadTint].hex;
	const P = WORLD_TONES[worldTones] || WORLD_TONES.bench;
	return P.road === undefined ? ROAD_TONE : P.road;
}

const ROAD_TINTS = {
	palette: { label: 'from the world palette', hex: 0 },
	bitumen: { label: 'fresh bitumen', hex: 0x2a2f3a },
	slate: { label: 'slate', hex: 0x3f4653 },
	graphite: { label: 'graphite', hex: 0x4a4f57 },
	weathered: { label: 'weathered', hex: 0x585349 },
	concrete: { label: 'concrete', hex: 0x6f7168 },
	bench: { label: 'bench grey', hex: 0x8d939c },
};
let roadTint = 'palette';

let variants = [];
let variantIndex = 0;
const variantMesh = Object.create(null);

const activeVariant = () => (variants.length ? variants[variantIndex] || null : null);
const variantName = () => (activeVariant() ? activeVariant().name : 'tile');

const HOLE_TONE = 0xff3b2f;
const EDGE_TONE = 0x35e0ff;
const SEAM_UP_MIN = 0.5;
let seamsOn = false;
let wireOn = false;
const seamCache = Object.create(null);

function roadRoots() {
	const v = activeVariant();
	if (v) {
		const M = variantMesh[v.name];
		return M ? [M.root] : [];
	}
	return VARIANT_REPLACES
		.map((key) => chunk.layers[key])
		.filter((L) => L && L.root.visible)
		.map((L) => L.root);
}

const vkey = (x, y, z) => `${Math.round(x * 1000)},${Math.round(y * 1000)},`
	+ `${Math.round(z * 1000)}`;

function buildSeams(roots) {
	const top = new Map();
	const wall = new Set();
	const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
	const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
	const corner = [a, b, c];

	for (const root of roots) {
		root.updateWorldMatrix(true, true);
		root.traverse((o) => {
			if (!o.isMesh) return;
			const pos = o.geometry.attributes.position;
			const idx = o.geometry.index;
			const count = idx ? idx.count : pos.count;
			for (let i = 0; i + 2 < count; i += 3) {
				for (let k = 0; k < 3; k++) {
					corner[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k)
						.applyMatrix4(o.matrixWorld);
				}
				nrm.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
				if (nrm.lengthSq() < 1e-18) continue;
				const up = nrm.normalize().y;
				const isTop = up >= SEAM_UP_MIN;
				const isWall = Math.abs(up) < SEAM_UP_MIN;
				if (!isTop && !isWall) continue;
				for (let k = 0; k < 3; k++) {
					const p = corner[k], q = corner[(k + 1) % 3];
					const kp = vkey(p.x, p.y, p.z), kq = vkey(q.x, q.y, q.z);
					if (kp === kq) continue;
					const key = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
					if (isWall) { wall.add(key); continue; }
					const hit = top.get(key);
					if (hit) hit.n++;
					else top.set(key, { n: 1, p: p.clone(), q: q.clone() });
				}
			}
		});
	}

	const pts = { hole: [], edge: [] };
	const len = { hole: 0, edge: 0 };
	for (const [key, e] of top) {
		if (e.n !== 1) continue;
		const kind = wall.has(key) ? 'edge' : 'hole';
		pts[kind].push(e.p.x, e.p.y, e.p.z, e.q.x, e.q.y, e.q.z);
		len[kind] += e.p.distanceTo(e.q);
	}

	const group = new THREE.Group();
	for (const [kind, tone] of [['edge', EDGE_TONE], ['hole', HOLE_TONE]]) {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(pts[kind], 3));

		const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
			color: tone, depthTest: false, depthWrite: false,
			transparent: true, opacity: kind === 'hole' ? 1.0 : 0.5,
		}));
		line.renderOrder = kind === 'hole' ? 1000 : 999;
		group.add(line);
	}
	group.visible = false;
	scene.add(group);
	return { line: group, holes: len.hole, edges: len.edge,
		length: len.hole + len.edge };
}

function seams() {
	const name = variantName();
	if (!seamCache[name]) seamCache[name] = buildSeams(roadRoots());
	return seamCache[name];
}

function applyDebug() {
	for (const name in seamCache) seamCache[name].line.visible = false;
	if (seamsOn) seams().line.visible = true;
	for (const root of roadRoots()) {
		root.traverse((o) => {
			if (!o.isMesh) return;
			o.material.wireframe = wireOn;

			o.material.vertexColors = rainbowOn && !!o.geometry.attributes.color;

			const uv = !!o.geometry.attributes.uv;
			o.material.map = (texOn && uv) ? surfaceTexture(roadSurface) : null;

			o.material.color.setHex(o.material.vertexColors ? 0xffffff : roadTone());
			o.material.needsUpdate = true;

			const g = o.geometry;
			if (!g.userData.smoothNormal && g.attributes.normal) {
				g.userData.smoothNormal = g.attributes.normal;
			}
			if (flatOn) {
				if (!g.userData.flatNormal) {
					g.computeVertexNormals();
					g.userData.flatNormal = g.attributes.normal;
				}
				g.setAttribute('normal', g.userData.flatNormal);
			} else if (g.userData.smoothNormal) {
				g.setAttribute('normal', g.userData.smoothNormal);
			}
			g.attributes.normal.needsUpdate = true;
		});
	}
}

const TEX_TILE_M = 2.0;

let texOn = true;

function wrapNoise(size, cells, rng) {
	const g = new Float32Array(cells * cells);
	for (let i = 0; i < g.length; i++) g[i] = rng();
	const out = new Float32Array(size * size);
	const scale = cells / size;
	for (let y = 0; y < size; y++) {
		const fy = y * scale, y0 = Math.floor(fy), ty = fy - y0;
		for (let x = 0; x < size; x++) {
			const fx = x * scale, x0 = Math.floor(fx), tx = fx - x0;
			const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
			const a = g[(y0 % cells) * cells + (x0 % cells)];
			const b = g[(y0 % cells) * cells + x1];
			const c = g[y1 * cells + (x0 % cells)];
			const d = g[y1 * cells + x1];
			const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
			out[y * size + x] = (a + (b - a) * sx)
				+ ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
		}
	}
	return out;
}

const ROAD_SURFACES = {
	off: { label: 'flat', grain: 0 },

	asphalt: { label: 'asphalt', grain: 0.30, tileM: 2.0, coarse: 0.10, mid: 0.14 },

	worn: { label: 'worn', grain: 0.22, tileM: 8.0, coarse: 0.16, mid: 0.12 },

	patchy: { label: 'patchy', grain: 0.05, tileM: 24.0, coarse: 0.22, mid: 0.10 },
};
let roadSurface = 'asphalt';
const surfaceCache = Object.create(null);

function surfaceTexture(name) {
	const spec = ROAD_SURFACES[name];
	if (!spec || !spec.grain && !spec.coarse) return null;
	if (!surfaceCache[name]) surfaceCache[name] = buildAsphalt(spec);
	return surfaceCache[name];
}

function buildAsphalt(spec = ROAD_SURFACES.asphalt) {
	const size = 512;

	let seed = 0x2f6e2b1;
	const rng = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	const coarse = wrapNoise(size, 8, rng);
	const mid = wrapNoise(size, 32, rng);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d');
	const img = ctx.createImageData(size, size);
	for (let i = 0; i < size * size; i++) {

		const grain = rng();
		let v = 0.52 + spec.grain * (grain - 0.5) + (spec.coarse || 0) * (coarse[i] - 0.5)
			+ (spec.mid || 0) * (mid[i] - 0.5);
		v = Math.max(0.18, Math.min(0.92, v));

		const mod = Math.max(0, Math.min(1, 0.88 + (v - 0.52) * 0.55));
		const c = Math.round(mod * 255);
		img.data[i * 4] = c;
		img.data[i * 4 + 1] = Math.min(255, c + 1);
		img.data[i * 4 + 2] = Math.min(255, c + 3);
		img.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	const tex = new THREE.CanvasTexture(canvas);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.colorSpace = THREE.SRGBColorSpace;

	const tileM = spec.tileM || TEX_TILE_M;
	tex.repeat.set(1 / tileM, 1 / tileM);
	tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
	return tex;
}

let rainbowOn = false;
let inspectOn = false;

let flatOn = false;

let signalsOn = true;

let treesOn = true;

let treeDensity = 0.4;
let treeCull = true;

let treeError = '';
let picked = null;
let pickOverlay = null;
let variantRoads = {};

const roadColourCache = new Map();
function roadColour(id) {
	if (!roadColourCache.has(id)) {
		const h = ((id * 0.61803399) % 1 + 1) % 1;
		const s = 0.62, v = 0.95;
		const i = Math.floor(h * 6), f = h * 6 - i;
		const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
		const rgb = [[v, t, p], [q, v, p], [p, v, t],
			[p, q, v], [t, p, v], [v, p, q]][i % 6];
		roadColourCache.set(id, new THREE.Color(rgb[0], rgb[1], rgb[2]));
	}
	return roadColourCache.get(id);
}

function paintByRoad(root, ids) {
	root.traverse((o) => {
		if (!o.isMesh) return;
		const faces = o.geometry.index
			? o.geometry.index.count / 3
			: o.geometry.attributes.position.count / 3;
		const col = new Float32Array(faces * 9);
		for (let f = 0; f < faces; f++) {
			const c = roadColour(ids[f] || 0);
			for (let k = 0; k < 3; k++) {
				col[f * 9 + k * 3] = c.r;
				col[f * 9 + k * 3 + 1] = c.g;
				col[f * 9 + k * 3 + 2] = c.b;
			}
		}
		o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
	});
}

function showPicked(root, ids, id) {
	if (pickOverlay) {
		scene.remove(pickOverlay);
		pickOverlay.geometry.dispose();
		pickOverlay = null;
	}
	if (id === null) return;
	const out = [];
	root.traverse((o) => {
		if (!o.isMesh) return;
		const pos = o.geometry.attributes.position;
		const idx = o.geometry.index;
		const faces = idx ? idx.count / 3 : pos.count / 3;
		for (let f = 0; f < faces; f++) {
			if (ids[f] !== id) continue;
			for (let k = 0; k < 3; k++) {
				const vi = idx ? idx.getX(f * 3 + k) : f * 3 + k;
				out.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
			}
		}
	});
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
	pickOverlay = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
		color: 0x35e0ff, transparent: true, opacity: 0.55,
		side: THREE.DoubleSide, depthTest: false,
	}));
	pickOverlay.renderOrder = 998;
	scene.add(pickOverlay);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const PICK_SLOP_PX = 6;
let downAt = null;

renderer.domElement.addEventListener('pointerdown', (e) => {
	downAt = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', (e) => {
	if ((!inspectOn && !editOn) || !downAt) return;
	const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
	downAt = null;
	if (moved > PICK_SLOP_PX) return;
	const v = activeVariant();
	const M = v && variantMesh[v.name];
	if (!M || !M.ids) {
		status('inspector: pick a variant first — the tile GLBs carry no road ids');
		return;
	}
	pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
	pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(pointer, camera);
	const hit = raycaster.intersectObject(M.root, true)[0];
	if (!hit || hit.faceIndex === undefined) {
		status('inspector: nothing under the cursor');
		return;
	}
	const id = M.ids[hit.faceIndex];
	const info = variantRoads[String(id)] || {};
	picked = { id, info, point: hit.point.clone(),
		slope: hit.face ? Math.abs(hit.face.normal.y) : 1 };
	showPicked(M.root, M.ids, id);

	const bits = [`${id < 0 ? 'junction' : 'road'} ${Math.abs(id)}`];
	if (info.name) bits.push(info.name);
	if (info.class) bits.push(info.class);
	if (info.lanes) bits.push(`${info.lanes} lane${info.lanes === 1 ? '' : 's'}`);
	if (info.width_m) bits.push(`${info.width_m} m wide`);
	if (info.length_m) bits.push(`${info.length_m} m long`);
	if (info.arms) bits.push(`${info.arms} arms`);
	if (info.junction && id > 0) bits.push(`inside junction ${info.junction}`);
	bits.push(`at ${hit.point.x.toFixed(1)}, ${hit.point.z.toFixed(1)} · `
		+ `height ${hit.point.y.toFixed(2)} m`);
	status(`◆ ${bits.join(' · ')}`);
	;
	if (editOn) selectForEdit(id);
});

let EDGES_DOC = null;
let EDGES = null;
let EDGE_OF_ROAD = Object.create(null);
let editOn = false;
let editRoad = null;
const editRoads = new Map();
let handlePts = null;
let handleKeys = [];
let hoverPt = null;
let hoverIdx = -1;
let outlineL = null, outlineR = null;
let previewMesh = null;
let dragIdx = -1;

const dragPlane = new THREE.Plane();
const dragHit = new THREE.Vector3();

const SNAP_M = 1.25;
const NEAR_M = 8.0;
const HANDLE_PX = 14;

let handleStride = 3;





function pickEdges() {
	EDGES = null;
	EDGE_OF_ROAD = Object.create(null);
	if (!EDGES_DOC || !EDGES_DOC.variants) return;
	EDGES = EDGES_DOC.variants[variantName()] || null;
	if (!EDGES) return;
	for (const key in EDGES) {
		const e = EDGES[key];
		for (const m of (e.members || [])) EDGE_OF_ROAD[String(m)] = key;
		if (e.road !== undefined) EDGE_OF_ROAD[String(e.road)] = key;
	}
}

function roadOf(road) { return editRoads.get(road) || EDGES[road]; }

function editable(road) {
	if (!editRoads.has(road)) {
		const src = EDGES[road];
		editRoads.set(road, {
			left: src.left.map((p) => p.slice()),
			right: src.right.map((p) => p.slice()),
			spine: src.spine.map((p) => p.slice()),
		});
	}
	return editRoads.get(road);
}

function partnersOf(key) {
	if (!EDGES || !EDGES[key]) return [];

	const solo = (e) => (e.members || []).length < 2;
	if (!solo(EDGES[key])) return [];
	const wayOf = () => undefined;
	const way = wayOf(EDGES[key]);
	if (!way) return [];
	return Object.keys(EDGES).filter((k) => k !== key && EDGES[k].junction === null
		&& solo(EDGES[k]) && wayOf(EDGES[k]) === way);
}

function selectForEdit(id) {
	if (!EDGES) {
		status(`point editor: ${EDGES_DOC ? `no boundaries for ${variantName()}` : 'no edges.json'}`
			+ ' — rerun the level tools');
		return;
	}
	if (id < 0) { status('point editor: that is a junction — pick a road'); return; }
	const key = EDGE_OF_ROAD[String(id)];
	if (!key) {
		status(`point editor: road ${id} draws no ribbon in ${variantName()}`);
		return;
	}
	editRoad = key;
	buildHandles();
	const members = EDGES[key].members || [];
	const n = roadOf(editRoad).spine.length;
	status(`point editor: ${members.length > 1
		? `ribbon ${key} — ${members.length} roads fused into one`
		: `road ${key}`}, ${n} stations`
		+ (partnersOf(editRoad).length ? ', + the other half of the street in orange' : '')
		+ (handleStride > 1 ? `, every ${handleStride}th shown` : '')
		+ ' — drag a dot, double-click an edge to ADD one, [ ] for density');
}

function disposeEdit() {
	for (const o of [handlePts, outlineL, outlineR, previewMesh, hoverPt]) {
		if (o) { scene.remove(o); o.geometry.dispose(); }
	}
	handlePts = outlineL = outlineR = previewMesh = hoverPt = null;
	handleKeys = [];
	hoverIdx = -1;
}

function outline(road, side, colour) {
	const arr = roadOf(road)[side];
	const pts = arr.map((p) => new THREE.Vector3(p[0], p[1] + 0.06, p[2]));
	const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
		new THREE.LineBasicMaterial({ color: colour, depthTest: false,
			transparent: true, opacity: 1.0 }));
	line.renderOrder = 999;
	scene.add(line);
	return line;
}

function buildPreview() {
	if (previewMesh) {
		scene.remove(previewMesh);
		previewMesh.geometry.dispose();
		previewMesh = null;
	}
	if (!editOn || editRoad === null || !EDGES) return;
	const R = roadOf(editRoad);
	const n = R.left.length;
	if (n < 2) return;
	const pos = [];
	for (let i = 0; i < n - 1; i++) {
		const a = R.left[i], b = R.left[i + 1], c = R.right[i + 1], d = R.right[i];
		pos.push(a[0], a[1] + 0.04, a[2], b[0], b[1] + 0.04, b[2],
			c[0], c[1] + 0.04, c[2]);
		pos.push(a[0], a[1] + 0.04, a[2], c[0], c[1] + 0.04, c[2],
			d[0], d[1] + 0.04, d[2]);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

	previewMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
		color: 0x35e0ff, transparent: true, opacity: dragIdx >= 0 ? 0.34 : 0.16,
		side: THREE.DoubleSide, depthTest: false,
	}));
	previewMesh.renderOrder = 997;
	scene.add(previewMesh);
}

const NODE_EPS_M = 0.002;

const FOLD_COS = -0.2;

function nodesOf(arr) {
	const nodes = [];
	for (let i = 0; i < arr.length; i++) {
		const last = nodes.length ? nodes[nodes.length - 1] : null;
		const q = last ? arr[last[0]] : null;
		if (q && Math.hypot(arr[i][0] - q[0], arr[i][2] - q[2]) <= NODE_EPS_M) {
			last.push(i);
		} else {
			nodes.push([i]);
		}
	}
	return nodes;
}

function offered(nodes, arr) {
	const at = (k) => arr[nodes[k][0]];
	return nodes.map((ix, k) => {
		if (k === 0 || k === nodes.length - 1 || ix.length > 1) return true;
		const a = at(k - 1), b = at(k), c = at(k + 1);
		const ux = b[0] - a[0], uz = b[2] - a[2];
		const vx = c[0] - b[0], vz = c[2] - b[2];
		const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
		if (lu > 1e-9 && lv > 1e-9
			&& (ux * vx + uz * vz) / (lu * lv) < FOLD_COS) return true;
		return k % handleStride === 0;
	});
}

function buildHandles() {
	disposeEdit();
	if (!editOn || editRoad === null || !EDGES) return;
	const me = roadOf(editRoad);
	const mates = partnersOf(editRoad);

	const mine = [];
	for (const side of ['left', 'right']) {
		for (const p of me[side]) mine.push(p[0], p[2]);
	}
	const nearMe = (p) => {
		for (let k = 0; k < mine.length; k += 2) {
			if (Math.hypot(mine[k] - p[0], mine[k + 1] - p[2]) <= NEAR_M) return true;
		}
		return false;
	};
	const pos = [], col = [];
	const add = (road, side, ix, own) => {
		const p = roadOf(road)[side][ix[0]];
		pos.push(p[0], p[1] + 0.06, p[2]);
		if (own) col.push(0.20, 0.88, 1.00); else col.push(1.00, 0.60, 0.12);
		handleKeys.push([road, side, ix]);
	};
	for (const side of ['left', 'right']) {
		const arr = me[side];
		const nodes = nodesOf(arr), want = offered(nodes, arr);
		for (let k = 0; k < nodes.length; k++) {
			if (want[k]) add(editRoad, side, nodes[k], true);
		}
	}
	for (const road of mates) {
		for (const side of ['left', 'right']) {
			const arr = roadOf(road)[side];
			const nodes = nodesOf(arr), want = offered(nodes, arr);
			for (let k = 0; k < nodes.length; k++) {
				if (!want[k] || !nearMe(arr[nodes[k][0]])) continue;
				add(road, side, nodes[k], false);
			}
		}
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

	handlePts = new THREE.Points(geo, new THREE.PointsMaterial({
		size: 13, sizeAttenuation: false, vertexColors: true, depthTest: false,
		transparent: true, opacity: 1.0,
	}));
	handlePts.renderOrder = 1000;
	scene.add(handlePts);

	const hg = new THREE.BufferGeometry();
	hg.setAttribute('position', new THREE.Float32BufferAttribute([0, -9999, 0], 3));
	hoverPt = new THREE.Points(hg, new THREE.PointsMaterial({
		size: 20, sizeAttenuation: false, color: 0xffffff, depthTest: false,
		transparent: true, opacity: 1.0,
	}));
	hoverPt.renderOrder = 1001;
	scene.add(hoverPt);

	outlineL = outline(editRoad, 'left', 0x35e0ff);
	outlineR = outline(editRoad, 'right', 0x35e0ff);
	buildPreview();
}

const _proj = new THREE.Vector3();
function pickHandle(clientX, clientY) {
	if (!handlePts) return -1;
	const attr = handlePts.geometry.attributes.position;
	const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
	let bestPx = HANDLE_PX, best = -1;
	for (let i = 0; i < attr.count; i++) {
		_proj.fromBufferAttribute(attr, i).project(camera);
		if (_proj.z < -1 || _proj.z > 1) continue;
		const d = Math.hypot((_proj.x + 1) * hw - clientX,
			(-_proj.y + 1) * hh - clientY);
		if (d < bestPx) { bestPx = d; best = i; }
	}
	return best;
}

function showHover(idx) {
	hoverIdx = idx;
	if (!hoverPt) return;
	const attr = hoverPt.geometry.attributes.position;
	if (idx < 0) {
		attr.setXYZ(0, 0, -9999, 0);
	} else {
		const src = handlePts.geometry.attributes.position;
		attr.setXYZ(0, src.getX(idx), src.getY(idx), src.getZ(idx));
	}
	attr.needsUpdate = true;
}

function insertStationAt(clientX, clientY) {
	if (editRoad === null) return;
	const R = editable(editRoad);
	const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
	const screenOf = (p) => {
		_proj.set(p[0], p[1], p[2]).project(camera);
		return [(_proj.x + 1) * hw, (-_proj.y + 1) * hh, _proj.z];
	};

	let best = Infinity, bestI = -1, bestT = 0;
	for (let i = 0; i < R.spine.length - 1; i++) {
		const A = screenOf(R.spine[i]), B = screenOf(R.spine[i + 1]);
		if (A[2] < -1 || A[2] > 1 || B[2] < -1 || B[2] > 1) continue;
		const vx = B[0] - A[0], vy = B[1] - A[1];
		const L2 = vx * vx + vy * vy;
		const t = L2 > 1e-6
			? Math.max(0, Math.min(1, ((clientX - A[0]) * vx + (clientY - A[1]) * vy) / L2))
			: 0;
		const d = Math.hypot(A[0] + t * vx - clientX, A[1] + t * vy - clientY);
		if (d < best) { best = d; bestI = i; bestT = t; }
	}
	if (bestI < 0 || best > 60) {
		status('add a point: double-click nearer the road you are editing');
		return;
	}
	const lerp = (arr) => {
		const a = arr[bestI], b = arr[bestI + 1];
		return [a[0] + (b[0] - a[0]) * bestT, a[1] + (b[1] - a[1]) * bestT,
			a[2] + (b[2] - a[2]) * bestT];
	};
	for (const side of ['left', 'right', 'spine']) {
		R[side].splice(bestI + 1, 0, lerp(R[side]));
	}
	buildHandles();
	status(`added a station after ${bestI} — road ${editRoad} now has `
		+ `${R.spine.length}. Drag either new dot; the shape has not moved yet.`);
}

renderer.domElement.addEventListener('dblclick', (e) => {
	if (!editOn) return;
	insertStationAt(e.clientX, e.clientY);
	e.stopImmediatePropagation();
	e.preventDefault();
}, true);

renderer.domElement.addEventListener('pointerdown', (e) => {
	if (!editOn || !handlePts) return;
	const idx = pickHandle(e.clientX, e.clientY);
	if (idx < 0) return;
	dragIdx = idx;
	const [road, side, i] = handleKeys[dragIdx];
	const p = roadOf(road)[side][i];

	dragPlane.set(new THREE.Vector3(0, 1, 0), -(p[1] + 0.06));
	controls.enabled = false;
	downAt = null;
	e.stopImmediatePropagation();
	e.preventDefault();
}, true);

renderer.domElement.addEventListener('pointermove', (e) => {
	if (dragIdx < 0) {
		if (editOn && handlePts) {
			const idx = pickHandle(e.clientX, e.clientY);
			if (idx !== hoverIdx) {
				showHover(idx);
				if (idx >= 0) {
					const [r, sd, ix] = handleKeys[idx];
					status(`${r === editRoad ? '◆' : '·'} ${r} ${sd}[${ix[0]}]`
						+ (ix.length > 1
							? `  — ${ix.length} stations stacked here, they move together`
							: '')
						+ (r === editRoad ? '' : '  — drag it, or snap onto it'));
				}
			}
		}
		return;
	}
	pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
	pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(pointer, camera);
	if (!raycaster.ray.intersectPlane(dragPlane, dragHit)) return;

	const [road, side, ix] = handleKeys[dragIdx];
	const R = editable(road);
	const from = (EDGES[road] && EDGES[road][side][ix[0]]) || R[side][ix[0]];
	let x = dragHit.x, z = dragHit.z, snapped = false;

	let bestD = SNAP_M;
	for (let k = 0; k < handleKeys.length; k++) {
		if (k === dragIdx) continue;
		const [r2, s2, i2] = handleKeys[k];
		if (r2 === road && s2 === side) continue;
		const q = roadOf(r2)[s2][i2[0]];
		const d = Math.hypot(q[0] - x, q[2] - z);
		if (d < bestD) { bestD = d; x = q[0]; z = q[2]; snapped = true; }
	}

	for (const i of ix) R[side][i] = [x, R[side][i][1], z];
	const attr = handlePts.geometry.attributes.position;
	attr.setXYZ(dragIdx, x, R[side][ix[0]][1] + 0.06, z);
	attr.needsUpdate = true;
	if (road === editRoad) {
		const line = side === 'left' ? outlineL : outlineR;
		const la = line.geometry.attributes.position;
		for (const i of ix) la.setXYZ(i, x, R[side][i][1] + 0.06, z);
		la.needsUpdate = true;
	}
	buildPreview();
	showHover(dragIdx);
	status(`${road} ${side}[${ix[0]}]${ix.length > 1 ? ` +${ix.length - 1}` : ''} moved `
		+ `${Math.hypot(x - from[0], z - from[2]).toFixed(2)} m`
		+ (snapped ? '  — SNAPPED' : '')
		+ `  · ${editRoads.size} road(s) edited`);
	e.stopImmediatePropagation();
}, true);

renderer.domElement.addEventListener('pointerup', (e) => {
	if (dragIdx < 0) return;
	dragIdx = -1;
	controls.enabled = flying;
	e.stopImmediatePropagation();
}, true);



function unquantiseGeometry(o) {
	const g = o.geometry;
	const quantised = (a) => !!a && (a.normalized || !(a.array instanceof Float32Array));
	const pos = g.getAttribute('position');
	if (!quantised(pos) && !quantised(g.getAttribute('normal'))) return false;

	o.updateMatrix();
	const m = o.matrix.clone();
	const nm = new THREE.Matrix3().getNormalMatrix(m);
	const v = new THREE.Vector3();

	if (pos) {
		const out = new Float32Array(pos.count * 3);
		for (let i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i).applyMatrix4(m);
			out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
		}
		g.setAttribute('position', new THREE.BufferAttribute(out, 3));
	}
	const nrm = g.getAttribute('normal');
	if (nrm) {
		const out = new Float32Array(nrm.count * 3);
		for (let i = 0; i < nrm.count; i++) {
			v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
			out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
		}
		g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
	}

	for (const name of Object.keys(g.attributes)) {
		if (name === 'position' || name === 'normal') continue;
		const a = g.attributes[name];
		if (!quantised(a)) continue;
		const out = new Float32Array(a.count * a.itemSize);
		for (let i = 0; i < a.count; i++) {
			for (let j = 0; j < a.itemSize; j++) out[i * a.itemSize + j] = a.getComponent(i, j);
		}
		g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
	}

	o.position.set(0, 0, 0);
	o.quaternion.identity();
	o.scale.set(1, 1, 1);
	o.updateMatrix();
	g.computeBoundingBox();
	g.computeBoundingSphere();
	return true;
}

function weldLayer(root, key) {
	let flatCount = 0;
	let weldCount = 0;
	let meshes = 0;
	let unquantised = 0;
	root.traverse((o) => {
		if (!o.isMesh || o.userData.weldedGeometry) return;
		if (unquantiseGeometry(o)) unquantised++;
		const flat = o.geometry;
		const welded = mergeVertices(flat);
		welded.computeVertexNormals();
		o.userData.flatGeometry = flat;
		o.userData.weldedGeometry = welded;
		flatCount += flat.getAttribute('position').count;
		weldCount += welded.getAttribute('position').count;
		meshes++;
		if (weldNormals) o.geometry = welded;
	});
	if (meshes) {
		const share = flatCount ? (100 * weldCount / flatCount).toFixed(1) : '0';
		;
	}
}



function declaredHex(rgb) {
	const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
	return (q(rgb[0]) << 16) | (q(rgb[1]) << 8) | q(rgb[2]);
}

const GRID_LAYERS = ['ground', 'surfaces'];
let gridMod = null;
let gridPalette = 'cyan';
let gridOn = false;
let gridAttached = 0;

async function ensureGridMod() {
	if (!gridMod) {
		gridMod = await import(`./groundgrid.js${MODULE_STAMP}`);
	}
	return gridMod;
}

async function applyGrid() {
	const M = await ensureGridMod();
	M.writeGrid(gridOn, gridPalette);
}

async function ensureLayer(spec) {
	if (chunk.layers[spec.key] !== undefined) return chunk.layers[spec.key];
	const info = chunk.meta.layers && chunk.meta.layers[spec.key];
	if (!info) { chunk.layers[spec.key] = null; return null; }
	const gltf = await newGLTFLoader().loadAsync(url(`${CHUNK}.${spec.key}`, 'glb'));
	const root = gltf.scene;

	const materials = new Map();
	let declared = 0;
	root.traverse((o) => {
		if (!o.isMesh) return;
		const rgb = Array.isArray(o.userData && o.userData.colour)
			? o.userData.colour : null;
		const key = rgb ? rgb.join(',') : 'default';
		if (!materials.has(key)) {

			const material = new THREE.MeshStandardMaterial({
				color: rgb ? declaredHex(rgb) : spec.tone,
				roughness: 0.95, metalness: 0.0,

				side: THREE.DoubleSide,
			});

			if (rgb) material.userData.albedo = declaredHex(rgb);

			if (o.userData && o.userData.value !== undefined) {
				material.userData.role = o.userData.value;
			}
			materials.set(key, material);
		}
		o.material = materials.get(key);
		if (rgb) declared++;
	});
	if (declared) ;

	if (GRID_LAYERS.includes(spec.key)) {
		try {
			const M = await ensureGridMod();
			gridAttached += M.attachToRoot(root);
			M.writeGrid(gridOn, gridPalette);
		} catch (err) {

			console.warn('[grid] not attached:', err && err.message ? err.message : err);
		}
	}

	if (UNQUANTISE_LAYERS.includes(spec.key)) {
		let n = 0;
		root.traverse((o) => { if (o.isMesh && unquantiseGeometry(o)) n++; });
		if (n) ;
	}
	collectSpinners(root, spec.key);

	if (WELD_LAYERS.includes(spec.key)) weldLayer(root, spec.key);

	rank(root, spec.bias);
	root.visible = false;

	if (waterMod && waterRings && spec.key === 'surfaces') {

		const dropped = waterMod.dropCoverInWater(root, waterRings);
		if (dropped) ;
	}
	scene.add(root);
	let collider = null;
	if (spec.drive) {
		collider = addTrimeshCollider(world, root);
		collider.collider.setEnabled(false);
		collider.collider.setFriction(GROUND_FRICTION);
	}
	chunk.layers[spec.key] = { root, collider, triangles: info.triangles, spec };

	if (spec.key === 'surfaces') applyPavements();

	if (lighting) lighting.dress(root);
	return chunk.layers[spec.key];
}

function applyShown() {
	const v = activeVariant();
	LAYERS.forEach((spec, i) => {
		const L = chunk.layers[spec.key];
		if (!L) return;
		const on = shown[i] && !(v && VARIANT_REPLACES.includes(spec.key));
		L.root.visible = on;
		if (L.collider) L.collider.collider.setEnabled(on);
	});
	for (const name in variantMesh) {
		const M = variantMesh[name];
		const on = !!v && v.name === name;
		M.root.visible = on;
		M.collider.collider.setEnabled(on);
	}
	applyDebug();
}

async function ensureVariant(spec) {
	if (variantMesh[spec.name]) return variantMesh[spec.name];
	const gltf = await newGLTFLoader().loadAsync(
		url(`${CHUNK}.road.${spec.name}`, 'glb'));
	const root = gltf.scene;
	root.traverse((o) => {
		if (o.isMesh) {

			o.material = new THREE.MeshStandardMaterial({
				color: ROAD_TONE, roughness: 0.95, metalness: 0.0,
				side: THREE.DoubleSide,
			});
		}
	});

	rank(root, 'deck');
	root.visible = false;
	scene.add(root);
	const collider = addTrimeshCollider(world, root);
	collider.collider.setEnabled(false);
	collider.collider.setFriction(GROUND_FRICTION);

	let ids = null;
	try {
		const buf = await (await fetch(url(`${CHUNK}.road.${spec.name}.ids`, 'bin')))
			.arrayBuffer();
		ids = new Int32Array(buf);
		paintByRoad(root, ids);
	} catch (err) {
		console.warn(`no ids sidecar for ${spec.name} — no rainbow, no inspector`, err);
	}
	variantMesh[spec.name] = { root, collider, ids, triangles: spec.triangles, spec };
	if (lighting) lighting.dress(root);
	return variantMesh[spec.name];
}

async function setVariant(i) {
	if (busy || !variants.length) return;
	const n = variants.length;
	i = ((i % n) + n) % n;
	busy = true;
	try {
		await ensureVariant(variants[i]);
		variantIndex = i;

		picked = null;
		showPicked(null, null, null);

		pickEdges();
		if (editRoad !== null) { editRoad = null; disposeEdit(); }
		applyShown();
		const v = activeVariant();
		status(v
			? `road: ${v.name} — ${v.note} · ${v.triangles.toLocaleString()} triangles `
				+ `against the tile's ${tileRoadTriangles().toLocaleString()}`
			: 'road: tile — the four separate layers, as the bench draws them');
	} finally {
		busy = false;
	}
}

function tileRoadTriangles() {
	let n = 0;
	for (const key of VARIANT_REPLACES) {
		const info = chunk.meta.layers && chunk.meta.layers[key];
		if (info) n += info.triangles;
	}
	return n;
}

let busy = false;





function drawnTriangles() {
	const v = activeVariant();
	let n = v ? v.triangles : 0;
	LAYERS.forEach((spec, i) => {
		const L = chunk.layers[spec.key];
		if (!L || !shown[i]) return;
		if (v && VARIANT_REPLACES.includes(spec.key)) return;
		n += L.triangles;
	});
	return n;
}

function renderLayers() {
	const v = activeVariant();
	const rows = LAYERS.map((spec, i) => {
		const info = chunk.meta.layers && chunk.meta.layers[spec.key];
		const key = `<b>&#8679;${i + 1}</b>`;
		if (!info) {
			return `${key} <span class="dim">${spec.key.padEnd(10)} `
				+ `&mdash; not in this box</span>`;
		}

		if (v && VARIANT_REPLACES.includes(spec.key)) {
			return `${key} <span class="dim">${spec.key.padEnd(10)} `
				+ `&mdash; replaced by ${v.name}</span>`;
		}
		const mark = shown[i]
			? '<span class="on">&#9679; on </span>'
			: '<span class="dim">&#9675; off</span>';
		const cost = `${info.triangles.toLocaleString()} tris, ${info.mb.toFixed(2)} MB`;
		return `${key} <b>${spec.key.padEnd(10)}</b> ${mark} `
			+ `<span class="${spec.drive ? 'drive' : 'dim'}">`
			+ `${spec.drive ? 'collided' : 'drawn   '}</span> `
			+ `<span class="dim">${cost}</span>`;
	});

	let vrows = '';
	if (variants.length > 1) {
		vrows = '\n\n<b>ROAD</b>  <span class="dim">V / shift-V &middot; '
			+ 'one closed solid instead of road+slab+junctions</span>\n'
			+ variants.map((spec, i) => {
				const mark = i === variantIndex
					? '<span class="on">&#9679;</span>'
					: '<span class="dim">&#9675;</span>';
				const tris = spec.triangles
					? `${spec.triangles.toLocaleString()} tris`
					: `${tileRoadTriangles().toLocaleString()} tris`;
				return `${mark} <b>${spec.name.padEnd(8)}</b> `
					+ `<span class="dim">${tris.padStart(11)}  ${spec.note}</span>`;
			}).join('\n');

		const s = seamCache[variantName()];
		if (s) {
			vrows += `\n<span class="off">  ${variantName()}: `
				+ `${s.holes.toFixed(0)} m HOLE</span>`
				+ `<span class="dim"> · ${s.edges.toFixed(0)} m honest edge</span>`;
		}
	}

	let srows = '\n\n<b>SCENERY</b>  <span class="dim">not meshes &middot; cut as data, '
		+ 'built in the browser</span>';
	srows += forest
		? `\n<span class="on">&#9679;</span> <b>trees   </b> `
			+ `<span class="dim">${forest.count.toLocaleString()} in `
			+ `${forest.cells} cells, ${forest.triangles.toLocaleString()} tris, `
			+ `${Math.round(forest.density * 100)}% drawn</span>`
		: (chunk.meta.trees
			? '\n<span class="off">&#9675;</span> <b>trees   </b> '
				+ `<span class="off">${chunk.meta.trees.trees.toLocaleString()} in the cut, `
				+ `NOT DRAWN &mdash; ${treeError || 'the module returned nothing'}</span>`
			: '\n<span class="dim">&#9675; trees    &mdash; not in this cut; re-cut with '
				+ 'the level tools</span>');
	srows += signals
		? `\n<span class="on">&#9679;</span> <b>signals </b> `
			+ `<span class="dim">${signals.heads} heads on ${signals.gantries} gantries</span>`
		: '\n<span class="dim">&#9675; signals  &mdash; no signalised junction here</span>';

	layersPanel.innerHTML =
		`<b>LAYERS</b>  <span class="dim">&#8679;1-7 toggle &middot; `
		+ `L / shift-L ladder</span>\n` + rows.join('\n')
		+ `\n<span class="dim">${drawnTriangles().toLocaleString()} triangles on</span>`
		+ vrows + srows;
}

async function loadChunk() {

	const metaRes = await fetch(url(CHUNK, 'json'));
	if (!metaRes.ok) {
		throw new Error(`level "${CHUNK}" is missing`);
	}
	const meta = await metaRes.json();

	if (!meta.layers || !Object.keys(meta.layers).length) {
		throw new Error('this level has no layers');
	}
	chunk = { meta, layers: {} };

	if (meta.spawn) {
		chunk.spawn = meta.spawn;
		chunk.yaw = meta.yaw;
		return;
	}

	if (!meta.chains) {
		throw new Error(`${CHUNK}.json has neither a spawn nor chains — re-cut it `
			+ 'with the level tools');
	}

	let best = null;
	for (const c of meta.chains) if (!best || c.length > best.length) best = c;

	let bi = 0, bd = Infinity;
	for (let i = 2; i < best.points.length - 2; i++) {
		const d = best.points[i][0] ** 2 + best.points[i][2] ** 2;
		if (d < bd) { bd = d; bi = i; }
	}
	const p0 = best.points[bi];
	const p1 = best.points[Math.min(bi + 2, best.points.length - 1)];
	chunk.spawn = { x: p0[0], y: p0[1] + 1.0, z: p0[2] };
	chunk.yaw = Math.atan2(-(p1[0] - p0[0]), -(p1[2] - p0[2]));
}

const ONLY_VARIANT = new URLSearchParams(location.search).get('variant') || 'fused';

let signals = null;
const MODULE_STAMP = new URL(import.meta.url).search || '';

async function loadSignals() {
	signals = null;

	if (!chunk || !chunk.meta || !chunk.meta.signals) return;
	try {
		const { buildSignals } = await import(`./signals.js${MODULE_STAMP}`);
		const upstream = new URLSearchParams(location.search).get('signals') === 'upstream';
		signals = await buildSignals(url(`${CHUNK}.signals`, 'json'), { upstream });
		if (signals) {
			signals.group.visible = signalsOn;
			scene.add(signals.group);
		}
	} catch (err) {

		console.warn('[signals] not drawn:', err && err.message ? err.message : err);
	}
}

let forest = null;

let water = null;
let waterOn = true;

let waterMod = null;

let waterRings = null;

let biasReg = null;

let biasMod = null;

function rank(root, role) {
	if (!biasReg || !role || !root) return 0;
	const n = biasReg.registerTree(root, role);
	if (n) ;
	return n;
}

async function loadGarageCars() {

	if (!chunk || !chunk.meta || !chunk.meta.bays) return;
	try {
		const { buildGarageCars } = await import(`./garagecars.js${MODULE_STAMP}`);
		garageCars = await buildGarageCars(url(`${CHUNK}.garage`, 'json'),
			{ fill: garageFill });
		if (garageCars && garageCars.footprints && garageCars.footprints.length) {
			garageFootprints = garageCars.footprints;
		}
		if (garageCars) {
			garageCars.group.visible = garageCarsOn;
			scene.add(garageCars.group);

			if (lampMode === 'lit') attachLampField();
			;
		}
	} catch (err) {

		console.warn('[garage] parked cars not built:',
			err && err.message ? err.message : err);
	}
}

async function loadTrees() {
	forest = null;
	treeError = '';

	if (!chunk || !chunk.meta || !chunk.meta.trees) return;
	try {
		const { buildTrees } = await import(`./trees.js${MODULE_STAMP}`);
		forest = await buildTrees(url(`${CHUNK}.trees`, 'json'), { density: treeDensity });
		if (forest) {
			forest.group.visible = treesOn;
			scene.add(forest.group);

			const st = lighting && lighting.styles.find((s) => s.id === lighting.style);
			applyTreeTint(st && st.tree);
		}
	} catch (err) {

		treeError = err && err.message ? err.message : String(err);
		console.warn('[trees] not drawn:', treeError);
	}
}

let lamps = null;
let lampField = null;
let lampError = '';

let lampMode = new URLSearchParams(location.search).get('lamps') || 'lit';

let lampsByDay = new URLSearchParams(location.search).get('lampsday') === '1';
let lampCarAttached = false;

let lampGain = 22;

async function loadLamps() {
	lamps = null;
	lampField = null;
	lampError = '';

	if (!chunk || !chunk.meta || !chunk.meta.lamps) return;
	try {
		const [{ buildLamps }, field] = await Promise.all([
			import(`./lamps.js${MODULE_STAMP}`),
			import(`./lampfield.js${MODULE_STAMP}`),
		]);
		const { buildLampField, FIELD_GAIN } = field;
		lampGain = FIELD_GAIN;
		lamps = await buildLamps(url(`${CHUNK}.lamps`, 'json'),
			{ mode: lampMode, daylight: lampsByDay });
		if (!lamps) return;
		scene.add(lamps.group);

		lampField = buildLampField(lamps.fleet, { footprints: garageFootprints });
		attachLampField();
	} catch (err) {

		lampError = err && err.message ? err.message : String(err);
		console.warn('[lamps] not drawn:', lampError);
	}
}

function attachLampField() {
	if (!lampField) return;
	const flat = (root) => {
		if (!root) return;
		root.traverse((o) => {

			if (!o.isMesh || !o.material) return;
			for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
				if (m.isMeshStandardMaterial) lampField.attach(m);
			}
		});
	};
	for (const spec of LAYERS) {
		const L = chunk && chunk.layers && chunk.layers[spec.key];
		if (L) flat(L.root);
	}
	for (const name in variantMesh) flat(variantMesh[name] && variantMesh[name].root);

	if (lamps) flat(lamps.group);

	if (garageCars) flat(garageCars.group);

	const grad = (root) => {
		if (!root) return;
		root.traverse((o) => {
			if (!o.isMesh || !o.material) return;
			for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
				if (m.isMeshStandardMaterial) lampField.attach(m, { gradient: true });
			}
		});
	};
	if (car && car.bodyMesh) grad(car.bodyMesh);
	if (car && car.carMesh && car.carMesh.group) {
		grad(car.carMesh.group);
		lampCarAttached = true;
	}
	if (traffic && traffic.mesh) grad(traffic.mesh);
}

function applyLampMode() {
	if (lamps) {
		lamps.mode = lampMode;
		lamps.daylight = lampsByDay;
	}
	if (lampField && lampMode !== 'lit') lampField.gain = 0;
	if (lampMode === 'lit') attachLampField();
}

let traffic = null;
let trafficPass = null;

let TRAFFIC_DIALS = { on: false, count: 0, spawnRadius: 0, headwayM: 0, colourVariety: 0,
	speedMin: 0, speedMax: 0, shadows: true, lampGlow: 1 };
let PASS_DIALS = { on: false, clearAheadM: 0, gainM: 0 };
let trafficError = '';
let trafficReport = '';
let trafficHold = null;

async function loadTraffic() {
	traffic = null;
	trafficPass = null;
	trafficError = '';
	trafficReport = '';

	if (!chunk || !chunk.meta || !chunk.meta.lanes) {
		trafficError = 'this cut has no lanes sidecar. Run '
			+ `<code>.venv/bin/python the level tools ${CHUNK}</code> to build one — `
			+ 'it reads the cut&rsquo;s own box and takes seconds, and re-cutting the chunk is not needed.';
		return;
	}
	try {
		const [{ buildLaneGraph, sampleLane }, { buildNpcTraffic, TRAFFIC },
			{ buildNpcPass, PASSING }, { buildSignalHold }] = await Promise.all([
			import(`./npcgraph.js${MODULE_STAMP}`),
			import(`./npctraffic.js${MODULE_STAMP}`),
			import(`./npcpass.js${MODULE_STAMP}`),
			import(`./npchold.js${MODULE_STAMP}`),
		]);

		const graph = buildLaneGraph(await sidecarJson(`${CHUNK}.lanes`));
		if (!graph.spawn.length) throw new Error('no spawnable lane in the graph');

		laneNav = graph;
		laneNavSample = sampleLane;

		TRAFFIC_DIALS = TRAFFIC;
		PASS_DIALS = PASSING;
		trafficPass = buildNpcPass(graph);

		trafficHold = signals ? buildSignalHold(graph, signals) : null;
		traffic = buildNpcTraffic(scene, graph, { pass: trafficPass, hold: trafficHold });
		if (traffic) {
			trafficReport = `${traffic.report} · ${trafficPass.report}`
				+ (trafficHold ? ` · 🚦 ${trafficHold.report}` : ' · no signals in this cut');
			traffic.setBodyShadows(TRAFFIC.shadows);
			;
		}
	} catch (err) {

		trafficError = err && err.message ? err.message : String(err);
		console.warn('[traffic] not drawn:', trafficError);
	}
}

window.look = {

	clouds() {
		return lighting
			? {
				drawn: lighting.cloudsDrawn,
				sway: lighting.cloudSway,
				kind: lighting.cloudKind,
				cover: lighting.clouds,
				size: lighting.cloudSize,
				thickness: lighting.cloudThickness,
				droop: lighting.cloudDroop,
				rimFade: lighting.cloudRimFade,
				clump: lighting.cloudClump,
				wind: lighting.windSpeed,

				grey: lighting.cloudGrey,
				greyNow: Math.round(lighting.cloudGreyNow * 1000) / 1000,
				height: lighting.cloudHeight,
				distGain: lighting.cloudDistGain,
				crowd: lighting.cloudCrowd,
				fogDistance: lighting.fogDistance,
				fogRange: lighting.fogRange,
			}
			: null;
	},

	setCloud(name, value) {
		if (!lighting) return null;
		lighting[name] = value;
		return lighting[name];
	},

	report() {
		return {
			style: lighting ? lighting.style : null,

			shadowLevel: lighting ? lighting.shadowLevel : null,
			renderScale: pixelScale,
			cinematic: cinematicOn,
			tint: buildingTintLevel,
			shade: buildingShade,
			varied: variedBuildings,
			neon: neonOn,
			neonGate: neonMinHeight,
			neonStats: neonEdges ? neonEdges.stats : null,
			windows: windowsOn,
			windowsLit,
			panes: windowStats
				? { total: windowStats.windows, lit: windowStats.windowsLit || 0 }
				: null,
		};
	},

	clock(t, run) {
		if (!lighting) return { error: 'no lighting rig' };
		if (t !== undefined) lighting.timeOfDay = Number(t);

		if (run !== undefined) lighting.running = !!run;
		return { t: lighting.timeOfDay, clock: lighting.clockText(),
			phase: lighting.phaseName, style: lighting.style,
			running: lighting.running };
	},

	groups() {
		const layer = chunk && chunk.layers && chunk.layers.buildings;
		if (!layer || !layer.root) return { error: 'no buildings layer' };
		let windows = 0, neon = 0, tris = 0;
		for (const child of layer.root.children) {
			if (child === windowGroup || (child.userData && child.userData.windows)) windows++;
			if (neonEdges && child === neonEdges.group) neon++;
		}

		layer.root.traverse((o) => {
			const g = o.isMesh && o.geometry;
			if (g && g.index) tris += g.index.count / 3;
			else if (g && g.attributes && g.attributes.position) tris += g.attributes.position.count / 3;
		});
		return { windowGroups: windows, neonGroups: neon,
			childrenOfBuildingsRoot: layer.root.children.length,
			trianglesUnderBuildings: Math.round(tris),
			panesLastBuilt: windowStats ? windowStats.windows : null };
	},

	profile(on) {
		profOn = on === undefined ? !profOn : !!on;
		for (const k of PROF_KEYS) { profSum[k] = 0; profPeak[k] = 0; }
		profFrames = 0;
		profText = '';
		return { profiling: profOn };
	},

	frames() {
		return { profiling: profOn, window: profText || 'filling…',
			stats: frameStats(), capBinds, physDt: +physDt.toFixed(5),
			physHz: Math.round(1 / physDt), drain: physDrain };
	},

	golden(arm) {
		if (!lighting) return { error: 'no lighting rig' };
		if (arm !== undefined) lighting.goldenArm = arm;
		return { goldenArm: lighting.goldenArm,
			arms: lighting.goldenArms.map((a) => a.id) };
	},

	snapshot() {
		const out = { style: lighting && lighting.style, tones: worldTones,
			grade: worldGradeName, varied: variedBuildings, tint: buildingTintLevel,
			neon: neonOn, windows: windowsOn, lit: windowsLit, categories: categoryTones };
		if (lighting) {
			const s = lighting.look;
			out.t = +lighting.timeOfDay.toFixed(4);
			out.phase = lighting.phaseName;
			out.goldenArm = lighting.goldenArm;
			out.running = lighting.running;
			if (s && s.look) {
				const L = s.look;
				out.sky = { zen: L.skyZenith, hor: L.skyHorizon, band: L.skyBand,
					amt: +L.skyBandAmt.toFixed(3), sun: +L.sunIntensity.toFixed(3),
					hemi: +L.hemiIntensity.toFixed(3), exp: +L.exposure.toFixed(3),
					fogN: Math.round(L.fogNear), fogF: Math.round(L.fogFar) };
				out.sunUp = +s.sunUp.toFixed(4);
			}

			if (lighting.rendererState) out.renderer = lighting.rendererState();
		}

		out.materials = {};
		if (chunk && chunk.layers) {
			for (const spec of LAYERS) {
				const L = chunk.layers[spec.key];
				if (!L || !L.root) continue;
				let hex = null;
				L.root.traverse((o) => {
					if (hex === null && o.isMesh && o.material && o.material.color) {
						hex = '#' + o.material.color.getHexString();
					}
				});
				if (hex) out.materials[spec.key] = hex;
			}
		}
		return out;
	},

	mode(which) {
		if (!lighting) return { error: 'no lighting rig' };
		if (which !== undefined) {
			const i = typeof which === 'number'
				? which : SKY_MODES.findIndex((m) => m.id === which || m.label === which);
			if (i < 0 || !SKY_MODES[i]) {
				return { error: `no such mode ${which}`,
					modes: SKY_MODES.map((m) => m.id) };
			}
			setSkyMode(i, false);
		}
		return { mode: SKY_MODES[skyMode].id, t: lighting.timeOfDay,
			clock: lighting.clockText(), phase: lighting.phaseName,
			modes: SKY_MODES.map((m) => m.id) };
	},

	ground(name) {
		if (!lighting) return { error: 'no lighting rig' };
		if (name === undefined) {
			return { current: lighting.goldenGround, options: lighting.goldenGrounds };
		}
		if (!lighting.goldenGrounds.includes(name)) {
			return { error: `no such ground ${name}`, options: lighting.goldenGrounds };
		}
		lighting.goldenGround = name;
		setSkyMode(skyMode, false);
		return { current: lighting.goldenGround, mode: SKY_MODES[skyMode].id };
	},

	lamps(mode, byDay) {
		if (byDay !== undefined) {
			lampsByDay = !!byDay;
			applyLampMode();
		}
		if (mode !== undefined) {
			if (!['off', 'orb', 'lit'].includes(mode)) {
				return { error: `no such mode ${mode}`, options: ['off', 'orb', 'lit'] };
			}
			lampMode = mode;
			applyLampMode();
		}
		return {
			mode: lampMode,
			byDay: lampsByDay,
			drawn: !!(lamps && lamps.group.visible),
			sky: SKY_MODES[skyMode].id,
			count: lamps ? lamps.lamps.length : 0,
			byType: lamps ? lamps.byType : null,
			gain: lampGain,
			night: lighting ? +lighting.nightLevel.toFixed(3) : null,
			field: lampField ? lampField.stats : null,
			error: lampError || undefined,
		};
	},

	async neon(on) { neonOn = !!on; await applyNeon(neonOn); return this.report(); },

	async gate(m) { neonMinHeight = Number(m); if (neonOn) await applyNeon(true); return this.report(); },

	async litWindows(on) { windowsLit = !!on; await applyWindows(windowsOn); return this.report(); },

	async tint(level) {
		if (!TINT_LEVELS[level]) return { error: `no such level ${level}` };
		buildingTintLevel = level;
		buildingsTinted = false;
		if (!variedBuildings) variedBuildings = true;
		await applyBuildingTint(true);
		applyWorldTones();
		return this.report();
	},
};

window.npc = {

	report() {
		if (!traffic) return { drawn: 0, why: trafficError || 'no traffic built' };
		const cars = traffic.cars;
		const want = Math.min(cars.length, Math.floor(TRAFFIC_DIALS.count));
		let placed = 0;
		let braking = 0;
		let changing = 0;

		let heldWithLane = 0;
		let onMultiLane = 0;

		let atRed = 0;
		let near = Infinity;
		let far = 0;
		const speeds = [];
		for (let i = 0; i < want; i++) {
			const c = cars[i];
			if (c.node < 0) continue;
			placed++;
			if (c.braking) braking++;
			if (c.lat !== 0) changing++;
			const node = traffic.graph.nodes[c.node];
			if (node.left >= 0 || node.right >= 0) onMultiLane++;
			if (c.braking && node.left >= 0) heldWithLane++;
			if (c.braking && trafficHold && trafficHold.stopS[c.node] >= 0
				&& !trafficHold.mayGo(c.node)) atRed++;
			speeds.push(c.speed);

		}
		const m = traffic.mesh;
		for (let i = 0; i < m.count; i++) {
			const e = m.instanceMatrix.array;
			const o = i * 16;
			const x = e[o + 12];
			const y = e[o + 13];
			const z = e[o + 14];
			if (x === 0 && y === 0 && z === 0) continue;
			const d = Math.hypot(x - trafficFocus.x, z - trafficFocus.z);
			if (d < near) near = d;
			if (d > far) far = d;
		}
		speeds.sort((a, b) => a - b);
		return {
			drawn: m.count,
			want,
			placed,
			braking,
			changing,

			onMultiLane,

			heldWithLane,

			atRed,

			controlledLanes: trafficHold ? trafficHold.controlled : 0,
			nearestM: Number.isFinite(near) ? +near.toFixed(1) : null,
			farthestM: +far.toFixed(1),
			speedMinMs: speeds.length ? +speeds[0].toFixed(1) : null,
			speedMedMs: speeds.length ? +speeds[speeds.length >> 1].toFixed(1) : null,
			speedMaxMs: speeds.length ? +speeds[speeds.length - 1].toFixed(1) : null,
			passes: trafficPass ? trafficPass.stats.passes : 0,
			returns: trafficPass ? trafficPass.stats.returns : 0,
			blocked: trafficPass ? trafficPass.stats.blocked : 0,
			nightLevel: lighting ? +lighting.nightLevel.toFixed(2) : null,
		};
	},

	dial(patch = {}) {
		for (const [k, v] of Object.entries(patch)) {
			if (k in TRAFFIC_DIALS) TRAFFIC_DIALS[k] = v;
			else if (k in PASS_DIALS) PASS_DIALS[k] = v;
			else throw new Error(`no such traffic dial: ${k}`);
		}
		if (traffic && ('speedMin' in patch || 'speedMax' in patch)) traffic.respeed();
		if (traffic && 'colourVariety' in patch) traffic.repaint();
		return { ...TRAFFIC_DIALS, ...PASS_DIALS };
	},

	sample(n = 5) {
		if (!traffic) return [];
		const m = traffic.mesh;
		const out = [];
		const e = m.instanceMatrix.array;
		for (let i = 0; i < m.count && out.length < n; i++) {
			const o = i * 16;
			if (e[o + 12] === 0 && e[o + 13] === 0 && e[o + 14] === 0) continue;
			out.push({ x: +e[o + 12].toFixed(1), y: +e[o + 13].toFixed(1), z: +e[o + 14].toFixed(1) });
		}
		return out;
	},
};

async function loadVariants() {
	variants = [];
	try {
		const res = await fetch(url(`${CHUNK}.variants`, 'json'));
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const manifest = await res.json();
		variantRoads = manifest.roads || {};
		for (const v of manifest.variants) variants.push(v);

		const only = variants.filter((v) => v.name === ONLY_VARIANT);
		if (only.length) variants = only;
	} catch (err) {
		variants = [];
		console.warn(`no ${CHUNK}.variants.json — run the level tools to get V`, err);
	}
}

const keys = Object.create(null);
window.addEventListener('keydown', (e) => {
	if (handleKey(e)) { e.preventDefault(); return; }
	keys[e.code] = true;
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

let padMod = null;

let padNow = null;
let padSeen = false;

let padZoomRate = 1.1;
let padZoomInvert = false;

let padReset = false;
let padSnap = false;

let padOrbit = false;

let padMenu = false;
let padCamCycle = false;
let padTab = false;
let padNav = false;
let padConfirm = false;
let padBack = false;
let padRow = 0;

const PAD_REPEAT_FIRST = 0.42;
const PAD_REPEAT_NEXT = 0.11;
let padRepeat = 0;

function padMenuRows() {
	const page = document.querySelector('#menu-body section.on');
	return page ? Array.from(page.querySelectorAll('.ctl')) : [];
}

function padMenuPaint(rows) {
	for (let i = 0; i < rows.length; i += 1) {
		rows[i].classList.toggle('pad-focus', i === padRow);
	}
	if (rows[padRow] && rows[padRow].scrollIntoView) {
		rows[padRow].scrollIntoView({ block: 'nearest' });
	}
}

function padMenuAdjust(row, dir) {
	if (!row) return;
	const sel = row.querySelector('select');
	if (sel && sel.options.length) {
		const n = sel.options.length;
		sel.selectedIndex = (sel.selectedIndex + dir + n) % n;
		sel.dispatchEvent(new Event('change', { bubbles: true }));
		return;
	}
	const range = row.querySelector('input[type="range"]');
	if (range) {
		const step = Number(range.step) || 1;
		const v = Number(range.value) + dir * step;
		range.value = String(Math.min(Number(range.max), Math.max(Number(range.min), v)));
		range.dispatchEvent(new Event('input', { bubbles: true }));
		return;
	}

	const sw = row.querySelector('button.sw');
	if (sw) sw.click();
}

function padMenuActivate(row) {
	if (!row) return;
	const sw = row.querySelector('button.sw');
	if (sw) { sw.click(); return; }
	const b = row.querySelector('button.ctl-btn');
	if (b) b.click();
}

function padMenuTab(dir) {
	const tabs = Array.from(document.querySelectorAll('#menu-head .tab'));
	if (!tabs.length || !window.driveMenu) return;
	const at = tabs.findIndex((t) => t.classList.contains('on'));
	const next = tabs[((at < 0 ? 0 : at) + dir + tabs.length) % tabs.length];
	if (next) {
        window.driveMenu.show(next.dataset.page);
		padRow = 0;
		padMenuPaint(padMenuRows());
	}
}

function padMenuStep(pad, dt) {
	const open = !!(window.driveMenu && window.driveMenu.isOpen && window.driveMenu.isOpen());
	if (!open || !pad) {
		padRepeat = 0;

		padBack = !!(pad && pad.back);
		return open;
	}
	const rows = padMenuRows();
	if (padRow >= rows.length) padRow = 0;

	if (pad.tabNext && !padTab) padMenuTab(1);
	else if (pad.tabPrev && !padTab) padMenuTab(-1);
	padTab = !!(pad.tabNext || pad.tabPrev);

	const held = pad.up || pad.down || pad.left || pad.right;
	let fire = false;
	if (held && !padNav) { fire = true; padRepeat = PAD_REPEAT_FIRST; }
	else if (held) {
		padRepeat -= dt;
		if (padRepeat <= 0) { fire = true; padRepeat = PAD_REPEAT_NEXT; }
	}
	padNav = held;

	if (fire && rows.length) {
		if (pad.up) padRow = (padRow - 1 + rows.length) % rows.length;
		else if (pad.down) padRow = (padRow + 1) % rows.length;
		else if (pad.left) padMenuAdjust(rows[padRow], -1);
		else if (pad.right) padMenuAdjust(rows[padRow], 1);
		padMenuPaint(rows);
	}

	if (pad.confirm && !padConfirm) padMenuActivate(rows[padRow]);
	padConfirm = !!pad.confirm;

	if (pad.back && !padBack && window.driveMenu) window.driveMenu.close();
	padBack = !!pad.back;
	return true;
}

let padBrakeExp = 2.0;
let padTopLift = 1.25;

window.addEventListener('gamepadconnected', (e) => {
	const id = e && e.gamepad ? e.gamepad.id : 'pad';
	const std = e && e.gamepad && e.gamepad.mapping === 'standard';
	status(std
		? `pad connected — ${id}. Left stick steers, R2/L2 are the pedals, `
			+ 'right stick up and down is the zoom.'
		: `pad connected but the browser does not know its layout (${id}) — `
			+ 'open /web/padtest.html to see the raw indices.');
});

let touchCtl = null;

let touchOn = false;

const TOUCH_STEER_MODES = ['buttons', 'stick'];
let touchSteer = 'buttons';

let touchReset = true;

let touchClean = false;
try {
	const saved = localStorage.getItem('drive.touch');
	touchOn = saved === null ? isTouchDevice() : saved === 'on';
	const st = localStorage.getItem('drive.touch.steer');
	if (TOUCH_STEER_MODES.includes(st)) touchSteer = st;
	touchReset = localStorage.getItem('drive.touch.reset') !== 'off';

	touchClean = localStorage.getItem('drive.touch.clean') === 'on';
} catch (err) { touchOn = isTouchDevice(); }

function applyTouch() {
	if (touchCtl) {
		touchCtl.setSteerMode(touchSteer);
		touchCtl.setResetVisible(touchReset);

		touchCtl.setCleanMode(touchClean);
		touchCtl.setEnabled(touchOn);
	}
	try {
		localStorage.setItem('drive.touch', touchOn ? 'on' : 'off');
		localStorage.setItem('drive.touch.steer', touchSteer);
		localStorage.setItem('drive.touch.reset', touchReset ? 'on' : 'off');
		localStorage.setItem('drive.touch.clean', touchClean ? 'on' : 'off');
	} catch (err) {   }
}

async function ensureTouch() {
	if (touchCtl) return touchCtl;
	const { createTouchControls } = await import(`./touch.js${MODULE_STAMP}`);
	touchCtl = createTouchControls({
		root: document.getElementById('touch'),

		onZoom: (r) => {
			camZoomWant = THREE.MathUtils.clamp(
				camZoomWant * r, ZOOM_MIN, ZOOM_MAX);
		},

		onMenu: () => { if (window.driveMenu) window.driveMenu.toggle(); },

		onReset: () => {
			if (flying) setFlying(false);
			respawn('respawned');
		},

		busy: () => !!(window.driveMenu && window.driveMenu.isOpen
			&& window.driveMenu.isOpen()),
	});
	applyTouch();
	return touchCtl;
}

if (typeof window !== 'undefined') {
	window.__touch = () => {
		const t = touchCtl ? touchCtl.read() : null;
		return {
			on: touchOn,
			built: !!touchCtl,
			held: !!(t && t.held),
			steer: t && t.held ? t.steer : 0,
			forward: !!(t && t.forward),
			back: !!(t && t.back),
			left: !!(t && t.left),
			right: !!(t && t.right),
			mode: touchSteer,
			clean: touchClean,
			mph: car ? car.speedMph : null,
			zoom: camZoom,

			zoomWant: camZoomWant,
			respawns,
			spawns: (spawnList || []).map((s) => s.label),
		};
	};

	window.__touch.setOn = (v) => { touchOn = !!v; applyTouch(); return touchOn; };
	window.__touch.setReset = (v) => {
		touchReset = !!v;
		applyTouch();
		return touchReset;
	};
	window.__touch.setSteer = (m) => {
		touchSteer = TOUCH_STEER_MODES.includes(m) ? m : touchSteer;
		applyTouch();
		return touchSteer;
	};

	window.__touch.setClean = (v) => {
		touchClean = !!v;
		applyTouch();
		return touchClean;
	};
}

function readInput() {

	if (flying) {
		return { forward: false, back: false, left: false, right: false,
			brake: true, handbrake: true, boost: false };
	}
	const input = {
		forward: !!(keys.KeyW || keys.ArrowUp),
		back: !!(keys.KeyS || keys.ArrowDown),
		left: !!(keys.KeyA || keys.ArrowLeft),
		right: !!(keys.KeyD || keys.ArrowRight),
		brake: !!keys.Space,
		handbrake: !!keys.Space,
		boost: !!(keys.ShiftLeft || keys.ShiftRight),
	};

	const touch = touchCtl ? touchCtl.read() : null;
	if (touch) {
		if (touch.held && touch.steer !== 0) input.steer = touch.steer;

		if (touch.left) input.left = true;
		if (touch.right) input.right = true;
		if (touch.forward) input.forward = true;
		if (touch.back) input.back = true;
	}

	if (!padNow) return input;

	if (padNow.steer !== 0) input.steer = padNow.steer;
	if (padNow.throttle !== 0) input.throttle = padNow.throttle;
	if (padNow.brake !== 0) input.brake = padNow.brake;

	if (padNow.throttle > 0) input.topLift = padNow.topLift;

	if (padNow.handbrake) input.handbrake = true;
	if (padNow.boost) input.boost = true;
	return input;
}

let waterNearGround = false;

let camName = defaultCamera(isTouchDevice());

let frameBelow = 0.30;


const ZOOM_MIN = 0.56;

const ZOOM_MAX = 13.0;

let zoomPerWheel = 0.0027;


(() => {
	const q = new URLSearchParams(location.search).get('zoomstep');
	if (q === null) return;
	const v = Number(q);
	if (!Number.isFinite(v) || v <= 0) return;

	zoomPerWheel = THREE.MathUtils.clamp(v > 0.1 ? Math.log(1 + v / 100) / 100 : v,
		0.0008, 0.0060);
})();

const ZOOM_EASE = 7.0;

function wheelSteps(e) {
	const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
	return THREE.MathUtils.clamp(e.deltaY * unit, -120, 120);
}
let camZoom = 1.00;

let camZoomWant = camZoom;

function easeZoom(dt) {
	const d = camZoomWant - camZoom;
	if (Math.abs(d) < 1e-4) { camZoom = camZoomWant; return; }
	camZoom += d * (1 - Math.exp(-Math.min(dt, 0.25) * ZOOM_EASE));
}


let handlingName = DRIVEN_DEFAULTS.handling;
const carScale = () => (car && car.scale) || 1.0;

const _eyeFwd = new THREE.Vector3();

const spinners = [];

function collectSpinners(root, layerKey) {
	let found = 0;
	root.traverse((o) => {
		if (!o.isMesh || !o.userData) return;
		const rpm = Number(o.userData.spin_rpm);
		const axis = o.userData.axis;
		if (!Number.isFinite(rpm) || rpm === 0) return;
		if (!Array.isArray(axis) || axis.length !== 3) return;

		o.geometry.computeBoundingBox();
		const centre = new THREE.Vector3();
		o.geometry.boundingBox.getCenter(centre);
		o.geometry.translate(-centre.x, -centre.y, -centre.z);
		o.position.add(centre);

		spinners.push({
			mesh: o,
			axis: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(),
			speed: (rpm * Math.PI * 2) / 60,
			angle: 0,
		});
		found++;
	});
	if (found) {
		;
	}
}

function stepSpinners(dt) {
	for (const s of spinners) {
		s.angle += s.speed * dt;
		s.mesh.quaternion.setFromAxisAngle(s.axis, s.angle);
	}
}

const FLY_SPEED = 18.0;

const _fwd = new THREE.Vector3();
const _flat = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

const FREE_CENTRE_UP = 0.354;
const FREE_BACK = 5.0;
const FREE_SIDE = 3.4;
const FREE_UP = 2.6;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.499;
controls.enabled = false;
let flying = false;

function setFlying(on) {
	flying = on;
	controls.enabled = on;

	if (on && lookOn) setLook(false);
	if (on) {

		const t = car.renderPos || car.chassis.translation();
		const s = carScale();
		controls.target.set(t.x, t.y + FREE_CENTRE_UP * s, t.z);

		_fwd.set(0, 0, -1).applyQuaternion(car.renderQuat || car.chassis.rotation());
		_fwd.y = 0;
		if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1); else _fwd.normalize();
		_right.crossVectors(_fwd, _UP).normalize();
		camera.position.copy(controls.target)
			.addScaledVector(_fwd, -FREE_BACK * s)
			.addScaledVector(_right, FREE_SIDE * s);
		camera.position.y = controls.target.y + FREE_UP * s;
		controls.update();
		status('free fly — W A S D move, Q E down/up, shift faster, '
			+ 'drag to orbit, wheel to zoom. F returns to the car.');
	} else {

		applyCamera(camera, car, 1, {
			preset: CAMERAS[camName], zoom: camZoom, carScale: carScale(),
		});
		status('back on the car');
	}
}

function flyStep(dt) {
	const speed = FLY_SPEED * (keys.ShiftLeft || keys.ShiftRight ? 4 : 1) * dt;
	_move.set(0, 0, 0);
	camera.getWorldDirection(_fwd);
	_flat.set(_fwd.x, 0, _fwd.z);
	if (_flat.lengthSq() < 1e-9) _flat.set(0, 0, -1);
	_flat.normalize();
	_right.crossVectors(_flat, _UP).normalize();
	if (keys.KeyW || keys.ArrowUp) _move.add(_flat);
	if (keys.KeyS || keys.ArrowDown) _move.sub(_flat);
	if (keys.KeyD || keys.ArrowRight) _move.add(_right);
	if (keys.KeyA || keys.ArrowLeft) _move.sub(_right);
	if (keys.KeyE) _move.y += 1;
	if (keys.KeyQ) _move.y -= 1;
	if (_move.lengthSq() > 0) {
		_move.normalize().multiplyScalar(speed);
		camera.position.add(_move);
		controls.target.add(_move);
	}
	controls.update();
}

let lookYaw = 0;
let lookPitch = 0;
let lookOn = false;

let lookMode = 'hold';
let lookReturnS = 2.5;
let lookSens = 0.0022;
let lookInvert = false;
let lookIdle = 0;

let lookFromMouse = false;

let lookSnap = false;

const LOOK_SNAP_EASE = 14;

function wrapYaw(a) {
	const t = Math.PI * 2;
	return ((a + Math.PI) % t + t) % t - Math.PI;
}
const LOOK_EASE = 3.2;

function setLook(on) {
	const want = !!on && !flying;
	if (want === lookOn) return;
	lookOn = want;
	setFreeLook(want);
	if (want) {

		lookFresh = true;
		lookDebug = [];
		if (renderer.domElement.requestPointerLock) {
			renderer.domElement.requestPointerLock();
		}
		status(renderer.domElement.requestPointerLock
			? 'mouselook — move the mouse to look, '
				+ (lookMode === 'return'
					? `view returns after ${lookReturnS.toFixed(1)} s. `
					: 'the view holds where you point it. ')
				+ 'Esc or K releases.'
			: 'free camera — the right stick looks around. R3 again to release.');
	} else {
		lookIdle = 0;
		if (document.pointerLockElement === renderer.domElement && document.exitPointerLock) {
			document.exitPointerLock();
		}
	}
}

let lookFresh = false;
const LOOK_MAX_PX = 160;

let lookDebug = [];

document.addEventListener('pointerlockchange', () => {
	const locked = document.pointerLockElement === renderer.domElement;

	if (locked) { lookFresh = true; lookDebug = []; }
	else if (lookOn) setLook(false);
	if (!locked) {

		lookIdle = 0;
	}
});

document.addEventListener('mousemove', (e) => {
	if (!lookOn) return;

	if (document.pointerLockElement !== renderer.domElement) return;
	let dx = e.movementX || 0;
	let dy = e.movementY || 0;
	if (!dx && !dy) return;

	if (lookDebug.length < 6) {
		lookDebug.push({
			first: lookFresh, dx, dy,
			degX: +THREE.MathUtils.radToDeg(dx * lookSens).toFixed(1),
		});
	}
	if (lookFresh) { lookFresh = false; return; }

	dx = THREE.MathUtils.clamp(dx, -LOOK_MAX_PX, LOOK_MAX_PX);
	dy = THREE.MathUtils.clamp(dy, -LOOK_MAX_PX, LOOK_MAX_PX);

	lookSnap = false;
	lookYaw = wrapYaw(lookYaw - dx * lookSens);

	lookPitch = THREE.MathUtils.clamp(
		lookPitch + (lookInvert ? -dy : dy) * lookSens,
		-VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT);
	lookIdle = 0;
	lookFromMouse = true;
});

function updateLook(dt) {

	if (lookSnap) {
		const a = 1 - Math.exp(-dt * LOOK_SNAP_EASE);
		lookYaw += (0 - lookYaw) * a;
		lookPitch += (0 - lookPitch) * a;
		if (Math.abs(lookYaw) < 1e-3 && Math.abs(lookPitch) < 1e-3) {
			lookYaw = 0;
			lookPitch = 0;
			lookSnap = false;
		}
		setViewAngles(lookYaw, lookPitch);
		return;
	}
	if (lookFromMouse && lookMode === 'return' && (lookYaw || lookPitch)) {
		lookIdle += dt;
		if (lookIdle >= lookReturnS) {
			const a = 1 - Math.exp(-dt * LOOK_EASE);
			lookYaw += (0 - lookYaw) * a;
			lookPitch += (0 - lookPitch) * a;
			if (Math.abs(lookYaw) < 1e-4) lookYaw = 0;
			if (Math.abs(lookPitch) < 1e-4) lookPitch = 0;
		}
	}
	setViewAngles(lookYaw, lookPitch);
}

renderer.domElement.addEventListener('wheel', (e) => {
	if (flying) return;
	if (window.driveMenu && window.driveMenu.isOpen && window.driveMenu.isOpen()) return;
	e.preventDefault();

	camZoomWant = THREE.MathUtils.clamp(
		camZoomWant * Math.exp(wheelSteps(e) * zoomPerWheel), ZOOM_MIN, ZOOM_MAX);
}, { passive: false });

let laneNav = null;
let laneNavSample = null;

const RESPAWN_REACH_M = 400;

const RESPAWN_H_WEIGHT = 3.0;

function nearestDrivablePose(x, y, z) {
	if (!laneNav || !laneNavSample || !laneNav.nodes) return null;
	const useY = Number.isFinite(y);
	const spawnable = new Set(laneNav.spawn || []);

	let bestS = null, bestSD2 = RESPAWN_REACH_M * RESPAWN_REACH_M;
	let bestA = null, bestAD2 = RESPAWN_REACH_M * RESPAWN_REACH_M;
	for (let n = 0; n < laneNav.nodes.length; n++) {
		const node = laneNav.nodes[n];
		const pts = node.pts;
		if (!pts || pts.length < 6) continue;
		const ok = spawnable.has(n);
		for (let i = 0; i < pts.length; i += 3) {
			const dx = pts[i] - x;
			const dz = pts[i + 2] - z;
			const dy = useY ? (pts[i + 1] - y) * RESPAWN_H_WEIGHT : 0;
			const d2 = dx * dx + dy * dy + dz * dz;
			if (d2 < bestAD2) { bestAD2 = d2; bestA = { node, i: i / 3 }; }
			if (ok && d2 < bestSD2) { bestSD2 = d2; bestS = { node, i: i / 3 }; }
		}
	}
	const hit = bestS || bestA;
	if (!hit) return null;

	const s = hit.node.cum ? hit.node.cum[hit.i] : 0;
	const p = laneNavSample(hit.node, s);

	return { x: p.x, y: p.y + 1.0, z: p.z, yaw: p.heading + Math.PI };
}

const SPAWN_COUNT = 7;

const SPAWN_INSET_M = 20;

let spawnList = null;
let spawnAt = 'start';

async function buildSpawnList() {
	const start = { key: 'start', label: 'start', x: chunk.spawn.x,
		y: chunk.spawn.y, z: chunk.spawn.z, yaw: chunk.yaw };
	spawnList = [start];

	for (const e of (chunk.meta && chunk.meta.extra_spawns) || []) {
		if (!e || !Number.isFinite(e.x)) continue;
		if (!isSeated(e.x, e.z)) {
			console.warn(`[spawn] authored point "${e.label}" is not on the map — skipped`);
			continue;
		}
		spawnList.push({
			key: `x${spawnList.length}`, label: e.label || 'somewhere',
			x: e.x, y: e.y, z: e.z, yaw: e.yaw,
		});
	}
	if (!laneNav || !laneNavSample || !laneNav.nodes) return spawnList;

	let names = {};
	try {
		const j = await sidecarJson(`${CHUNK}.names`, true);
		names = (j && j.names) || {};
	} catch (err) {   }

	const spawnHalf = (chunk.meta && chunk.meta.size ? chunk.meta.size / 2 : Infinity)
		- SPAWN_INSET_M;

	const cand = [];
	let rejectedOutside = 0;
	for (const n of (laneNav.spawn || [])) {
		const node = laneNav.nodes[n];
		if (!node || !node.inBox || !node.pts || node.pts.length < 6) continue;
		if (!(node.length > 0)) continue;
		const p = laneNavSample(node, node.length / 2);
		if (!p || !Number.isFinite(p.x)) continue;
		if (Math.abs(p.x) > spawnHalf || Math.abs(p.z) > spawnHalf) {
			rejectedOutside += 1;
			continue;
		}

		cand.push({ x: p.x, y: p.y + 1.0, z: p.z, yaw: p.heading + Math.PI,
			name: names[node.roadId] || '' });
	}

	if (!cand.length) {
		if (rejectedOutside) {
			console.warn(`[spawn] every candidate was outside the box (${rejectedOutside})`
				+ ' — falling back to unfiltered points');
		}
		return spawnList;
	}

	const chosen = [start];
	const used = new Set();

	for (let pass = 0; pass < 2; pass++) {
		const wantNamed = pass === 0;
		while (chosen.length < SPAWN_COUNT + 1) {
			let best = null;
			let bestD = -1;
			for (const c of cand) {
				if (c.taken) continue;
				if (wantNamed && (!c.name || used.has(c.name))) continue;
				let near = Infinity;
				for (const q of chosen) {
					const d = (c.x - q.x) * (c.x - q.x) + (c.z - q.z) * (c.z - q.z);
					if (d < near) near = d;
				}
				if (near > bestD) { bestD = near; best = c; }
			}
			if (!best) break;
			best.taken = true;
			if (best.name) used.add(best.name);
			chosen.push(best);
		}
	}

	const authored = spawnList.slice(1);
	spawnList = [chosen[0], ...authored, ...chosen.slice(1).map((c, i) => ({
		key: String(i + 1),
		label: c.name || `point ${i + 1}`,
		x: c.x, y: c.y, z: c.z, yaw: c.yaw,
	}))];
	return spawnList;
}

const SEATED_REACH_M = 15;

function isSeated(x, z) {
	const half = chunk.meta && chunk.meta.size ? chunk.meta.size / 2 : Infinity;
	if (Math.abs(x) > half || Math.abs(z) > half) return false;
	if (!laneNav || !laneNav.nodes) return true;
	const reach2 = SEATED_REACH_M * SEATED_REACH_M;
	for (const node of laneNav.nodes) {
		const pts = node && node.pts;
		if (!pts) continue;
		for (let i = 0; i < pts.length; i += 3) {
			const dx = pts[i] - x;
			const dz = pts[i + 2] - z;
			if (dx * dx + dz * dz < reach2) return true;
		}
	}
	return false;
}

function boxSpawnPose() {
	return { x: chunk.spawn.x, y: chunk.spawn.y, z: chunk.spawn.z, yaw: chunk.yaw };
}

function seatAtStart(why) {
	if (!car) return;

	if (!why && (!(chunk.meta && chunk.meta.spawn_pinned)
		|| !isSeated(chunk.spawn.x, chunk.spawn.z))) {
		respawn(null);
		return;
	}
	const at = boxSpawnPose();
	car.teleport({ x: at.x, y: at.y, z: at.z }, at.yaw);
	meter.reset();

	applyCamera(camera, car, 1, {
		preset: CAMERAS[camName], zoom: camZoom, carScale: carScale(),
	});
	if (why) {
		respawns += 1;
		status(`${why} — back at the start`);
	}
}

function goToSpawn(key) {
	let at = (spawnList || []).find((s) => s.key === String(key));
	if (!at || !car) return;

	if (!isSeated(at.x, at.z)) {
		console.warn(`[spawn] "${at.label}" is not on the map — using the start instead`);
		at = { ...boxSpawnPose(), key: at.key, label: `${at.label} (off the map — start instead)` };
	}
	spawnAt = at.key;
	respawns += 1;
	car.teleport({ x: at.x, y: at.y, z: at.z }, at.yaw);
	meter.reset();

	applyCamera(camera, car, 1, {
		preset: CAMERAS[camName], zoom: camZoom, carScale: carScale(),
	});
	status(`moved to ${at.label}`);
}

let respawns = 0;

function respawn(why) {
	respawns += 1;

	const at = car && car.renderPos
		? nearestDrivablePose(car.renderPos.x, car.renderPos.y, car.renderPos.z)
		: null;

	if (at && isSeated(at.x, at.z)) {
		car.teleport({ x: at.x, y: at.y, z: at.z }, at.yaw);
		meter.reset();
		applyCamera(camera, car, 1, {
			preset: CAMERAS[camName], zoom: camZoom, carScale: carScale(),
		});

		if (why) status(`${why} — on the nearest road, facing the way it runs`);
		return;
	}
	car.teleport({ x: chunk.spawn.x, y: chunk.spawn.y, z: chunk.spawn.z }, chunk.yaw);
	meter.reset();

	applyCamera(camera, car, 1, {
		preset: CAMERAS[camName], zoom: camZoom, carScale: carScale(),
	});
	if (why) status(`${why} — back at the start`);
}





const _look = () => CAR_LOOK[(new URLSearchParams(location.search).get('car')
	|| DEFAULT_CAR).toLowerCase()] || {};
let paintName = (new URLSearchParams(location.search).get('paint')
	|| _look().paint || '').toLowerCase();
let roofName = (new URLSearchParams(location.search).get('roof') || 'follow').toLowerCase();

function setPaint(name) {
	paintName = String(name || '').toLowerCase();
	if (car && car.carMesh && car.carMesh.setPaint) car.carMesh.setPaint(paintName, null);
	const u = new URL(location.href);
	u.searchParams.set('paint', paintName);
	history.replaceState(null, '', u.toString());
	status(`paint ${paintName}`);
}



let spoilerName = (new URLSearchParams(location.search).get('spoiler')
	|| _look().spoiler || '').toLowerCase();
let stripeName = (new URLSearchParams(location.search).get('stripe')
	|| _look().stripe || '').toLowerCase();



const beamTune = { gain: 90, cone: 0.42, range: 55 };
let beamTuneSeeded = false;



function seedBeamTune() {
	if (beamTuneSeeded || !car || !car.carMesh || !car.carMesh.beamTuning) return;
	const t = car.carMesh.beamTuning();
	beamTune.gain = t.gain;
	beamTune.cone = t.cone;
	beamTune.range = t.range;
	beamTuneSeeded = true;
}
















let lightMode = 'auto';
let beamsOn = true;

let spoilerOn = ['1', 'on', 'true', 'yes']
	.includes((new URLSearchParams(location.search).get('spoiler') || '').toLowerCase());

let cinematicOn = false;






function handleKey(e) {
	if (!car) return false;

	if (e.metaKey || e.ctrlKey || e.altKey) return false;

	if (window.driveMenu && window.driveMenu.isOpen()
		&& e.key !== 'm' && e.key !== 'M') return true;

	if (mapView && mapView.isOpen && e.key !== 'Escape') return true;

	switch (e.key) {

	case 'm': case 'M':
		if (window.driveMenu) {

			if (lookOn) setLook(false);
			const open = window.driveMenu.toggle();

			if (open) for (const k in keys) keys[k] = false;
		}
		return true;

	case 'p': case 'P':
		speedoOn = !speedoOn;
		applySpeedo();
		status(speedoOn ? 'speedometer on' : 'speedometer off');
		return true;

	case 'o': case 'O':
		gpsOn = !gpsOn;
		if (gpsOn) ensureGps();
		applyGps();

		status(gpsOn
			? (gps ? 'GPS minimap on' : 'GPS minimap loading…')
			: 'GPS minimap off');
		return true;
	case 'z': case 'Z':

		lookSnap = true;
		lookIdle = 0;
		status('view returning behind the car');
		return true;
	case 'k': case 'K':
		setLook(!lookOn);
		return true;
	case 'r': case 'R':
		if (flying) setFlying(false);
		respawn('respawned');
		return true;

	case '?': case '/': {

		const order = cameraOrder();

		const back = e.shiftKey || e.key === '?';
		const i = (order.indexOf(camName) + (back ? -1 : 1)
			+ order.length) % order.length;
		camName = order[i];

		const r = cameraReadout(CAMERAS[camName], camZoom);
		status(`camera ${CAMERAS[camName].label}`
			+ (r.mounted ? '' : ` — ${r.degrees}° down at this zoom`)

			+ '  (: for the numbers)');
		return true;
	}

	default:
		return false;
	}
}



const hud = document.getElementById('hud');
const layersPanel = document.getElementById('layers');

let chromeOn = false;
try {
	chromeOn = localStorage.getItem('drive.chrome') === 'on';
} catch (err) {
	chromeOn = false;
}

let camLabelOn = false;
const camLabelEl = document.getElementById('camlabel');

function applyCamLabel() {
	if (camLabelEl) camLabelEl.classList.toggle('hidden', !camLabelOn);
	try {
		localStorage.setItem('drive.camlabel2', camLabelOn ? 'on' : 'off');
	} catch (err) {   }
}

let camTuneOn = false;

function holdTag(on, name) {
	return on
		? "<b>" + name + "</b> "
		: "<span class=\"dim\">" + name
			+ "</span> ";
}

function boomLine(p, r) {
	const dev = p.tilt - r.degrees;
	const hot = p.tSwing >= 1.0 || p.dSwing >= 0.25;
	return `<br><span class=\"dim\">boom </span>`
		+ `<b>${p.tilt.toFixed(1)}°</b>`
		+ ` <span class=\"dim\">(${dev >= 0 ? "+" : ""}${dev.toFixed(1)} vs asked)</span>`
		+ (hot ? `  <b>swing ${p.tSwing.toFixed(1)}°</b>`
			: `  <span class=\"dim\">swing ${p.tSwing.toFixed(1)}°</span>`)
		+ `<br><span class=\"dim\">len </span>`
		+ `<b>${p.dist.toFixed(2)} m</b>`
		+ (hot ? `  <b>swing ${p.dSwing.toFixed(2)} m</b>`
			: `  <span class=\"dim\">swing ${p.dSwing.toFixed(2)} m</span>`);
}

const DOM_WRITE_WARN = 20;
const domWrites = new Map();
let domWriteAt = 0;
const domWarned = new Set();

function setHTML(el, html, name) {
	if (!el || el.__htmlWas === html) return false;
	el.__htmlWas = html;
	el.innerHTML = html;
	domWrites.set(name, (domWrites.get(name) || 0) + 1);
	const now = performance.now();
	if (now - domWriteAt >= 1000) {
		for (const [k, n] of domWrites) {
			if (n > DOM_WRITE_WARN && !domWarned.has(k)) {
				domWarned.add(k);
				console.warn(`[dom] ${k} rewrote ${n} times in a second `
					+ `(budget ${DOM_WRITE_WARN}). An innerHTML write is a parse, a style `
					+ `recalc and a layout -- this will stutter the world. Throttle it, or `
					+ `round the value it prints so the unchanged-text guard can work.`);
				status(`⚠ ${k} is rewriting ${n}x/s — see the console`);
			}
		}
		domWrites.clear();
		domWriteAt = now;
	}
	return true;
}

const CAM_LABEL_HZ = 10;
let camLabelAt = 0;
function updateCamLabel(force) {

	const now = performance.now();
	if (!force && now - camLabelAt < 1000 / CAM_LABEL_HZ) return;
	camLabelAt = now;

	if (!camLabelEl) return;
	if (!camLabelOn && !camTuneOn) return;
	const cam = CAMERAS[camName];
	let html;
	if (camTuneOn) {
		const r = cameraReadout(cam, camZoom);

		const p = framingProbe();
		html = r.mounted
			? `<b>${r.label}</b>  fwd ${r.back}  up ${r.up}  fov ${r.fov}°`
			: `<b>${r.label}</b>  <span class="dim">${r.zoom.toFixed(2)}x</span>`
				+ `<br>tilt <b>${r.degrees.toFixed(1)}°</b>`

				+ (r.zone && r.zone !== 'none'
					? `  <span class="dim">[${r.zone}`
						+ (r.zoneT > 0 && r.zoneT < 1
							? ` ${(r.zoneT * 100).toFixed(0)}%` : '')
						+ ']</span>'
					: '')
				+ `  car <b>${(r.frameBelow * 100).toFixed(0)}%</b> below`
				+ (p.ok ? ` <span class="dim">(${(p.below * 100).toFixed(0)}% measured)</span>` : '')
				+ `<br><span class="dim">back ${r.back}  up ${r.up}`
				+ `  fov ${r.fov}°  liftPow ${r.liftPow}</span>`

				+ `<br><span class=\"dim\">hold </span>`
				+ holdTag(getHoldFrame(), "frame")
				+ holdTag(getHoldAim(), "aim")
				+ holdTag(true, getBoomMode())
				+ holdTag(getBoomMode() === 'level', getBoomPull())
				+ holdTag(getBoomMode() === 'rig', getRigSwing())

				+ (p.ok ? boomLine(p, r) : "");
	} else {
		html = `${(cam && cam.label) || camName}`
			+ `  <span class="dim">${camZoom.toFixed(2)}x</span>`;
	}
	setHTML(camLabelEl, html, 'camera label');
}



try {

	camLabelOn = localStorage.getItem('drive.camlabel2') === 'on';
} catch (err) {   }
applyCamLabel();

const SPEEDO_MAX_MPH = 200;
const SPEEDO_LAG = 9.0;

let speedoOn = !isTouchDevice();

let speedoStyle = 'retro';

let speedoScale = 1;
let speedoNeedle = 0;
let speedoEls = null;

const speedoEl = document.getElementById('speedo');

function speedoPoint(cx, cy, r, deg) {
	const a = deg * Math.PI / 180;
	return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function speedoDial(cx, cy, R, startDeg, sweepDeg, opts) {
	const o = opts || {};
	const tickStep = o.tickStep || 20;
	const labelStep = o.labelStep || 100;
	const [ax, ay] = speedoPoint(cx, cy, R, startDeg);
	const [bx, by] = speedoPoint(cx, cy, R, startDeg + sweepDeg);
	const big = sweepDeg > 180 ? 1 : 0;
	const parts = [`<path class="arc" d="M ${ax.toFixed(1)} ${ay.toFixed(1)} `
		+ `A ${R} ${R} 0 ${big} 1 ${bx.toFixed(1)} ${by.toFixed(1)}"/>`];
	for (let v = 0; v <= SPEEDO_MAX_MPH; v += tickStep) {
		const major = v % (tickStep * 2) === 0;
		const deg = startDeg + sweepDeg * (v / SPEEDO_MAX_MPH);
		const [x1, y1] = speedoPoint(cx, cy, R - (major ? 15 : 9), deg);
		const [x2, y2] = speedoPoint(cx, cy, R, deg);
		const red = v >= SPEEDO_MAX_MPH * 0.8 ? ' red' : '';
		parts.push(`<line class="tick${major ? ' major' : ''}${red}" `
			+ `x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" `
			+ `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);

		if (v % labelStep === 0) {
			const [tx, ty] = speedoPoint(cx, cy, R - 28, deg);
			parts.push(`<text class="num" x="${tx.toFixed(1)}" `
				+ `y="${(ty + 4).toFixed(1)}">${v}</text>`);
		}
	}
	return parts.join('');
}

function speedoNeedleSvg(cx, cy, len) {
	return `<line class="needle" id="speedo-needle" x1="${cx}" y1="${cy}" `
		+ `x2="${cx}" y2="${cy - len}"/>`
		+ `<circle class="hub" cx="${cx}" cy="${cy}" r="4.5"/>`;
}

function speedoDigits(x, y, size, unitDy) {
	return `<text class="digital" id="speedo-num" x="${x}" y="${y}" `
		+ `style="font-size:${size}px">0</text>`
		+ `<text class="unit" x="${x}" y="${y + unitDy}">mph</text>`;
}

const SPEEDO_STYLES = {

	arc: {
		label: 'half dial', w: 164, h: 126, cx: 82, cy: 82, start: 180, sweep: 180,
		svg(s) {
			return `<path class="panel" d="M 0 82 A 82 82 0 0 1 164 82 L 164 116 `
				+ `Q 164 126 154 126 L 10 126 Q 0 126 0 116 Z"/>`
				+ speedoDial(s.cx, s.cy, 60, 180, 180, { tickStep: 20, labelStep: 100 })
				+ speedoNeedleSvg(s.cx, s.cy, 54)
				+ speedoDigits(s.cx, s.cy + 30, 30, 12);
		},
	},

	ring: {
		label: 'full round', w: 150, h: 150, cx: 75, cy: 75, start: 135, sweep: 270,
		svg(s) {
			return `<circle class="panel" cx="75" cy="75" r="75"/>`
				+ speedoDial(s.cx, s.cy, 66, 135, 270, { tickStep: 20, labelStep: 100 })
				+ speedoDigits(s.cx, s.cy + 30, 26, 12)
				+ speedoNeedleSvg(s.cx, s.cy, 52);
		},
	},

	bar: {
		label: 'bar', w: 216, h: 62, cx: 0, cy: 0, start: 0, sweep: 0, bar: true,
		svg() {
			return `<rect class="panel" x="0" y="0" width="216" height="62" rx="10"/>`
				+ `<rect class="track" x="14" y="40" width="188" height="9" rx="4.5"/>`
				+ `<rect class="fill" id="speedo-bar" x="14" y="40" width="0" `
				+ `height="9" rx="4.5"/>`
				+ `<text class="digital" id="speedo-num" x="108" y="31" `
				+ `style="font-size:30px">0</text>`
				+ `<text class="unit" x="196" y="31">mph</text>`;
		},
	},

	digits: {
		label: 'digits only', w: 132, h: 62, cx: 0, cy: 0, start: 0, sweep: 0,
		svg() {
			return `<rect class="panel" x="0" y="0" width="132" height="62" rx="10"/>`
				+ `<text class="digital" id="speedo-num" x="66" y="40" `
				+ `style="font-size:36px">0</text>`
				+ `<text class="unit" x="66" y="54">mph</text>`;
		},
	},

	retro: {
		label: 'retro amber', w: 150, h: 150, cx: 75, cy: 75, start: 150, sweep: 240,
		svg(s) {
			return `<circle class="panel" cx="75" cy="75" r="75"/>`
				+ `<circle class="arc" cx="75" cy="75" r="68" fill="none"/>`
				+ speedoDial(s.cx, s.cy, 62, 150, 240, { tickStep: 20, labelStep: 100 })
				+ speedoDigits(s.cx, s.cy + 34, 28, 13)
				+ speedoNeedleSvg(s.cx, s.cy, 50);
		},
	},
};
const SPEEDO_STYLE_ORDER = ['arc', 'ring', 'bar', 'digits', 'retro'];

function buildSpeedo() {
	if (!speedoEl) return;
	const s = SPEEDO_STYLES[speedoStyle] || SPEEDO_STYLES.arc;
	speedoEl.className = (speedoOn ? '' : 'hidden ') + 'sp-' + speedoStyle;
	speedoEl.innerHTML = `<svg viewBox="0 0 ${s.w} ${s.h}" `
		+ `width="${Math.round(s.w * speedoScale)}" `
		+ `height="${Math.round(s.h * speedoScale)}">${s.svg(s)}</svg>`;
	speedoEls = {
		style: s,
		needle: document.getElementById('speedo-needle'),
		num: document.getElementById('speedo-num'),
		bar: document.getElementById('speedo-bar'),
	};

	clampWidget(speedoEl);
}

function applySpeedo() {
	if (!speedoEl) return;
	speedoEl.classList.toggle('hidden', !speedoOn);
	try {
		localStorage.setItem('drive.speedo2', speedoOn ? 'on' : 'off');
		localStorage.setItem('drive.speedo.style', speedoStyle);
		localStorage.setItem('drive.hud.size', String(gpsSize));
		if (gps) localStorage.setItem('drive.gps.zoom', String(gps.zoom));
	} catch (err) {   }
}

function updateSpeedo(dt) {
	if (!speedoOn || !speedoEls || !car) return;
	const mph = car.speedMph;
	speedoNeedle += (mph - speedoNeedle) * (1 - Math.exp(-dt * SPEEDO_LAG));
	const frac = Math.min(speedoNeedle, SPEEDO_MAX_MPH) / SPEEDO_MAX_MPH;
	const s = speedoEls.style;
	if (speedoEls.needle) {
		const deg = s.start + s.sweep * frac;

		speedoEls.needle.setAttribute(
			'transform', `rotate(${(deg + 90).toFixed(2)} ${s.cx} ${s.cy})`);
	}
	if (speedoEls.bar) {
		speedoEls.bar.setAttribute('width', (188 * frac).toFixed(1));
	}
	if (speedoEls.num) speedoEls.num.textContent = String(Math.round(mph));
}

function clampWidget(el) {
	if (!el || el.style.left === '') return;
	const r = el.getBoundingClientRect();
	const x = Math.min(Math.max(parseFloat(el.style.left) || 0, 0),
		Math.max(0, window.innerWidth - r.width));
	const y = Math.min(Math.max(parseFloat(el.style.top) || 0, 0),
		Math.max(0, window.innerHeight - r.height));
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;
}

function makeWidgetDraggable(el, key, onTap) {
	if (!el) return;
	const store = `drive.pos.${key}`;
	const pin = (x, y) => {
		el.style.left = `${x}px`;
		el.style.top = `${y}px`;
		el.style.right = 'auto';
		el.style.bottom = 'auto';
		el.style.transform = 'none';
	};
	try {
		const saved = JSON.parse(localStorage.getItem(store) || 'null');
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
			localStorage.setItem(store, JSON.stringify({
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

let gpsSize = 150;

let gpsZoom = 0;

try {

	speedoOn = isTouchDevice()
		? localStorage.getItem('drive.speedo2') === 'on'
		: localStorage.getItem('drive.speedo2') !== 'off';
	const st = localStorage.getItem('drive.speedo.style');
	if (st && SPEEDO_STYLES[st]) speedoStyle = st;

	const gzoom = parseFloat(localStorage.getItem('drive.gps.zoom'));
	if (Number.isFinite(gzoom) && gzoom >= 25 && gzoom <= 900) gpsZoom = gzoom;
	const hz = parseInt(localStorage.getItem('drive.hud.size'), 10);
	if (Number.isFinite(hz) && hz >= 110 && hz <= 340) {
		gpsSize = hz;
		speedoScale = hz / 150;
	}
} catch (err) {   }
buildSpeedo();
applySpeedo();
makeWidgetDraggable(speedoEl, 'speedo');

if (typeof window !== 'undefined') {

	window.__gfx = () => ({
		logDepth: renderer.capabilities.logarithmicDepthBuffer,
		pixelRatio: +renderer.getPixelRatio().toFixed(3),
		antialias: !!(renderer.getContext().getContextAttributes() || {}).antialias,
		shadows: renderer.shadowMap.enabled,
		shadowType: renderer.shadowMap.type,

		shadowMap: (() => {
			let n = null;
			scene.traverse((o) => {
				if (n === null && o.isLight && o.castShadow && o.shadow) n = o.shadow.mapSize.x;
			});
			return n;
		})(),
		calls: renderer.info.render.calls,
		triangles: renderer.info.render.triangles,
		programs: renderer.info.programs ? renderer.info.programs.length : null,
	});
	window.__pose = () => (car && car.renderPos ? {
		x: +car.renderPos.x.toFixed(3),
		y: +car.renderPos.y.toFixed(3),
		z: +car.renderPos.z.toFixed(3),
		yaw: +(car.yaw || 0).toFixed(4),
		gps: (document.getElementById('gps') || {}).textContent || '',
	} : null);
	window.__camera = (name, zoom) => cameraReadout(
		CAMERAS[name] || CAMERAS[camName],
		zoom === undefined ? camZoom : zoom,
	);

	window.__tilts = (a, b) => {
		if (a === undefined) return (CAMERAS[camName] || {}).tiltStops || null;
		return b === undefined
			? setTiltStops(camName, a)
			: setTiltStops(a, b);
	};

	window.__framing = () => framingProbe();

	window.__eye = () => {
		const run = Math.hypot(
			camera.position.x - car.renderPos.x, camera.position.z - car.renderPos.z);
		const rise = camera.position.y - car.renderPos.y;

		const fwd = _eyeFwd.set(0, 0, -1).applyQuaternion(car.renderQuat);
		let az = Math.atan2(camera.position.x - car.renderPos.x,
			camera.position.z - car.renderPos.z) - Math.atan2(-fwd.x, -fwd.z);
		if (az > Math.PI) az -= 2 * Math.PI;
		if (az < -Math.PI) az += 2 * Math.PI;
		return {
			run: +run.toFixed(3),
			rise: +rise.toFixed(3),
			deg: +THREE.MathUtils.radToDeg(Math.atan2(rise, run)).toFixed(1),
			az: +THREE.MathUtils.radToDeg(az).toFixed(2),
			mph: Math.round((car.speedMs || 0) * 2.23694),
		};
	};

	window.__view = (yawDeg, pitchDeg) => {
		lookSnap = false;
		lookIdle = 0;
		lookFromMouse = false;
		lookYaw = wrapYaw(THREE.MathUtils.degToRad(yawDeg || 0));
		if (pitchDeg !== undefined) {
			lookPitch = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(pitchDeg),
				-VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT);
		}
		setViewAngles(lookYaw, lookPitch);
		return { yaw: +THREE.MathUtils.radToDeg(lookYaw).toFixed(2),
			pitch: +THREE.MathUtils.radToDeg(lookPitch).toFixed(2) };
	};

	window.__zoom = (v) => { camZoomWant = v; camZoom = v; return camZoom; };

	window.__drift = () => (car ? car.driftInfo() : null);

	window.__setHb = (v) => { setHbSlip(v); return getHbSlip(); };
	window.__setDriftMode = (m) => { setDriftMode(m); return getDriftMode(); };
	window.__lookLog = () => ({
		yaw: +THREE.MathUtils.radToDeg(lookYaw).toFixed(1),
		pitch: +THREE.MathUtils.radToDeg(lookPitch).toFixed(1),
		sens: lookSens, events: lookDebug,
	});
	window.__steady = (v) => { setSteady(v === undefined ? true : v); return getSteady(); };
	window.__pin = (v) => { setPinBoom(v === undefined ? true : v); return getPinBoom(); };

	window.__orbit = (o) => {
		const opt = o || {};
		const mode = opt.mode || 'sweep';
		const turns = opt.turns === undefined ? 1 : opt.turns;
		const steps = opt.steps === undefined ? 72 : opt.steps;
		const settle = opt.settle === undefined ? 240 : opt.settle;
		const dt = 1 / 60;
		const keep = { yaw: lookYaw, pitch: lookPitch };

		const keepPin = getPinBoom();
		if (opt.pin !== undefined) setPinBoom(opt.pin);
		const pitch = opt.pitch === undefined ? lookPitch : opt.pitch;
		const preset = CAMERAS[opt.name] || CAMERAS[camName];
		const zoom = opt.zoom === undefined ? camZoom : opt.zoom;
		const out = [];
		const v = new THREE.Vector3();
		const shot = (yaw) => {
			v.copy(car.renderPos).project(camera);
			out.push({
				yaw: +THREE.MathUtils.radToDeg(yaw).toFixed(0),
				x: +v.x.toFixed(4),
				y: +v.y.toFixed(4),
				d: +camera.position.distanceTo(car.renderPos).toFixed(3),
			});
		};

		setViewAngles(0, pitch);
		for (let i = 0; i < settle; i++) {
			applyCamera(camera, car, dt, { preset, zoom, carScale: carScale() });
		}
		for (let s = 0; s < steps; s++) {
			const yaw = (Math.PI * 2 * turns * s) / steps;
			setViewAngles(yaw, pitch);
			const n = mode === 'settle' ? settle : 1;
			for (let i = 0; i < n; i++) {
				applyCamera(camera, car, dt, { preset, zoom, carScale: carScale() });
			}
			shot(yaw);
		}
		setViewAngles(keep.yaw, keep.pitch);
		if (opt.pin !== undefined) setPinBoom(keepPin);
		const xs = out.map((p) => Math.abs(p.x));
		const ys = out.map((p) => p.y);
		const ds = out.map((p) => p.d);
		const span = (a) => +(Math.max(...a) - Math.min(...a)).toFixed(4);
		return {
			mode,
			preset: preset.key,
			zoom,
			worstX: +Math.max(...xs).toFixed(4),
			ySpan: span(ys),
			dSpan: span(ds),
			dMean: +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(3),
			samples: out,
		};
	};
}

if (typeof window !== 'undefined') {
	window.__speedo = {
		style(name) {
			if (!SPEEDO_STYLES[name]) return `unknown: ${name}`;
			speedoStyle = name;
			buildSpeedo();
			applySpeedo();
			return name;
		},
		styles: () => SPEEDO_STYLE_ORDER.slice(),
	};
}


let gps = null;
let gpsOn = false;

let gpsData = null;
let gpsDataPromise = null;
let mapView = null;

let gpsMode = 'flat';

let gpsFlat = 'vector';
let gpsPalette = 'atlas';
let gpsLabel = true;

const HUD_SIZES = [
	{ value: 150, label: 'normal — 150 px' },
	{ value: 200, label: 'large — 200 px' },
	{ value: 255, label: 'larger — 255 px' },
	{ value: 310, label: 'huge — 310 px  (for recording)' },
];

function setHudSize(px) {
	gpsSize = px;
	speedoScale = px / 150;
	if (gps) gps.setSize(px);
	buildSpeedo();
	applySpeedo();
	applyGps();
}
let gpsLoading = false;
const gpsEl = document.getElementById('gps');

const _gpsFwd = new THREE.Vector3();

async function ensureGpsData() {
	if (gpsData) return gpsData;
	if (gpsDataPromise) return gpsDataPromise;
	gpsDataPromise = (async () => {

		const laneJson = await sidecarJson(`${CHUNK}.lanes`);
		const nameJson = await sidecarJson(`${CHUNK}.names`, true);
		const lanes = (laneJson && laneJson.lanes) || [];
		const names = (nameJson && nameJson.names) || null;
		gpsData = { lanes, names };
		return gpsData;
	})();
	return gpsDataPromise;
}









async function ensureGps() {
	if (gps || gpsLoading) return gps;

	if (!chunk || !chunk.meta || !chunk.meta.lanes) return null;
	gpsLoading = true;
	try {

		const M = await import(`./minimap.js${MODULE_STAMP}`);
		const { lanes, names: gpsNames } = await ensureGpsData();
		gps = M.createMinimap({
			lanes,
			id: 'gps',

			el: gpsEl,
			size: gpsSize,
			...(gpsZoom ? { zoomM: gpsZoom } : {}),
			mode: gpsMode,
			flatRender: gpsFlat,
			palette: gpsPalette,
			names: gpsNames,
			label: gpsLabel,

			draggable: false,
		});

		;
	} catch (err) {
		console.warn('[gps] the minimap did not load', err);
	} finally {
		gpsLoading = false;
	}
	applyGps();
	return gps;
}

function applyGps() {
	if (gpsEl) gpsEl.classList.toggle('hidden', !gpsOn);
	try {
		localStorage.setItem('drive.gps', gpsOn ? 'on' : 'off');
		localStorage.setItem('drive.gps.mode', gpsMode);
		localStorage.setItem('drive.gps.flat', gpsFlat);
		localStorage.setItem('drive.gps.palette', gpsPalette);
		localStorage.setItem('drive.gps.label', gpsLabel ? 'on' : 'off');
	} catch (err) {   }
}

function updateGps() {
	if (!gpsOn || !gps || !car) return;
	const p = car.renderPos;
	_gpsFwd.set(0, 0, -1).applyQuaternion(car.renderQuat);

	gps.update({
		x: p.x, y: p.y, z: p.z,
		heading: Math.atan2(_gpsFwd.z, _gpsFwd.x),
	});
}

const _mapFwd = new THREE.Vector3();
function updateMap() {
	if (!mapView || !mapView.isOpen || !car) return;
	const p = car.renderPos;
	_mapFwd.set(0, 0, -1).applyQuaternion(car.renderQuat);
	mapView.update({
		x: p.x, z: p.z, heading: Math.atan2(_mapFwd.z, _mapFwd.x),
	});
}

try {

	gpsOn = isTouchDevice()
		? localStorage.getItem('drive.gps') === 'on'
		: localStorage.getItem('drive.gps') !== 'off';
	const gm = localStorage.getItem('drive.gps.mode');
	if (gm === 'flat' || gm === 'tilt') gpsMode = gm;
	const gf = localStorage.getItem('drive.gps.flat');
	if (gf === 'vector' || gf === 'atlas') gpsFlat = gf;
	const gp = localStorage.getItem('drive.gps.palette');
	if (gp) gpsPalette = gp;
	gpsLabel = localStorage.getItem('drive.gps.label') !== 'off';
} catch (err) {   }

makeWidgetDraggable(gpsEl, 'gps');

if (typeof window !== 'undefined') {
	window.__gps = {
		async on() { gpsOn = true; await ensureGps(); applyGps(); return true; },
		mode(v) { gpsMode = v; if (gps) gps.setMode(v); applyGps(); return v; },
		flat(v) {
			gpsFlat = v;
			if (gps) gps.setFlatRender(v);
			applyGps();
			return v;
		},
		tilt(v) { if (gps) gps.setTilt(v); return v; },
		palette(v) { gpsPalette = v; if (gps) gps.setPalette(v); applyGps(); return v; },
		zoom(v) { if (gps) gps.setZoom(v); return v; },

		state() {
			return {
				zoomM: gps ? gps.zoom : null,
				sizePx: gpsSize,
				on: gpsOn,
			};
		},
		label(v) { gpsLabel = v; if (gps) gps.setLabel(v); applyGps(); return v; },
		size(v) { setHudSize(Number(v)); return gpsSize; },
		sizes: () => HUD_SIZES.map((s) => s.value),
		mapview: () => mapView,
		labels: () => (mapView ? mapView.labels : 0),
		street: () => (gps ? gps.street : ''),
		names: () => (gps ? gps.namesCount : 0),
		pose: () => (gps ? gps.pose : null),

		poke: (pz) => (gps ? (gps.update(pz), gps.street) : null),
		extent: () => (gps ? gps.extent : null),
		under: () => (gps ? gps.under : false),
		stats: () => (gps ? gps.atlas : null),
	};
}

function applyChrome() {
	document.body.classList.toggle('chrome-off', !chromeOn);
	try {
		localStorage.setItem('drive.chrome', chromeOn ? 'on' : 'off');
	} catch (err) {   }
}
applyChrome();
const meter = new JitterMeter();
let statusText = '';
let statusAt = 0;
function status(s) { statusText = s; statusAt = performance.now(); }

let jitterText = '';
let jitterAcc = 0;

const FT_N = 90;
const ftBuf = new Float32Array(FT_N);
let ftAt = 0, ftFilled = 0;

const SCALE_STEPS = [0.33, 0.5, 0.75, 1];

const AUTO_START = 1;

const AUTO_DROP_S = 0.0222;
const AUTO_RISE_S = 0.0175;

const AUTO_SETTLE_MS = 5000;

const AUTO_HOLD_MS = 1500;

const AUTO_PROBE_MS = 6000;
const AUTO_PENALTY_MS = 30000;

let autoScale = true;
let autoIdx = AUTO_START;
let autoNextAt = 0;

let autoLastUpAt = -Infinity;
const autoFailedAt = new Float64Array(SCALE_STEPS.length).fill(-Infinity);

function ftPercentile(p) {
	if (ftFilled < FT_N) return 0;
	const a = ftBuf.slice(0, ftFilled).sort();
	return a[Math.min(a.length - 1, Math.floor(p * a.length))];
}

function autoTick(now) {
	if (!autoScale) return;
	if (now < AUTO_SETTLE_MS || now < autoNextAt) return;
	const p90 = ftPercentile(0.90);
	if (!(p90 > 0)) return;
	let want = autoIdx;
	if (p90 >= AUTO_DROP_S && autoIdx > 0) {
		want = autoIdx - 1;
		if (now - autoLastUpAt < AUTO_PROBE_MS) autoFailedAt[autoIdx] = now;
	} else if (p90 <= AUTO_RISE_S && autoIdx < SCALE_STEPS.length - 1) {
		const next = autoIdx + 1;
		if (now - autoFailedAt[next] > AUTO_PENALTY_MS) {
			want = next;
			autoLastUpAt = now;
		}
	}
	if (want !== autoIdx) {
		autoIdx = want;
		pixelScale = SCALE_STEPS[autoIdx];
		applyPixelScale();

		ftAt = 0;
		ftFilled = 0;
	}
	autoNextAt = now + AUTO_HOLD_MS;
}

function setPixelScale(v) {
	autoScale = false;
	pixelScale = v;
	applyPixelScale();
}

function setAutoScale() {
	autoScale = true;

	let best = 0;
	for (let i = 0; i < SCALE_STEPS.length; i++) {
		if (SCALE_STEPS[i] <= pixelScale) best = i;
	}
	autoIdx = best;
	pixelScale = SCALE_STEPS[autoIdx];
	applyPixelScale();
	ftAt = 0;
	ftFilled = 0;
	autoNextAt = 0;

	autoLastUpAt = -Infinity;
	autoFailedAt.fill(-Infinity);
}

let hudHz = 0;
let hudAcc = 0;

let perfMode = false;
let perfSaved = null;

function setPerfMode(on) {
	if (!!on === perfMode) return;
	perfMode = !!on;
	if (perfMode) {
		perfSaved = {
			pixelScale,
			hudHz,
			shadowLevel: lighting ? lighting.shadowLevel : null,
			shadows: lighting ? lighting.shadows : null,
			clouds: lighting ? lighting.clouds : null,
			traffic: TRAFFIC_DIALS.on,

			trafficCount: TRAFFIC_DIALS.count,
			trafficRadius: TRAFFIC_DIALS.spawnRadius,
			treeDraw: forest ? forest.draw : null,
		};

		if (!autoScale) {
			pixelScale = 0.75;
			applyPixelScale();
		}
		hudHz = 10;
		hudAcc = 1e9;

		if (lighting) {
			lighting.shadows = false;
			lighting.shadowLevel = 'performance';
			lighting.clouds = 0;
		}

		TRAFFIC_DIALS.count = 70;
		TRAFFIC_DIALS.spawnRadius = 400;
		if (forest) forest.setDraw(350);

		status('PERF ON \u2014 HUD 10 Hz, 70 NPC cars within 400 m, shadows off, no clouds, '
			+ 'trees culled at 350 m'
			+ (autoScale ? ' (resolution left on auto)' : ', render 75%')
			+ '. Press \u0027 again to put every one of them back exactly as it was.');
	} else if (perfSaved) {

		if (!autoScale) {
			pixelScale = perfSaved.pixelScale;
			applyPixelScale();
		}
		hudHz = perfSaved.hudHz;
		hudAcc = 1e9;
		if (lighting && perfSaved.shadowLevel !== null) {
			lighting.shadowLevel = perfSaved.shadowLevel;

			if (perfSaved.shadows !== null) lighting.shadows = perfSaved.shadows;
			lighting.clouds = perfSaved.clouds;
		}
		TRAFFIC_DIALS.on = perfSaved.traffic;
		if (perfSaved.trafficCount != null) TRAFFIC_DIALS.count = perfSaved.trafficCount;
		if (perfSaved.trafficRadius != null) TRAFFIC_DIALS.spawnRadius = perfSaved.trafficRadius;
		if (forest && perfSaved.treeDraw !== null) forest.setDraw(perfSaved.treeDraw);
		perfSaved = null;
		status('perf off \u2014 everything back as it was');
	}
}

function frameStats() {
	if (ftFilled < 8) return '';
	let m = 0;
	for (let i = 0; i < ftFilled; i++) m += ftBuf[i];
	m /= ftFilled;
	let s = 0;
	for (let i = 0; i < ftFilled; i++) s += (ftBuf[i] - m) ** 2;
	s = Math.sqrt(s / ftFilled);
	return `${(1 / m).toFixed(0)} fps  ${(m * 1000).toFixed(1)}±${(s * 1000).toFixed(1)} ms`;
}

let profOn = false;
const PROF_KEYS = ['phys', 'scenery', 'camera', 'signals', 'trees', 'light',
	'traffic', 'hud', 'render'];
const profSum = Object.create(null);
const profPeak = Object.create(null);
for (const k of PROF_KEYS) { profSum[k] = 0; profPeak[k] = 0; }
let profFrames = 0;
let profText = '';

function pMark() { return profOn ? performance.now() : 0; }

function pAdd(key, t0) {
	if (!profOn || !t0) return;
	const ms = performance.now() - t0;
	profSum[key] += ms;
	if (ms > profPeak[key]) profPeak[key] = ms;
}

function profRoll() {
	if (!profOn) { profText = ''; profFrames = 0; return; }
	if (++profFrames < FT_N) return;
	const parts = [];
	for (const k of PROF_KEYS) {
		parts.push(`${k} ${(profSum[k] / profFrames).toFixed(1)}`
			+ `/<b>${profPeak[k].toFixed(0)}</b>`);
		profSum[k] = 0;
		profPeak[k] = 0;
	}
	profFrames = 0;
	profText = `ms mean/peak — ${parts.join('  ')}`;
}

function renderHud() {
	const fresh = performance.now() - statusAt < 6000;

	const v = activeVariant();
	hud.innerHTML =
		`<span class="big">${car.speedMph.toFixed(0)} mph</span>`
		+ `  <span class="dim">${handlingName}</span>`

		+ `  <span class="dim">·</span>  <b>${LEVEL_NAME}</b>`
		+ `  <span class="dim">·</span>  <span class="dim">road</span> `
		+ `<span class="big">${variantName()}</span>`

		+ (v && v.note ? `  <span class="dim full">${v.note}</span>` : '')

		+ (seamsOn ? '  <span class="off">SEAMS</span>' : '')
		+ (wireOn ? '  <span class="off">WIRE</span>' : '')
		+ (rainbowOn ? '  <span class="off">RAINBOW</span>' : '')
		+ (texOn ? '  <span class="on">ASPHALT</span>' : '')
		+ (flatOn ? '  <span class="off">FLAT</span>' : '  <span class="on">SMOOTH</span>')
		+ (inspectOn ? '  <span class="off">PICK</span>' : '')

		+ (waterNearGround && !renderer.capabilities.logarithmicDepthBuffer
			? '  <span class="off">WATER · NO LOGDEPTH</span>' : '')
		+ (perfMode ? '  <span class="off">PERF</span>' : '')

		+ (getTurnMode() === 'stiff' ? '  <span class="on">STIFF</span>' : '')
		+ (getCraneMode() && lookOn ? '  <span class="on">COMPASS</span>' : '')
		+ (editOn ? `  <span class="on">POINTS${editRoads.size
			? ' ' + editRoads.size : ''}</span>` : '')
		+ (picked
			? `  <span class="on">◆ ${picked.id < 0 ? 'junction' : 'road'} `
				+ `${Math.abs(picked.id)}`
				+ `${picked.info.name ? ' ' + picked.info.name : ''}</span>`
			: '')
		+ `  <span class="dim full">·</span>  <span class="dim full">F cam</span> `
		+ (flying
			? '<span class="on">FREE FLY</span>'
			: `<span class="full">${CAMERAS[camName].label} `
				+ `${camZoom.toFixed(2)}x</span>`)
		+ `  <span class="dim full">·</span>  <span class="dim full">${frameStats()}</span>`

		+ (capBinds
			? `  <span class="${performance.now() - capBindAt < 2000 ? 'off' : 'dim'} full">`
				+ `step cap ×${capBinds}</span>`
			: '')

		+ (profText ? `<span class="dim full">\n${profText}</span>` : '')
		+ `<span class="dim full">\n${parityLine(car, world)}</span>`
		+ (jitterText
			? `<span class="full">\n${jitterText}</span>`
			: '<span class="dim full">\nmeter filling…</span>')
		+ `<span class="dim full">\n`
		+ `${(renderer.info.render.triangles / 1000).toFixed(1)}k drawn, `
		+ `${renderer.info.render.calls} draws</span>`

		+ (fresh ? `\n<span class="on">${statusText}</span>` : '');
}

const SKY_MODES = [
	{ id: 'day', label: 'daytime', t: TIME_AT_BOOT },

	{ id: 'sunset', label: 'sunset', t: 0.742 },

	{ id: 'night', label: 'nighttime', t: 0.82, preset: true },
];
let skyMode = 0;

function setSkyMode(i, note = true) {
	if (!lighting) return;
	skyMode = ((i % SKY_MODES.length) + SKY_MODES.length) % SKY_MODES.length;
	const m = SKY_MODES[skyMode];
	lighting.timeOfDay = m.t;

	lighting.running = false;

	lighting.nightPreset = !!m.preset;
	try {
		applyStyleExtras(lighting.style);
		lightFocus.copy(car ? car.chassis.translation() : camera.position);
		lighting.update(0, lightFocus);
		if (lighting.rebake) lighting.rebake();

		applyWorldTones();
	} catch (err) {
		console.warn('[sky] mode switch could not fully re-apply:',
			err && err.message ? err.message : err);
	}
	if (note) status(`${m.label} — ${lighting.clockText()}`);
}

let physAccum = 0;
let last = 0;
const FALL_LIMIT = -200;

let physDt = FIXED_DT;
let physDrain = true;
const PHYS_CAP = 10;
let capBinds = 0;
let capBindAt = 0;

let ghostOn = false;
let ghostOk = false;

const GHOST_SPEED = 20;
const ghostPos = new THREE.Vector3();
const ghostQuat = new THREE.Quaternion();
const ghostFwd = new THREE.Vector3();
const GHOST_UP = new THREE.Vector3(0, 1, 0);

function ghostStep(dt) {
	if (!ghostOk) {
		ghostPos.copy(car.renderPos);
		ghostFwd.set(0, 0, -1).applyQuaternion(car.renderQuat);
		ghostFwd.y = 0;
		if (ghostFwd.lengthSq() < 1e-9) ghostFwd.set(0, 0, -1);
		ghostFwd.normalize();
		ghostQuat.setFromAxisAngle(GHOST_UP, Math.atan2(-ghostFwd.x, -ghostFwd.z));
		ghostOk = true;
	}

	ghostFwd.set(0, 0, -1).applyQuaternion(ghostQuat);
	ghostPos.addScaledVector(ghostFwd, GHOST_SPEED * dt);
}



function frame(now) {
	requestAnimationFrame(frame);
	const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
	last = now;
	if (!car) return;
	if (dt > 0) {
		ftBuf[ftAt] = dt;
		ftAt = (ftAt + 1) % FT_N;
		if (ftFilled < FT_N) ftFilled++;
	}

	if (mapView && mapView.isOpen) {
		physAccum = 0;
		updateMap();
		return;
	}

	padNow = padMod
		? padMod.readPad({
			zoomRate: padZoomInvert ? -padZoomRate : padZoomRate,
			brakeExp: padBrakeExp,
			topLift: padTopLift,

			orbit: lookOn,
		})
		: null;

	if (padNow && padNow.menu && !padMenu && window.driveMenu) {
		if (lookOn) setLook(false);
		const opened = window.driveMenu.toggle();
		if (opened) {
			padRow = 0;
			padMenuPaint(padMenuRows());

			for (const k in keys) keys[k] = false;
		}
	}
	padMenu = !!(padNow && padNow.menu);

	const padInMenu = padMenuStep(padNow, dt);
	if (padInMenu) padNow = null;

	if (padNow && padNow.camCycle && !padCamCycle && !flying) {
		const order = cameraOrder();
		camName = order[(order.indexOf(camName) + 1) % order.length];
		status(`camera ${CAMERAS[camName].label}`);
	}
	padCamCycle = !!(padNow && padNow.camCycle);

	if (padNow && padNow.reset && !padReset) {
		if (flying) setFlying(false);
		respawn('respawned');
	}
	padReset = !!(padNow && padNow.reset);
	if (padNow && !padSeen) {
		padSeen = true;
		;
	}

	if (padNow && padNow.snapView && !padSnap && !flying) {
		lookSnap = true;
		lookIdle = 0;
		status('view returning behind the car');
	}
	padSnap = !!(padNow && padNow.snapView);

	if (padNow && padNow.orbitClick && !padOrbit && !flying) setLook(!lookOn);
	padOrbit = !!(padNow && padNow.orbitClick);

	if (padNow && padNow.camPitch && !flying) {
		lookSnap = false;
		lookIdle = 0;
		lookPitch = THREE.MathUtils.clamp(
			lookPitch + padNow.camPitch * dt, -VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT);
		setViewAngles(lookYaw, lookPitch);
	}

	if (padNow && padNow.camYaw && !flying) {
		lookSnap = false;
		lookIdle = 0;
		lookYaw = wrapYaw(lookYaw + padNow.camYaw * dt);
		setViewAngles(lookYaw, lookPitch);
	}
	if (padNow && padNow.camZoom && !flying) {
		camZoomWant = THREE.MathUtils.clamp(
			camZoomWant * Math.exp(padNow.camZoom * dt), ZOOM_MIN, ZOOM_MAX);
	}

	const input = readInput();

	if (ghostOn) {
		input.forward = false;
		input.back = false;
		input.left = false;
		input.right = false;
		input.brake = true;
		input.handbrake = true;
		delete input.throttle;
		delete input.steer;
	}
	let mark = pMark();
	physAccum += dt;
	let steps = 0;
	while (physAccum >= physDt && steps < PHYS_CAP) {
		car.update(physDt, input);
		world.step();
		car.recordPose();
		meter.sample(car, physDt);
		physAccum -= physDt;
		steps++;
	}

	if (physAccum >= physDt) {
		capBinds++;
		capBindAt = now;
		if (physDrain) physAccum = 0;
	}

	const alpha = Math.min(physAccum / physDt, 1);
	if (ghostOn) {
		ghostStep(dt);
		const pp = car._prevPos;
		const cp = car._currPos;
		const pq = car._prevQuat;
		const cq = car._currQuat;
		car._prevPos = ghostPos;
		car._currPos = ghostPos;
		car._prevQuat = ghostQuat;
		car._currQuat = ghostQuat;
		car.syncMeshes(alpha);
		car._prevPos = pp;
		car._currPos = cp;
		car._prevQuat = pq;
		car._currQuat = cq;
	} else {
		car.syncMeshes(alpha);
	}
	pAdd('phys', mark);

	mark = pMark();
	stepSpinners(dt);

	if (car.chassis.translation().y < FALL_LIMIT) {

		seatAtStart('fell off the edge of the section');
	}

	updateLook(dt);
	updateSpeedo(dt);
	updateGps();
	updateMap();
	updateCamLabel();
	pAdd('scenery', mark);

	mark = pMark();
	if (flying) {
		flyStep(dt);
	} else {

		easeZoom(dt);
		applyCamera(camera, car, dt, {
			preset: CAMERAS[camName], zoom: camZoom, carScale: carScale(),
		});
	}
	pAdd('camera', mark);

	mark = pMark();
	if (signals) signals.update(dt);
	pAdd('signals', mark);

	mark = pMark();
	if (forest && treeCull) {
		try {
			forest.update(camera.position);
		} catch (err) {
			console.error('[trees] distance cull threw, drawing every cell:', err);
			treeCull = false;
			forest.setDraw(0);
		}
	}
	pAdd('trees', mark);

	mark = pMark();
	if (lighting) {
		try {
			lightFocus.copy(flying ? camera.position : car.chassis.translation());
			lighting.update(dt, lightFocus);
			tickWorldTones();

			if (windowStats && windowStats.nightUniform) {
				windowStats.nightUniform.value = lighting.nightLevel;
			}

			if (lamps) lamps.setNight(lighting.nightLevel);

			if (car && car.carMesh && car.carMesh.setBeams) {

				const lvl = lightMode === 'off' ? 0
					: lightMode === 'on' ? 1
						: (beamsOn ? lighting.nightLevel : 0);
				car.carMesh.setBeams(lvl);
				seedBeamTune();
			}

			if (signals && signals.setNight) signals.setNight(lighting.nightLevel);
			if (lampField) {
				lampField.gain = lampMode === 'lit'
					? lampGain * lighting.nightLevel : 0;

				if (!lampCarAttached && car && car.carMesh && car.carMesh.group) {
					attachLampField();
				}
			}
		} catch (err) {
			console.error('[lighting] rig threw, falling back to flat lighting:', err);
			status(`lighting rig failed — ${err && err.message ? err.message : err}. `
				+ 'Flat lighting; everything else still works.');
			try { lighting.legacy = true; lighting.update(0, lightFocus); } catch (e2) {
				console.error('[lighting] legacy fallback also threw:', e2);
				lighting = null;
			}
		}
	}
	pAdd('light', mark);

	mark = pMark();
	if (traffic) {
		try {
			trafficFocus.copy(flying ? camera.position : car.chassis.translation());

			traffic.update(dt, trafficFocus,
				signals ? signals.timeS : performance.now() / 1000,
				lighting ? lighting.nightLevel : 1);
		} catch (err) {
			console.error('[traffic] tick threw, removing the fleet:', err);
			status(`NPC traffic failed — ${err && err.message ? err.message : err}. `
				+ 'Everything else still works.');
			try { scene.remove(traffic.mesh, traffic.glowGroup); } catch (e2) {   }
			traffic = null;
		}
	}
	pAdd('traffic', mark);

	jitterAcc += dt;
	if (jitterAcc > 0.25) { jitterAcc = 0; jitterText = meter.report(car, 1 / FIXED_DT); }

	profRoll();
	mark = pMark();
	hudAcc += dt;
	if (hudHz <= 0 || hudAcc >= 1 / hudHz) {
		hudAcc = 0;
		renderHud();
		renderLayers();
	}
	pAdd('hud', mark);

	mark = pMark();
	renderer.render(scene, camera);
	pAdd('render', mark);

	autoTick(now);
}

let menuPanels = [];

async function buildMenu() {
	if (!window.driveMenu) return;
	const { panel } = await import(`./menuui.js${MODULE_STAMP}`);
	menuPanels = [];
	const refreshAll = () => { for (const p of menuPanels) p.refresh(); };
	const mount = window.driveMenu.mount('settings');
	const p = mount ? panel(mount) : null;
	if (!p) return;
	menuPanels.push(p);

	if (window.__levels && window.__levels.length > 1) {
		p.group('level');
		p.select({
			label: 'level',
			options: window.__levels.map((l) => ({ value: l.cut, label: l.name })),
			get: () => window.__level,
			set: (v) => {
				if (v === window.__level) return;
				try { localStorage.setItem('strata.level', v); } catch (e) {   }
				location.reload();
			},
		});
	}

	p.group(window.__levels && window.__levels.length > 1 ? 'start' : 'level');

	p.select({
		label: 'spawn point',
		options: () => (spawnList || [{ key: 'start', label: 'start' }])
			.map((s) => ({ value: s.key, label: s.label })),
		get: () => spawnAt,
		set: (v) => { goToSpawn(v); },
	});

	p.group('display');
	p.select({
		label: 'quality',
		options: [
			{ value: 'full', label: 'full' },
			{ value: 'fast', label: 'fast' },
		],
		get: () => (perfMode ? 'fast' : 'full'),
		set: (v) => { setPerfMode(v === 'fast'); },
	});

	p.select({
		label: 'resolution',
		options: [
			{ value: 'auto', label: 'auto' },
			{ value: '1', label: '100%' },
			{ value: '0.75', label: '75%' },
			{ value: '0.5', label: '50%' },
			{ value: '0.33', label: '33%' },
		],
		get: () => (autoScale ? 'auto' : String(pixelScale)),
		set: (v) => {
			if (v === 'auto') setAutoScale();
			else setPixelScale(Number(v));
		},
	});
	p.select({
		label: 'time of day',
		options: SKY_MODES.map((m) => ({ value: m.id, label: m.label })),
		get: () => SKY_MODES[skyMode].id,
		set: (v) => { setSkyMode(SKY_MODES.findIndex((m) => m.id === v), false); },
	});

	p.toggle({
		label: 'touch controls',
		get: () => touchOn,
		set: (v) => { touchOn = v; applyTouch(); },
	});

	p.select({
		label: 'touch steering',
		options: [
			{ value: 'buttons', label: 'left / right buttons' },
			{ value: 'stick', label: 'floating stick' },
		],
		get: () => touchSteer,
		set: (v) => { touchSteer = v; applyTouch(); },
	});

	p.toggle({
		label: 'reset button',
		get: () => touchReset,
		set: (v) => { touchReset = v; applyTouch(); },
	});

	p.toggle({
		label: 'clean UI',
		get: () => touchClean,
		set: (v) => { touchClean = v; applyTouch(); },
	});
	p.toggle({
		label: 'speedometer',
		get: () => speedoOn,
		set: (v) => { speedoOn = v; applySpeedo(); },
	});
	p.toggle({
		label: 'minimap',
		get: () => gpsOn,
		set: (v) => { gpsOn = v; if (gpsOn) ensureGps(); applyGps(); },
	});

	p.group('driving');
	p.select({
		label: 'steering',
		options: TURN_MODES.map((m) => ({ value: m.id, label: m.label })),
		get: () => getTurnMode(),
		set: (v) => { setTurnMode(v); },
	});
	p.select({
		label: 'mouselook',
		options: [
			{ value: 'hold', label: 'hold it' },
			{ value: 'return', label: 'ease back' },
		],
		get: () => lookMode,
		set: (v) => { lookMode = v; lookIdle = 0; },
	});

	p.group('camera');
	p.select({
		label: 'view',
		options: () => cameraOrder().map((n) => ({ value: n, label: CAMERAS[n].label })),
		get: () => camName,
		set: (v) => { camName = v; },
	});

	window.driveMenu.onOpen(refreshAll);
}

async function boot() {
	RAPIER = await initRapier();
	world = createPhysicsWorld(RAPIER);
	world.gravity = { x: 0, y: GRAVITY_Y, z: 0 };

	setLagMode(true);

	try {
		biasMod = await import(`./depthbias.js${MODULE_STAMP}`);
		biasReg = new biasMod.BiasRegistry(biasMod.resolveBiasArm());
		;
	} catch (err) {
		console.warn('[bias] stack not loaded — every surface stays at rank zero:',
			err && err.message ? err.message : err);
	}

	hud.textContent = `loading the ${CHUNK} section…`;
	await loadChunk();
	await loadVariants();

	if (gpsOn) ensureGps();

	try {
		waterMod = await import(`./water.js${MODULE_STAMP}`);
		waterRings = await waterMod.loadWaterRings(
			chunk.meta, url(`${CHUNK}.water`, 'json'));
		if (waterRings) {
			;
		}
	} catch (err) {
		console.warn('[water] rings not loaded:', err && err.message ? err.message : err);
	}

	const varying = variants.length > 0;
	for (let i = 0; i < LAYERS.length; i++) {
		if (!shown[i]) continue;
		if (varying && VARIANT_REPLACES.includes(LAYERS[i].key)) continue;
		await ensureLayer(LAYERS[i]);
	}
	applyShown();

	try {
		if (!waterMod) waterMod = await import(`./water.js${MODULE_STAMP}`);

		const wy = chunk.meta && chunk.meta.water && chunk.meta.water.y;
		waterNearGround = Number.isFinite(wy) && chunk.spawn
			&& Math.abs(wy - chunk.spawn.y) < 60;
		if (waterNearGround && !renderer.capabilities.logarithmicDepthBuffer) {
			console.warn(`[water] this cut draws water at y=${wy.toFixed(1)}, near the `
				+ 'ground, and logarithmicDepthBuffer is off — expect the surface to '
				+ 'flicker. Known and tabled 2026-09-01; the fix is a different water '
				+ 'implementation, not the depth buffer back. Every Dallas cut parks '
				+ 'its plane ~280 m below the terrain and is unaffected.');
		}
		water = waterMod.createWater(scene, chunk.meta, waterRings);

		if (biasReg) biasReg.register(water.material, 'water');
		water.fit();
		water.setVisible(waterOn);
	} catch (err) {
		console.warn('[water] sheet not built:', err && err.message ? err.message : err);
	}

	await loadSignals();
	await loadTrees();

	await loadGarageCars();

	await loadLamps();
	await loadTraffic();

	car = createVehicle(world, scene, { handling: handlingName });

	if (variants.length) await setVariant(0);

	if (texOn) applyDebug();

	applyWorldTones();

	try {
		const { createLighting } = await import(`./lighting.js${MODULE_STAMP}`);
		lighting = await createLighting(scene, renderer, { timeOfDay: TIME_AT_BOOT });
		dressScene();

		applyStyleExtras(lighting.style);

		try {
			await lastTintPass;
		} catch (err) {
			console.warn('[buildings] first tint pass failed:',
				err && err.message ? err.message : err);
		}

		try {
			lightFocus.copy(car ? car.chassis.translation() : camera.position);
			lighting.update(0, lightFocus);
			tickWorldTones();
		} catch (err) {
			console.warn('[lighting] first pass failed:',
				err && err.message ? err.message : err);
		}
	} catch (err) {
		console.warn('[lighting] rig not built:', err && err.message ? err.message : err);
	}
	seatAtStart();
	renderLayers();

	try {
		await buildMenu();
	} catch (err) {
		console.warn('[menu] controls not built:', err && err.message ? err.message : err);
	}

	status(`${LEVEL_NAME} — ${drawnTriangles().toLocaleString()} triangles.`);

	if (EYE) {
		setFlying(true);
		camera.position.set(EYE[0], EYE[1], EYE[2]);
		if (LOOK_AT) controls.target.set(LOOK_AT[0], LOOK_AT[1], LOOK_AT[2]);
		controls.update();
		status(`camera placed at ${EYE.map((v) => v.toFixed(0)).join(', ')}`
			+ (LOOK_AT ? ` looking at ${LOOK_AT.map((v) => v.toFixed(0)).join(', ')}` : '')
			+ ' — F returns to the car.');
	}

	try {
		padMod = await import(`./gamepad.js${MODULE_STAMP}`);
		if (Number.isFinite(padMod.CAM_ZOOM_RATE)) padZoomRate = padMod.CAM_ZOOM_RATE;
		if (Number.isFinite(padMod.BRAKE_EXP)) padBrakeExp = padMod.BRAKE_EXP;
		if (Number.isFinite(padMod.TRIGGER_TOP_LIFT)) padTopLift = padMod.TRIGGER_TOP_LIFT;
	} catch (err) {
		console.warn('[pad] gamepad layer unavailable', err);
	}

	try {
		if (isTouchDevice()) setPerfMode(true);
	} catch (err) {
		console.warn('[perf] could not set the touch default', err);
	}

	try {
		await ensureTouch();
	} catch (err) {
		console.warn('[touch] could not build the on-screen controls', err);
	}

	try {
		await buildSpawnList();
	} catch (err) {
		console.warn('[spawn] could not list the spawn points', err);
	}

	try {
		if (window.__loading) window.__loading.done();
	} catch (err) {   }

	requestAnimationFrame(frame);
}

boot().catch((err) => {
	hud.textContent = `boot failed: ${err && err.message ? err.message : err}`;

	try {
		if (window.__loading) window.__loading.fail('could not load — please reload');
	} catch (err2) {   }
	console.error(err);
});
