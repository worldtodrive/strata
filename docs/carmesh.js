

import * as THREE from 'three';
import { newGLTFLoader } from './glbload.js';
import { buildRimGeometry, buildBrakeGeometry, RIM_STYLES } from './rimmesh.js';

const RIM_STYLE = (qs('rim') || 'dish').toLowerCase();

const SPIN_CAP = qsNum('spincap', 0.50);

const MAP_HUE = qsNum('hue', 0);
const MAP_SAT = qsNum('sat', 1);
const MAP_BRIGHT = qsNum('bright', 1);

const GLOSS_Q = qs('gloss');

const CAR_GLOSS = {

};

const GLASS_TINT = (() => {
	const v = Number(qs('glass'));
	return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
})();

export const DEFAULT_CAR = 'cheetah';

const CAR_NAME = (qs('car') || DEFAULT_CAR).toLowerCase().replace(/[^a-z0-9\-_]/g, '');
export const GLB_URL = new URL(
    `./assets/vehicles/${CAR_NAME || DEFAULT_CAR}.glb`, import.meta.url).href;

function qs(name) {
	if (typeof location === 'undefined') return null;
	return new URLSearchParams(location.search).get(name);
}

function qsNum(name, dflt) {
	const raw = qs(name);
	if (raw === null || String(raw).trim() === '') return dflt;
	const v = Number(raw);
	return Number.isFinite(v) ? v : dflt;
}

export const CAR_KIND = (qs('car') || DEFAULT_CAR).toLowerCase();

export const CAR_LIFT_M = Math.max(0, qsNum('carlift', 0));

const NOSE_FORCED = qs('carnose') === null ? 0 : Math.sign(qsNum('carnose', 0));

const SPIN_SIGN = qsNum('carspin', -1) < 0 ? -1 : 1;
const STEER_SIGN = qsNum('carsteer', 1) < 0 ? -1 : 1;
const STEER_VISUAL_GAIN = 1.4;

const LAMPS = [

	{ key: 'brake', peak: 3.2, colour: 0xff1808,
		test: /breaklight|brakelight|lightbrake|_rear_light|rearlight|glass_red/i },
	{ key: 'head', peak: 2.8, colour: 0xfff1cf, test: /^(left|right)_front_light$/i },
	{ key: 'fog', peak: 2.0, colour: 0xffe6b0, test: /^foglight_[lr]$/i },
	{ key: 'reverse', peak: 2.2, colour: 0xf2f6ff, test: /^revlight_[lr]$/i },
];

const LAMP_GAIN = (() => {
	if (typeof location === 'undefined') return 1;
	const v = Number(new URLSearchParams(location.search).get('lamppeak'));
	return (Number.isFinite(v) && v > 0) ? v : 1;
})();

const PAINT = [

	{ test: /^carpaint$/i, color: 0x2f353c, metalness: 0.85, roughness: 0.30 },

	{ test: /^chrome$/i, color: 0xd6dae0, metalness: 1.0, roughness: 0.06 },

	{ test: /^plastic$/i, color: 0x15181c, metalness: 0.0, roughness: 0.72 },

	{ test: /lightbrake|brakelight|breaklight/i, color: 0xc41f24, metalness: 0.0, roughness: 0.35 },
	{ test: /^glass$/i, color: 0x0e1216, metalness: 0.30, roughness: 0.08 },
	{ test: /^rubber$/i, color: 0x0f1113, metalness: 0.0, roughness: 0.95 },
	{ test: /^wood$/i, color: 0x3b2b1f, metalness: 0.0, roughness: 0.80 },
];

const NOSE_FLIP = /^(coupe|rally|van|armor|police|jeep|italia|lamb|ghini|fenyr|kamaro|mobil)$/i;

const BEAM_RANGE_M = 35;
const BEAM_ANGLE = 0.7156;

const BEAM_GAIN = Number(qs('beam')) > 0 ? Number(qs('beam')) : 30;

const CAR_PAINT = {

	cheetah: [
		{ test: /^Cheetah_Body$/i, color: 0x0f5a7b, metalness: 0.04, roughness: 0.42,
			env: 0.18 },

		{ test: /^Cheetah_Black$/i, color: 0x0d1013, metalness: 0.0, roughness: 0.80 },
	],

	italia: [
		{ test: /^metallic$/i, color: 0x23272e, metalness: 0.88, roughness: 0.26 },
		{ test: /^glass$/i, color: 0x0d1116, metalness: 0.30, roughness: 0.07 },
	],

	coupe: [
		{ test: /^metallic$/i, color: 0xb01218, metalness: 0.82, roughness: 0.28 },
		{ test: /^glass$/i, color: 0x090b0e, metalness: 0.35, roughness: 0.06 },
		{ test: /^texture$/i, color: 0x121417, metalness: 0.15, roughness: 0.70 },
	],

	sportscar: [
		{ test: /^white$/i, color: 0xa8151b, metalness: 0.80, roughness: 0.30 },
		{ test: /^grey$/i, color: 0x101215, metalness: 0.20, roughness: 0.65 },
		{ test: /^black$/i, color: 0x0c0e10, metalness: 0.0, roughness: 0.92 },
		{ test: /^windows$/i, color: 0x0b0f13, metalness: 0.30, roughness: 0.07 },
	],
};

export const CAR_LOOK = {

	cp25low: { paint: 'wine', stripe: 'graphite', spoiler: 'hide' },
};

const PART_KNOBS = (() => {
	const out = {};
	for (const k of ['paint', 'stripe', 'spoiler', 'accent', 'rim']) {
		const v = (qs(k) || '').toLowerCase().replace(/^#/, '');
		if (v) out[k] = v;
	}
	if (typeof location !== 'undefined') {
		for (const raw of new URLSearchParams(location.search).getAll('part')) {
			const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(#?[0-9A-Fa-f]{6}|[a-z]+)\s*$/.exec(raw);
			if (m) out[m[1]] = m[2].toLowerCase().replace(/^#/, '');
		}
	}
	return out;
})();

const CAR_COLOR_OVERRIDE = (() => {
	const raw = (qs('carcolor') || '').replace(/^#/, '');
	return /^[0-9a-f]{6}$/i.test(raw) ? parseInt(raw, 16) : null;
})();

const SPOILER_ON = ['1', 'on', 'true', 'yes'].includes((qs('spoiler') || '').toLowerCase());

const WHEEL_RIG = (qs('wheelrig') || 'susp').toLowerCase();
const DRESS = qs('cardress') === '1';

export const SHADES = {

	midnight: 0x141c3a, navy: 0x1b2a5e, royal: 0x2240b0, azure: 0x3a6fd0,
	steel: 0x5a7091, teal: 0x186a72, ice: 0x9db8dc,

	maroon: 0x4a0f18, wine: 0x5e0f1b, crimson: 0x8e1220, scarlet: 0xc1121f,
	cherry: 0xd42a3d, rust: 0x8c3a1e,

	graphite: 0x24262b, charcoal: 0x15171a, silver: 0xc8ccd2, bone: 0xd8d4c8,
};

function shade(name, dflt) {
	const raw = (qs(name) || "").toLowerCase().replace(/^#/, "");
	if (!raw) return dflt;
	if (Object.prototype.hasOwnProperty.call(SHADES, raw)) return SHADES[raw];
	return /^[0-9a-f]{6}$/.test(raw) ? parseInt(raw, 16) : dflt;
}

const PACK_PAINT = {
	body: shade("paint", null),
	accent: shade("accent", null),
	rim: shade("rim", 0xc8ccd2),
	tyre: shade("tyre", 0x14161a),

	roof: shade("roof", null),
	tail: shade("taillight", 0xc8121f),
	head: shade("headlight", 0xfff3dc),
	plate: shade("plate", 0x1a1c20),
};

const MATTE = (() => {
	const v = Number(qs("matte"));
	return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.85;
})();

const BEAM_SETUPS = {
	dipped: {
		range: qsNum("beamrange", BEAM_RANGE_M),
		angle: qsNum("beamcone", BEAM_ANGLE),
		gain: BEAM_GAIN,
		colour: shade("beamcolor", 0xfff2dc),

		drop: qsNum("beamdrop", 1.1),
	},

	main: {
		range: qsNum("brightrange", 55),
		angle: qsNum("brightcone", 0.42),
		gain: BEAM_GAIN * 3.0,
		colour: shade("brightcolor", 0xf4f8ff),
		drop: qsNum("brightdrop", 1.1),
	},
};

const BRIGHTS_START = ["1", "on", "true", "yes"].includes((qs("brights") || "").toLowerCase());

const PLATE_OFF = (qs("plate") || "").toLowerCase() === "0";

let _cachedScene = null;
let _inflight = null;

export class CarMesh {
	constructor(scene) {
		this.scene = scene;

		this.group = new THREE.Group();
		this.group.name = 'carmesh';
		this.group.visible = false;
		scene.add(this.group);

		this.wrapper = null;
		this.wheels = [];
		this.brakeMats = [];
		this.lamps = {};
		this.lampPeak = {};
		this.lampGlow = {};
		this.brakeGlow = 0;
		this.spinAngle = 0;
		this.loaded = false;
		this.failed = false;
		this._pending = null;
		this._fit = null;
		this._noseSign = 1;
		this._tmpV = new THREE.Vector3();
	}

	get isLoaded() { return this.loaded; }

	async load(url = GLB_URL) {
		if (CAR_KIND === 'box') { this.failed = true; return; }
		try {
			if (!_cachedScene) {

				_inflight ||= newGLTFLoader().loadAsync(url).then((gltf) => {
					_cachedScene = gltf.scene;
					_inflight = null;
					return gltf.scene;
				});
				await _inflight;
			}

			this._pending = _cachedScene.clone(true);
			if (this._fit) this._install();
		} catch (err) {
			this.failed = true;
			console.warn('[carmesh] car GLB failed to load — keeping the box car.',
				err && err.message ? err.message : err);
		}
	}

	fit(half, wheels, restSusp) {
		this._fit = {
			half: { x: half.x, y: half.y, z: half.z },
			wheels: wheels.map((w) => ({ x: w.x, y: w.y, z: w.z, steer: !!w.steer })),
			restSusp: restSusp || 0,
		};
		if (this.wrapper) this._reseat();
		else if (this._pending) this._install();
	}

	sync(pos, quat, suspLens, steer, forwardSpeed, dt) {
		if (!this.loaded) return;
		this.group.position.set(pos.x, pos.y + CAR_LIFT_M, pos.z);
		this.group.quaternion.copy(quat);

		const rest = this._fit ? this._fit.restSusp : 0;

		const inv = 1 / (this._scale || 1);
		for (const w of this.wheels) {

			const dy = (WHEEL_RIG === 'fixed' || !suspLens) ? 0
				: -((suspLens[w.index] ?? rest) - rest) * inv;
			w.steer.position.y = w.baseY + dy;
			w.spin.setRotationFromAxisAngle(w.spinAxis, this.spinAngle);
			if (w.front) w.steer.rotation.y = STEER_SIGN * steer * STEER_VISUAL_GAIN;
		}

		if (this.wheels.length) {
			let d = (SPIN_SIGN * forwardSpeed * dt) / this.wheels[0].radius;

			if (SPIN_CAP > 0 && dt > 0) {
				const cap = SPIN_CAP * dt * 60;
				if (d > cap) d = cap;
				else if (d < -cap) d = -cap;
			}
			this.spinAngle += d;
		}
	}

	poseWheels(steerRad, spinRad) {
		this.spinAngle = spinRad;
		for (const w of this.wheels) {
			w.spin.setRotationFromAxisAngle(w.spinAxis, spinRad);
			if (w.front) w.steer.rotation.y = STEER_SIGN * steerRad;
		}
	}

	setBrakeLights(on, dt) {
		this.setLamp('brake', on, dt);
		this.brakeGlow = this.lampGlow.brake || 0;
	}

	setLights({ head = false, fog = false, brake = false, forwardSpeed = 0 }, dt) {
		this.setLamp('head', head, dt);
		this.setLamp('fog', fog, dt);
		this.setBrakeLights(brake, dt);

		this.setLamp('reverse', forwardSpeed < -0.4, dt);
	}

	_chassisBox(local) {
		if (!local || !this.wrapper) return null;
		const s = this._scale || 1;
		const p = this.wrapper.position;
		const f = (v) => [
			+(v.x * s + p.x).toFixed(3),
			+(v.y * s + p.y).toFixed(3),
			+(v.z * s + p.z).toFixed(3),
		];
		return { min: f(local.min), max: f(local.max) };
	}

	report() {
		const box = new THREE.Box3();
		for (const w of this.wheels) box.expandByObject(w.spin);
		return {

			body: this._chassisBox(this._bodyBoxLocal),
			bonnet: this._chassisBox(this._bonnetBoxLocal),
			lamps: Object.fromEntries(
				Object.entries(this.lamps).map(([k, v]) => [k, v.length])),
			loaded: this.loaded,
			nose: this._noseSign,
			scale: +(this._scale || 0).toFixed(4),
			pos: this.group.position.toArray().map((v) => +v.toFixed(3)),
			restSusp: +(this._fit ? this._fit.restSusp : 0).toFixed(4),

			tyreMinY: box.isEmpty() ? null : +(box.min.y - this.group.position.y).toFixed(4),
			radius: +(this.wheels[0] ? this.wheels[0].radius : 0).toFixed(4),
			wheels: this.wheels.map((w) => ({
				c: w.corner, i: w.index, steered: w.front,
				y: +w.steer.position.y.toFixed(4),
			})),
			brakeLamps: this.brakeMats.length,
		};
	}

	dispose() {
		if (this.group.parent) this.group.parent.remove(this.group);
		for (const m of this.brakeMats) m.dispose();
		this.wheels = [];
		this.brakeMats = [];
		this.wrapper = null;
		this.loaded = false;
	}

	_install() {
		const model = this._pending;
		this._pending = null;
		if (!model || !this._fit) return;

		model.updateMatrixWorld(true);
		let box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		model.position.sub(box.getCenter(new THREE.Vector3()));

		if (size.x > size.z) model.rotation.y = Math.PI / 2;

		const wrapper = new THREE.Group();
		wrapper.name = 'body';
		wrapper.add(model);
		wrapper.updateMatrixWorld(true);
		this.wrapper = wrapper;

		wrapper.traverse((child) => {
			if (!child.isMesh) return;

			child.castShadow = true;
			child.receiveShadow = true;
		});

		this._collectWheelNodes(wrapper);

		let hubs = this._hubCentres();

		const midZ = this._meanOf(hubs, () => true).z;
		const noseZ = this._meanOf(hubs, (k) => k.startsWith('Ft')).z;
		this._noseSign = NOSE_FORCED || (noseZ > midZ ? -1 : 1);
		if (this._noseSign < 0) {

			model.rotation.y += Math.PI;
			wrapper.updateMatrixWorld(true);
			hubs = this._hubCentres();
		}
		this._hubsLocal = hubs;
		box = new THREE.Box3().setFromObject(wrapper);
		const raw = box.getSize(new THREE.Vector3());
		this._lengthLocal = Math.max(raw.x, raw.z) || 1;

		this._bodyBoxLocal = box.clone();
		const bonnet = wrapper.getObjectByName('bonnet_ok_0');
		this._bonnetBoxLocal = bonnet
			? new THREE.Box3().setFromObject(bonnet) : null;

		this._reseat();
		this._rigWheels(wrapper);

		this._restyleRims();

		this._paintBody(wrapper);

		this._paintPack(wrapper);

		this._filterMaps(wrapper);
		this._dampGloss(wrapper);

		this._freeBrakes();
		this._tintGlass(wrapper);
		this._repaintByArea(wrapper);
		this._fixBareLenses(wrapper);

		if (SPOILER_ON) this.setSpoiler(true);
		this._rigBrakeLights(wrapper);

		this.group.add(wrapper);
		this.group.visible = true;
		this.loaded = true;

		if (typeof window !== 'undefined') window.__carmesh = this;

		const seats = this.wheels
			.map((w) => `${w.corner}->${w.index}${w.front ? 'S' : ''}`).sort().join(' ');
		;

		{
			const sizes = new Map();
			wrapper.traverse((child) => {
				if (!child.isMesh || !child.geometry || !child.material) return;
				const mats = Array.isArray(child.material) ? child.material : [child.material];
				const n = child.geometry.index ? child.geometry.index.count : 0;
				for (const m of mats) {
					if (!m || !/^trim/i.test(m.name || '')) continue;
					sizes.set(m.name.toLowerCase(),
						(sizes.get(m.name.toLowerCase()) || 0) + n);
				}
			});
			let best = '';
			let bestN = -1;
			for (const [k, v] of sizes) if (v > bestN) { best = k; bestN = v; }
			this._accentName = best;
		}
		this._paintParts(wrapper);
		if (DRESS) this.group.userData.dressMe = true;
	}

	_collectWheelNodes(wrapper) {
		this._tyres = {};
		this._brakes = {};

		const prefixed = new Set();

		let pendingAxles = null;
		wrapper.traverse((child) => {
			const mt = /DEF-Wheel(Ft|Bk)(L|R)/.exec(child.name);
			if (mt) { (this._tyres[`${mt[1]}.${mt[2]}`] ??= []).push(child); return; }
			const mb = /DEF-WheelBrake(Ft|Bk)(L|R)/.exec(child.name);
			if (mb) { (this._brakes[`${mb[1]}.${mb[2]}`] ??= []).push(child); return; }

			const mc = /^([FR])([LR])(tyre|tire|rim)\b/i.exec(child.name);
			if (mc) {
				for (let p = child.parent; p; p = p.parent) {
					if (prefixed.has(p)) return;
				}
				prefixed.add(child);
				const cEnd = mc[1].toUpperCase() === 'F' ? 'Ft' : 'Bk';
				const cSide = mc[2].toUpperCase();
				(this._tyres[`${cEnd}.${cSide}`] ??= []).push(child);
				return;
			}
			if (/brake|caliper/i.test(child.name)) return;
			const mk = /wheel[-_. ]?(front|back|rear)[-_. ]?(left|right)/i.exec(child.name);
			if (mk) {
				const end = mk[1].toLowerCase() === 'front' ? 'Ft' : 'Bk';
				const side = mk[2].toLowerCase() === 'left' ? 'L' : 'R';
				(this._tyres[`${end}.${side}`] ??= []).push(child);
				return;
			}

			const mq = /(front|back|rear)(left|right)?wheels?/i.exec(child.name);
			if (!mq) return;
			const qEnd = mq[1].toLowerCase() === 'front' ? 'Ft' : 'Bk';
			if (mq[2]) {
				const qSide = mq[2].toLowerCase() === 'left' ? 'L' : 'R';
				(this._tyres[`${qEnd}.${qSide}`] ??= []).push(child);
				return;
			}

			(pendingAxles ??= []).push({ node: child, end: qEnd });
			return;
		});

		for (const a of (pendingAxles || [])) {
			const halves = this._splitAxle(a.node);
			if (halves) {
				(this._tyres[`${a.end}.L`] ??= []).push(halves[0]);
				(this._tyres[`${a.end}.R`] ??= []).push(halves[1]);
			} else {

				(this._tyres[`${a.end}.L`] ??= []).push(a.node);
				(this._tyres[`${a.end}.R`] ??= []).push(a.node);
			}
		}

		if (!Object.keys(this._tyres).length) {
			wrapper.traverse((child) => {
				if (/brake|caliper|steer/i.test(child.name)) return;
				const ma = /wheel[_\-. ]?(F|B)(L|R)\b/i.exec(child.name)
					|| /wheel[_\-. ]?(F|B)(L|R)[_\-.]/i.exec(child.name);
				if (!ma) return;
				const aEnd = ma[1].toUpperCase() === 'F' ? 'Ft' : 'Bk';
				const aSide = ma[2].toUpperCase();
				(this._tyres[`${aEnd}.${aSide}`] ??= []).push(child);
			});
		}

		this._resolveMislabelledAxles(wrapper);

		if (Object.keys(this._tyres).length < 4) this._cornersByPosition(wrapper);
	}

	_cornersByPosition(wrapper) {
		wrapper.updateMatrixWorld(true);
		const box = new THREE.Box3();
		const found = [];
		const seen = new Set();
		wrapper.traverse((child) => {
			if (!/wheel|tyre|tire/i.test(child.name)) return;
			if (/brake|caliper|steer/i.test(child.name)) return;

			for (let p = child.parent; p; p = p.parent) if (seen.has(p)) return;
			seen.add(child);
			box.makeEmpty();
			box.expandByObject(child);
			if (box.isEmpty()) return;
			found.push({ node: child, c: box.getCenter(new THREE.Vector3()) });
		});
		if (found.length !== 4) return;

		const spread = (k) => Math.max(...found.map((f) => f.c[k]))
			- Math.min(...found.map((f) => f.c[k]));
		const lengthAxis = spread('z') >= spread('x') ? 'z' : 'x';
		const sideAxis = lengthAxis === 'z' ? 'x' : 'z';
		const midOf = (k) => (Math.max(...found.map((f) => f.c[k]))
			+ Math.min(...found.map((f) => f.c[k]))) / 2;
		const midLen = midOf(lengthAxis);
		const midSide = midOf(sideAxis);

		const packFlip = NOSE_FLIP.test(CAR_NAME);
		const flip = ((qs('carnose') || '').toLowerCase() === 'flip') !== packFlip;
		this._tyres = {};
		for (const f of found) {
			const isFront = flip
				? f.c[lengthAxis] > midLen
				: f.c[lengthAxis] < midLen;
			const end = isFront ? 'Ft' : 'Bk';
			const side = f.c[sideAxis] < midSide ? 'L' : 'R';
			(this._tyres[`${end}.${side}`] ??= []).push(f.node);
		}
	}

	_splitAxle(node) {
		const meshes = [];
		node.traverse((c) => { if (c.isMesh && c.geometry) meshes.push(c); });
		if (!meshes.length) return null;

		const build = (wantHigh) => {
			const g = new THREE.Group();
			g.name = `${node.name}_${wantHigh ? 'R' : 'L'}`;
			for (const m of meshes) {
				const geo = m.geometry;
				const pos = geo.attributes.position;
				if (!pos) continue;
				if (!geo.boundingBox) geo.computeBoundingBox();
				const midX = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
				const idx = geo.index;
				const tris = idx ? idx.count / 3 : pos.count / 3;
				const keep = [];
				for (let t = 0; t < tris; t++) {
					const a = idx ? idx.getX(t * 3) : t * 3;
					const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
					const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
					const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
					if ((cx > midX) === wantHigh) keep.push(a, b, c);
				}
				if (!keep.length) continue;
				const ng = geo.clone();
				ng.setIndex(keep);
				ng.clearGroups();
				ng.computeBoundingBox();
				ng.computeBoundingSphere();
				const nm = new THREE.Mesh(ng, m.material);
				nm.name = `${m.name}_${wantHigh ? 'R' : 'L'}`;
				nm.position.copy(m.position);
				nm.quaternion.copy(m.quaternion);
				nm.scale.copy(m.scale);
				g.add(nm);
			}
			return g.children.length ? g : null;
		};

		const lo = build(false);
		const hi = build(true);
		if (!lo || !hi) return null;
		const parent = node.parent;
		if (!parent) return null;
		lo.position.copy(node.position);
		lo.quaternion.copy(node.quaternion);
		lo.scale.copy(node.scale);
		hi.position.copy(node.position);
		hi.quaternion.copy(node.quaternion);
		hi.scale.copy(node.scale);
		parent.remove(node);
		parent.add(lo);
		parent.add(hi);
		return [lo, hi];
	}

	_resolveMislabelledAxles(wrapper) {
		wrapper.updateMatrixWorld(true);
		const box = new THREE.Box3();
		const centreX = (n) => {
			box.makeEmpty();
			box.expandByObject(n);
			return box.isEmpty() ? 0 : (box.min.x + box.max.x) / 2;
		};
		for (const end of ['Ft', 'Bk']) {
			const L = this._tyres[`${end}.L`] || [];
			const R = this._tyres[`${end}.R`] || [];
			if (L.length && R.length) continue;
			const all = L.length ? L : R;
			if (all.length < 2) continue;
			const tagged = all.map((n) => ({ n, x: centreX(n) }));
			const xs = tagged.map((t) => t.x);
			const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
			const lo = tagged.filter((t) => t.x <= mid).map((t) => t.n);
			const hi = tagged.filter((t) => t.x > mid).map((t) => t.n);

			if (!lo.length || !hi.length) continue;
			this._tyres[`${end}.L`] = lo;
			this._tyres[`${end}.R`] = hi;
		}
	}

	_reseat() {
		const w = this.wrapper;
		if (!w || !this._fit || !this._hubsLocal) return;
		const { half, wheels, restSusp } = this._fit;

		const s = (half.z * 2) / this._lengthLocal;
		this._scale = s;
		w.scale.setScalar(s);

		const mean = this._meanOf(this._hubsLocal, () => true);
		const restHubY = (wheels.length ? wheels[0].y : 0) - restSusp;
		w.position.set(-mean.x * s, restHubY - mean.y * s, -mean.z * s);
		w.updateMatrixWorld(true);

		for (const wh of this.wheels) wh.radius = this._radiusLocal * s;
	}

	_hubCentres() {
		const out = {};
		let radius = 0;
		for (const [corner, nodes] of Object.entries(this._tyres || {})) {
			const box = new THREE.Box3();
			for (const n of nodes) box.expandByObject(n);
			if (box.isEmpty()) continue;
			out[corner] = box.getCenter(new THREE.Vector3());
			radius = Math.max(radius, (box.max.y - box.min.y) / 2);
		}
		this._radiusLocal = radius || 0.35;
		return out;
	}

	_meanOf(hubs, pred) {
		const out = new THREE.Vector3();
		let n = 0;
		for (const [corner, c] of Object.entries(hubs)) {
			if (!pred(corner)) continue;
			out.add(c); n++;
		}
		return n ? out.divideScalar(n) : out;
	}

	_rigWheels(wrapper) {
		const hubs = this._hubsLocal;
		const wheels = this._fit.wheels;
		const mid = this._meanOf(hubs, () => true);

		const axle = this._meanOf(hubs, (k) => (hubs[k].x > mid.x)).clone()
			.sub(this._meanOf(hubs, (k) => (hubs[k].x <= mid.x)));
		if (axle.lengthSq() < 1e-8) axle.set(1, 0, 0);
		axle.normalize();

		const invQuat = new THREE.Quaternion();
		for (const [corner, centre] of Object.entries(hubs)) {

			const isFront = corner.startsWith('Ft');
			const isLeft = centre.x < mid.x;
			const index = wheels.findIndex((wh) => (
				((wh.z < 0) === isFront) && ((wh.x < 0) === isLeft)));
			if (index < 0) continue;

			const steer = new THREE.Group();
			steer.name = `wheel_${corner}`;
			wrapper.add(steer);
			steer.position.copy(centre);
			const spin = new THREE.Group();
			steer.add(spin);
			steer.updateMatrixWorld(true);

			spin.getWorldQuaternion(invQuat).invert();
			const spinAxis = axle.clone().applyQuaternion(invQuat).normalize();

			for (const n of (this._tyres[corner] || [])) spin.attach(n);
			for (const n of (this._brakes[corner] || [])) steer.attach(n);

			this.wheels.push({
				corner, index, steer, spin, spinAxis,
				baseY: steer.position.y,
				radius: this._radiusLocal * (this._scale || 1),
				front: wheels[index].steer,
			});
		}
	}

	_paintBody(wrapper) {
		const done = new Set();

		const rules = (CAR_PAINT[CAR_NAME] || []).concat(PAINT);
		let bodyDone = false;
		const paint = (m) => {
			if (!m || !m.name || done.has(m)) return;
			done.add(m);
			const spec = rules.find((p) => p.test.test(m.name));
			if (!spec) return;

			if (CAR_COLOR_OVERRIDE !== null && !bodyDone) {
				bodyDone = true;
				if (m.color) m.color.setHex(CAR_COLOR_OVERRIDE);
				if (m.map) m.map = null;
				if (m.metalness !== undefined) m.metalness = spec.metalness;
				if (m.roughness !== undefined) m.roughness = spec.roughness;
				m.needsUpdate = true;
				return;
			}
			if (m.color) m.color.setHex(spec.color);
			if (m.map) m.map = null;
			if (m.metalness !== undefined) m.metalness = spec.metalness;
			if (m.roughness !== undefined) m.roughness = spec.roughness;

			if (spec.env !== undefined && m.envMapIntensity !== undefined) {
				m.envMapIntensity = spec.env;
			}
			m.needsUpdate = true;
		};
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			if (Array.isArray(child.material)) child.material.forEach(paint);
			else paint(child.material);
		});
	}

	_tintGlass(wrapper) {
		if (GLASS_TINT <= 0) return;
		const seen = new Set();
		let n = 0;
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const mats = Array.isArray(child.material)
				? child.material : [child.material];
			for (const m of mats) {
				if (!m || seen.has(m)) continue;
				const nm = (m.name || '').toLowerCase();

				if (!/glass|window|windscreen|windshield/.test(nm)) continue;
				if (/glow|light|lamp|lens/.test(nm)) continue;
				seen.add(m);
				m.transparent = false;
				m.opacity = 1;
				m.depthWrite = true;
				if (m.color) {

					m.color.multiplyScalar(1 - GLASS_TINT);
					m.color.addScalar(0.045 * GLASS_TINT);
				}
				if (m.roughness !== undefined) {
					m.roughness = Math.min(m.roughness, 0.18);
				}
				if (m.metalness !== undefined) m.metalness = 0.10;
				m.needsUpdate = true;
				n++;
			}
		});
		if (n) ;
	}

	_freeBrakes() {
		const inv = new THREE.Matrix4();
		const rel = new THREE.Matrix4();
		const p = new THREE.Vector3();
		let n = 0;
		const moved = [];
		for (const w of this.wheels) {
			w.spin.updateMatrixWorld(true);
			inv.copy(w.spin.matrixWorld).invert();
			const move = [];
			w.spin.traverse((c) => {
				if (!c.isMesh || !c.geometry || !c.geometry.attributes
					|| !c.geometry.attributes.position) return;
				const mats = Array.isArray(c.material) ? c.material : [c.material];
				const named = mats.some((m) =>
					/brake|caliper/i.test((m && m.name) || ''))
					|| /brake|caliper/i.test(c.name || '');

				const arr = c.geometry.attributes.position;
				rel.multiplyMatrices(inv, c.matrixWorld);
				let sy = 0, sz = 0, r = 0;
				for (let i = 0; i < arr.count; i++) {
					p.fromBufferAttribute(arr, i).applyMatrix4(rel);
					sy += p.y;
					sz += p.z;
					const q = Math.hypot(p.y, p.z);
					if (q > r) r = q;
				}
				const off = Math.hypot(sy / arr.count, sz / arr.count);

				const eccentric = r > 1e-6 && off > 0.30 * r;
				if (named || eccentric) {
					move.push({ node: c, off: off / (r || 1), named });
				}
			});
			for (const m of move) {
				w.steer.attach(m.node);

				const mats = Array.isArray(m.node.material)
					? m.node.material : [m.node.material];
				const swapped = mats.map((mm) => {
					if (!mm) return mm;
					const c = mm.clone();
					c.name = 'caliper';
					c.needsUpdate = true;
					return c;
				});
				m.node.material = Array.isArray(m.node.material)
					? swapped : swapped[0];
				moved.push(`${m.node.name || '?'}`
					+ `(${m.named ? 'named' : 'off-axle'} ${m.off.toFixed(2)})`);
				n++;
			}
		}
		if (n) {
			;
		}
	}

	_repaintByArea(wrapper) {
		const want = [qs('bodycol'), qs('trimcol')];
		const inWheel = new Set();
		for (const w of this.wheels) {
			w.spin.traverse((n) => inWheel.add(n));
			w.steer.traverse((n) => inWheel.add(n));
		}
		const area = new Map();
		const a = new THREE.Vector3();
		const b = new THREE.Vector3();
		const c = new THREE.Vector3();
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.geometry || inWheel.has(child)) return;
			const mats = Array.isArray(child.material)
				? child.material : [child.material];
			const m = mats[0];
			if (!m) return;

			if (/shadow|ao_|_ao\b|ambientocclusion|decal/i.test(m.name || '')) return;
			const pos = child.geometry.attributes.position;
			const idx = child.geometry.index;
			const count = idx ? idx.count : pos.count;
			let sum = 0;
			for (let i = 0; i < count; i += 3) {
				const i0 = idx ? idx.getX(i) : i;
				const i1 = idx ? idx.getX(i + 1) : i + 1;
				const i2 = idx ? idx.getX(i + 2) : i + 2;
				a.fromBufferAttribute(pos, i0);
				b.fromBufferAttribute(pos, i1);
				c.fromBufferAttribute(pos, i2);
				b.sub(a);
				c.sub(a);
				sum += b.cross(c).length() / 2;
			}
			area.set(m, (area.get(m) || 0) + sum);
		});
		const rank = [...area.entries()].sort((p, q) => q[1] - p[1]);
		const total = rank.reduce((s, r) => s + r[1], 0) || 1;

		this._areaRank = rank.map((r) => r[0]);
		;
		for (let i = 0; i < want.length; i++) {
			if (!want[i] || !rank[i]) continue;
			const hex = parseInt(String(want[i]).replace(/^#/, ''), 16);
			if (!Number.isFinite(hex)) continue;
			const m = rank[i][0];
			if (!m.color) continue;
			m.color.setHex(hex);

			if (m.map) {
				console.warn(`[carmesh] ${m.name} carries a map — ?bodycol only `
					+ 'multiplies it. Use ?hue= / ?sat= for a textured body.');
			}
			m.needsUpdate = true;
			;
		}
	}

	_dampGloss(wrapper) {

		const raw = GLOSS_Q;
		const q = (raw === null || String(raw).trim() === '') ? NaN : Number(raw);
		const GLOSS = Number.isFinite(q)
			? Math.max(0, Math.min(1, q))
			: (CAR_GLOSS[CAR_NAME] ?? 1);
		if (GLOSS >= 1) return;
		const seen = new Set();
		let n = 0;
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const mats = Array.isArray(child.material)
				? child.material : [child.material];
			for (const m of mats) {
				if (!m || seen.has(m)) continue;
				seen.add(m);
				const nm = (m.name || '').toLowerCase();
				if (/glass|window|screen|glow|light|lamp|lens/.test(nm)) continue;
				if (m.emissive && m.emissive.getHex() !== 0) continue;
				if (m.transparent || (m.opacity !== undefined && m.opacity < 1)) continue;
				if (m.metalness !== undefined) m.metalness *= GLOSS;
				if (m.roughness !== undefined) {
					m.roughness = m.roughness + (1 - m.roughness) * (1 - GLOSS);
				}
				if (m.envMapIntensity !== undefined) m.envMapIntensity *= GLOSS;
				m.needsUpdate = true;
				n++;
			}
		});
		;
	}

	_filterMaps(wrapper) {
		if (MAP_HUE === 0 && MAP_SAT === 1 && MAP_BRIGHT === 1) return;
		const done = new Map();
		let n = 0;

		const filter = (tex) => {
			if (!tex || !tex.image) return tex;
			if (done.has(tex)) return done.get(tex);
			const w = tex.image.width | 0;
			const h = tex.image.height | 0;
			if (!w || !h) return tex;
			const cv = document.createElement('canvas');
			cv.width = w;
			cv.height = h;
			const cx = cv.getContext('2d', { willReadFrequently: true });
			cx.drawImage(tex.image, 0, 0);
			const img = cx.getImageData(0, 0, w, h);
			const d = img.data;
			const shift = (MAP_HUE / 360) % 1;
			for (let i = 0; i < d.length; i += 4) {
				const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
				const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
				let hh = 0;
				const l = (mx + mn) / 2;
				const dd = mx - mn;
				let s = 0;
				if (dd > 1e-6) {
					s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
					if (mx === r) hh = ((g - b) / dd + (g < b ? 6 : 0)) / 6;
					else if (mx === g) hh = ((b - r) / dd + 2) / 6;
					else hh = ((r - g) / dd + 4) / 6;
				}
				hh = (hh + shift + 1) % 1;
				s = Math.min(1, Math.max(0, s * MAP_SAT));
				const ll = Math.min(1, Math.max(0, l * MAP_BRIGHT));
				if (s < 1e-6) {
					d[i] = d[i + 1] = d[i + 2] = Math.round(ll * 255);
					continue;
				}
				const q = ll < 0.5 ? ll * (1 + s) : ll + s - ll * s;
				const p = 2 * ll - q;
				const chan = (t) => {
					if (t < 0) t += 1;
					if (t > 1) t -= 1;
					if (t < 1 / 6) return p + (q - p) * 6 * t;
					if (t < 1 / 2) return q;
					if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
					return p;
				};
				d[i] = Math.round(chan(hh + 1 / 3) * 255);
				d[i + 1] = Math.round(chan(hh) * 255);
				d[i + 2] = Math.round(chan(hh - 1 / 3) * 255);
			}
			cx.putImageData(img, 0, 0);
			const out = new THREE.CanvasTexture(cv);
			out.flipY = tex.flipY;
			out.wrapS = tex.wrapS;
			out.wrapT = tex.wrapT;
			out.colorSpace = tex.colorSpace;
			out.needsUpdate = true;
			done.set(tex, out);
			n++;
			return out;
		};

		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const mats = Array.isArray(child.material)
				? child.material : [child.material];
			for (const m of mats) {

				if (m && m.map) {
					m.map = filter(m.map);
					m.needsUpdate = true;
				}
			}
		});
		;
	}

	_restyleRims() {
		if (!RIM_STYLES.includes(RIM_STYLE) || RIM_STYLE === 'dish') {
			;
			return;
		}
		const inv = new THREE.Matrix4();
		const rel = new THREE.Matrix4();
		const p = new THREE.Vector3();
		let fitted = 0;
		let note = '';
		for (const w of this.wheels) {
			w.spin.updateMatrixWorld(true);
			inv.copy(w.spin.matrixWorld).invert();

			const found = [];
			w.spin.traverse((n) => {
				if (!n.isMesh || !n.geometry || !n.geometry.attributes
					|| !n.geometry.attributes.position) return;
				rel.multiplyMatrices(inv, n.matrixWorld);
				const arr = n.geometry.attributes.position;
				const box = new THREE.Box3();
				let r = 0;
				for (let i = 0; i < arr.count; i++) {
					p.fromBufferAttribute(arr, i).applyMatrix4(rel);
					box.expandByPoint(p);
					const q = Math.hypot(p.y, p.z);
					if (q > r) r = q;
				}
				found.push({ mesh: n, r, box });
			});
			if (found.length < 2) continue;
			const tyreR = Math.max(...found.map((f) => f.r));

			const inner = found.filter((f) => f.r < 0.90 * tyreR);
			if (!inner.length) continue;
			const box = new THREE.Box3();
			for (const f of inner) box.union(f.box);
			const size = box.getSize(new THREE.Vector3());
			const mid = box.getCenter(new THREE.Vector3());
			const R = Math.max(size.y, size.z) / 2;

			const tyreW = Math.max(...found.map((f) => f.box.getSize(new THREE.Vector3()).x));
			const W = Math.max(size.x, tyreW * 0.55);
			const geo = buildRimGeometry(RIM_STYLE, R, W);
			if (!geo) continue;
			const mat = (Array.isArray(inner[0].mesh.material)
				? inner[0].mesh.material[0] : inner[0].mesh.material);
			for (const f of inner) f.mesh.visible = false;
			const mesh = new THREE.Mesh(geo, mat);
			mesh.name = `rim_${w.corner}`;
			mesh.position.copy(mid);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			w.spin.add(mesh);

			const brake = buildBrakeGeometry(RIM_STYLE, R, W);
			if (brake) {
				const bm = new THREE.Mesh(brake, mat);
				bm.name = `brake_${w.corner}`;
				bm.position.copy(mid);
				bm.castShadow = true;
				bm.receiveShadow = true;
				w.spin.add(bm);
			}
			fitted++;
			if (!note) {
				note = `r=${R.toFixed(3)} w=${W.toFixed(3)} in a tyre of `
					+ `${tyreR.toFixed(3)}, replacing ${inner.length} mesh(es) `
					+ `[${inner.map((f) => f.mesh.name || '?').join(', ')}]`;
			}
		}
		;
	}

	_paintPack(wrapper) {
		const wheelMeshes = new Set();
		for (const w of this.wheels) {
			w.spin.traverse((n) => { if (n.isMesh) wheelMeshes.add(n); });
		}

		const mix = (from, to) => from + (to - from) * MATTE;
		const made = new Map();
		const retint = (m, colour, metal, rough) => {
			if (!m) return m;
			const key = m.uuid + ":" + (colour === null ? "keep" : colour);
			let c = made.get(key);
			if (!c) {
				c = m.clone();
				c.name = m.name;
				if (colour !== null && c.color) c.color.setHex(colour);
				if (c.metalness !== undefined) c.metalness = metal;
				if (c.roughness !== undefined) c.roughness = rough;
				c.needsUpdate = true;
				made.set(key, c);
			}
			return c;
		};
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const isWheel = wheelMeshes.has(child);
			const apply = (m) => {
				const n = (m && m.name) || "";

				if (isWheel && /^rim$/i.test(n)) {
					return retint(m, PACK_PAINT.rim, 0.88, 0.26);
				}
				if (isWheel && /^(rubber|tyre|tire)$/i.test(n)) {
					return retint(m, PACK_PAINT.tyre, 0.0, 0.95);
				}
				if (/^metallic$/i.test(n)) {

					if (isWheel) return retint(m, PACK_PAINT.rim, 0.88, 0.26);

					const shell = retint(m, null, mix(m.metalness, 0.04), mix(m.roughness, 0.70));
					if (PACK_PAINT.body !== null) {
						this._paintHex = PACK_PAINT.body;
						this._roofHex = PACK_PAINT.roof;
						this._tintMap(shell, child, PACK_PAINT.body, PACK_PAINT.roof);
					}
					return shell;
				}
				if (/^texture$/i.test(n)) {
					if (isWheel) return retint(m, PACK_PAINT.tyre, 0.0, 0.95);

					if (PLATE_OFF) { child.visible = false; return m; }
					const trimTo = (PACK_PAINT.accent === null) ? PACK_PAINT.plate : PACK_PAINT.accent;
					return retint(m, trimTo, 0.0, 0.90);
				}
				return m;
			};
			child.material = Array.isArray(child.material)
				? child.material.map(apply) : apply(child.material);
		});
	}

	_fixBareLenses(wrapper) {
		const bare = [];
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material || Array.isArray(child.material)) return;
			const m = child.material;

			const bareDefault = !(m.name && m.name.length) && !m.map
				&& m.metalness === 1 && m.roughness === 1;
			const isLight = /^light$/i.test(m.name || "");
			if (!bareDefault && !isLight) return;
			bare.push(child);
		});
		if (!bare.length) return;

		const head = new THREE.MeshStandardMaterial({
			color: PACK_PAINT.head, metalness: 0.0, roughness: 0.28,
			emissive: new THREE.Color(PACK_PAINT.head), emissiveIntensity: 0,
		});
		head.name = "left_front_light";
		const tail = new THREE.MeshStandardMaterial({
			color: PACK_PAINT.tail, metalness: 0.0, roughness: 0.32,
			emissive: new THREE.Color(0xff1808), emissiveIntensity: 0,
		});
		tail.name = "brakelight";

		const plate = new THREE.MeshStandardMaterial({
			color: PACK_PAINT.plate, metalness: 0.0, roughness: 0.85,
		});
		plate.name = "plate";

		for (const mesh of bare) this._splitLens(mesh, head, tail, plate);
	}

	_splitLens(mesh, headMat, tailMat, plateMat) {
		const geo = mesh.geometry;
		const pos = geo && geo.attributes && geo.attributes.position;
		if (!pos) return;
		if (!geo.boundingBox) geo.computeBoundingBox();
		const bb = geo.boundingBox;
		const midZ = (bb.min.z + bb.max.z) / 2;
		const midX = (bb.min.x + bb.max.x) / 2;
		const halfX = Math.max(1e-6, (bb.max.x - bb.min.x) / 2);
		const idx = geo.index;
		const tris = idx ? idx.count / 3 : pos.count / 3;
		const at = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);

		const buckets = { head: [], tail: [], plate: [] };
		for (let t = 0; t < tris; t++) {
			let cz = 0;
			let cx = 0;
			for (let k = 0; k < 3; k++) {
				const v = at(t, k);
				cz += pos.getZ(v) / 3;
				cx += pos.getX(v) / 3;
			}
			const outboard = Math.abs(cx - midX) > halfX * 0.45;
			const key = (cz < midZ) ? "head" : (outboard ? "tail" : "plate");
			for (let k = 0; k < 3; k++) buckets[key].push(at(t, k));
		}

		if (!buckets.tail.length && !buckets.plate.length) return;

		const mats = { head: headMat, tail: tailMat, plate: plateMat };
		const parent = mesh.parent || this.wrapper;
		for (const key of ["head", "tail", "plate"]) {
			const list = buckets[key];
			if (!list.length) continue;
			if (key === "plate" && PLATE_OFF) continue;
			const g = geo.clone();
			g.setIndex(list);
			g.clearGroups();
			const part = new THREE.Mesh(g, mats[key]);
			part.name = mesh.name + "_" + key;
			part.position.copy(mesh.position);
			part.quaternion.copy(mesh.quaternion);
			part.scale.copy(mesh.scale);
			part.castShadow = true;
			part.receiveShadow = true;
			parent.add(part);
		}
		mesh.visible = false;
		if (mesh.parent) mesh.parent.remove(mesh);
	}

	_tintMap(mat, mesh, bodyHex, roofHex) {
		if (!mat || bodyHex === null || bodyHex === undefined) return;

		if (!mat.__srcMap) mat.__srcMap = mat.map;
		const src = mat.__srcMap;
		if (!src || !src.image) return;
		const key = bodyHex + ':' + (roofHex === null || roofHex === undefined ? 'same' : roofHex);
		if (mat.__tintedTo === key) return;
		const img = src.image;
		const w = img.width | 0;
		const h = img.height | 0;
		if (!w || !h) return;
		if (typeof document === 'undefined') return;

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;
		ctx.drawImage(img, 0, 0);

		const sw = this._shellSwatches(mesh, ctx, w, h);
		if (!sw.body) return;
		const bodyTarget = new THREE.Color(bodyHex);
		const roofTarget = (roofHex === null || roofHex === undefined)
			? null : new THREE.Color(roofHex);
		const bodyLuma = Math.max(1, sw.body.luma);
		const roofLuma = sw.roof ? Math.max(1, sw.roof.luma) : bodyLuma;

		const data = ctx.getImageData(0, 0, w, h);
		const px = data.data;
		const d2 = (r, g, b, s) => {
			const dr = r - s.r;
			const dg = g - s.g;
			const db = b - s.b;
			return dr * dr + dg * dg + db * db;
		};
		for (let i = 0; i < px.length; i += 4) {
			const r = px[i];
			const g = px[i + 1];
			const b = px[i + 2];

			const luma = 0.299 * r + 0.587 * g + 0.114 * b;
			let target = bodyTarget;
			let ref = bodyLuma;
			if (roofTarget && sw.roof && d2(r, g, b, sw.roof) < d2(r, g, b, sw.body)) {
				target = roofTarget;
				ref = roofLuma;
			}
			const k = luma / ref;
			px[i] = Math.min(255, Math.round(target.r * 255 * k));
			px[i + 1] = Math.min(255, Math.round(target.g * 255 * k));
			px[i + 2] = Math.min(255, Math.round(target.b * 255 * k));
		}
		ctx.putImageData(data, 0, 0);

		const tex = new THREE.CanvasTexture(canvas);
		tex.flipY = src.flipY;
		tex.wrapS = src.wrapS;
		tex.wrapT = src.wrapT;
		tex.colorSpace = src.colorSpace;
		tex.needsUpdate = true;

		if (mat.map && mat.map !== src && mat.map.dispose) mat.map.dispose();
		mat.map = tex;

		if (mat.color) mat.color.setHex(0xffffff);
		mat.__tintedTo = key;
		mat.needsUpdate = true;
		const hx = (s) => '#' + [s.r, s.g, s.b]
			.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
		;
	}

	_shellSwatches(mesh, ctx, w, h) {
		const geo = mesh && mesh.geometry;
		const uv = geo && geo.attributes && geo.attributes.uv;
		const pos = geo && geo.attributes && geo.attributes.position;
		if (!uv || !pos) return { body: null, roof: null };
		const idx = geo.index;
		const tris = idx ? idx.count / 3 : pos.count / 3;
		if (!tris) return { body: null, roof: null };
		const at = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
		const step = Math.max(1, Math.floor(tris / 600));
		const tally = new Map();
		for (let t = 0; t < tris; t += step) {
			const i0 = at(t, 0);
			const i1 = at(t, 1);
			const i2 = at(t, 2);
			const ax = pos.getX(i0);
			const ay = pos.getY(i0);
			const az = pos.getZ(i0);
			const bx = pos.getX(i1) - ax;
			const by = pos.getY(i1) - ay;
			const bz = pos.getZ(i1) - az;
			const cx = pos.getX(i2) - ax;
			const cy = pos.getY(i2) - ay;
			const cz = pos.getZ(i2) - az;
			const nx = by * cz - bz * cy;
			const ny = bz * cx - bx * cz;
			const nz = bx * cy - by * cx;
			const area = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
			if (!(area > 0)) continue;

			if (ny / (2 * area) < -0.5) continue;
			const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3;
			const v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
			const x = Math.min(w - 1, Math.max(0, Math.round(u * w)));
			const y = Math.min(h - 1, Math.max(0, Math.round(v * h)));
			const d = ctx.getImageData(x, y, 1, 1).data;
			const q = ((d[0] >> 5) << 10) | ((d[1] >> 5) << 5) | (d[2] >> 5);
			let rec = tally.get(q);
			if (!rec) { rec = { r: 0, g: 0, b: 0, n: 0, area: 0 }; tally.set(q, rec); }
			rec.r += d[0]; rec.g += d[1]; rec.b += d[2]; rec.n++; rec.area += area;
		}
		const list = [];
		for (const rec of tally.values()) {
			const r = rec.r / rec.n;
			const g = rec.g / rec.n;
			const b = rec.b / rec.n;
			list.push({ r, g, b, area: rec.area, luma: 0.299 * r + 0.587 * g + 0.114 * b });
		}
		list.sort((a2, z) => z.area - a2.area);
		const body = list[0] || null;
		let roof = null;
		if (body) {
			for (const s of list) {
				if (s === body) continue;
				if (s.luma < body.luma * 0.82) { roof = s; break; }
			}
		}
		return { body, roof, list };
	}

	_paintParts(wrapper) {

		const look = { ...(CAR_LOOK[CAR_NAME] || {}), ...PART_KNOBS };
		for (const [name, value] of Object.entries(look)) {

			if (value === 'hide') this.setPartVisible(name, false, wrapper);
			else this.setPartColour(name, value, wrapper);
		}
	}

	setPartColour(name, value, wrapper = this.wrapper) {
		if (!wrapper) return 0;
		const key = String(name || '').toLowerCase();
		let raw = String(value === null || value === undefined ? '' : value)
			.toLowerCase().replace(/^#/, '');
		if (!raw) return 0;
		if (raw === 'off' || raw === 'none' || raw === 'body') {
			raw = this._partHex && this._partHex.paint ? this._partHex.paint : null;
			if (raw === null) {

				let found = null;
				wrapper.traverse((c) => {
					if (found || !c.isMesh) return;
					const mats = Array.isArray(c.material) ? c.material : [c.material];
					for (const m of mats) {
						if (m && /^paint$/i.test(m.name || '')) found = m.color.getHex();
					}
				});
				raw = found === null ? null : found.toString(16).padStart(6, '0');
			}
			if (raw === null) return 0;
		}
		let hex;
		if (Object.prototype.hasOwnProperty.call(SHADES, raw)) hex = SHADES[raw];
		else if (/^[0-9a-f]{6}$/.test(raw)) hex = parseInt(raw, 16);
		else {
			console.warn(`[carmesh] no such shade: ${raw} — known: `
				+ Object.keys(SHADES).join(' '));
			return 0;
		}

		let n = 0;
		const seen = new Set();
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const mats = Array.isArray(child.material) ? child.material : [child.material];
			for (const m of mats) {
				if (!m || seen.has(m)) continue;
				const mn = (m.name || '').toLowerCase();

				const hit = key === 'accent'
					? mn === (this._accentName || '')
					: (mn === key || mn.startsWith(key + '_'));
				if (!hit) continue;
				seen.add(m);
				m.color.setHex(hex);

				if (m.map) { m.map = null; m.needsUpdate = true; }
				n++;
			}
		});
		if (!n) {
			console.warn(`[carmesh] no part named ${key} on this body`);
			return 0;
		}
		(this._partHex ||= {})[key] = hex.toString(16).padStart(6, '0');
		return n;
	}

	setPartVisible(name, on, wrapper = this.wrapper) {
		if (!wrapper) return 0;
		const key = String(name || '').toLowerCase();
		let n = 0;
		wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const mats = Array.isArray(child.material) ? child.material : [child.material];
			for (const m of mats) {
				const mn = (m && m.name ? m.name : '').toLowerCase();
				if (mn !== key && !mn.startsWith(key + '_')) continue;
				child.visible = !!on;
				n++;
				break;
			}
		});
		if (!n) console.warn(`[carmesh] no part named ${key} on this body`);
		return n;
	}

	partNames() {
		const out = new Map();
		if (!this.wrapper) return [];
		this.wrapper.traverse((child) => {
			if (!child.isMesh || !child.material) return;
			const mats = Array.isArray(child.material) ? child.material : [child.material];
			for (const m of mats) {
				if (!m || !m.name || out.has(m.name)) continue;
				out.set(m.name, '#' + m.color.getHexString());
			}
		});
		return [...out].map(([name, colour]) => ({ name, colour }));
	}

	setPaint(body, roof) {
		const resolve = (v) => {
			if (v === null || v === undefined || v === '') return undefined;
			const raw = String(v).toLowerCase().replace(/^#/, '');
			if (Object.prototype.hasOwnProperty.call(SHADES, raw)) return SHADES[raw];
			if (/^[0-9a-f]{6}$/.test(raw)) return parseInt(raw, 16);

			console.warn('[carmesh] no such shade: ' + raw
				+ ' — known: ' + Object.keys(SHADES).join(' '));
			return undefined;
		};
		const b = resolve(body);
		const r = resolve(roof);
		if (b !== undefined) this._paintHex = b;
		if (r !== undefined) this._roofHex = r;

		if (String(roof).toLowerCase() === 'none') this._roofHex = null;
		if (this._paintHex === undefined || this._paintHex === null) return null;
		if (!this.wrapper) return null;
		const wheelMeshes = new Set();
		for (const w of this.wheels) {
			w.spin.traverse((n) => { if (n.isMesh) wheelMeshes.add(n); });
		}
		let tinted = 0;
		this.wrapper.traverse((child) => {
			if (!child.isMesh || !child.material || wheelMeshes.has(child)) return;
			const mats = Array.isArray(child.material) ? child.material : [child.material];
			for (const m of mats) {
				if (!m || !/^metallic$/i.test(m.name || '')) continue;
				this._tintMap(m, child, this._paintHex, this._roofHex);
				tinted++;
			}
		});

		if (!tinted) {
			const hex = this._paintHex.toString(16).padStart(6, '0');
			const n = this.setPartColour('paint', hex);
			if (this._roofHex !== undefined && this._roofHex !== null) {
				this.setPartColour('stripe',
					this._roofHex.toString(16).padStart(6, '0'));
			}

			if (!n && this._areaRank && this._areaRank.length) {
				const body = this._areaRank[0];
				if (body && body.color) {
					body.color.setHex(this._paintHex);
					body.needsUpdate = true;
				}
				const roof = this._areaRank[1];
				if (this._roofHex !== undefined && this._roofHex !== null
					&& roof && roof.color) {
					roof.color.setHex(this._roofHex);
					roof.needsUpdate = true;
				}
				;
			}
		}
		return this._paintHex;
	}

	_rigBrakeLights(wrapper) {
		const clones = new Map();
		const cloneOf = (m) => {
			if (!m || !m.name) return m;
			const spec = LAMPS.find((L) => L.test.test(m.name));
			if (!spec) return m;
			let c = clones.get(m);
			if (!c) {
				c = m.clone();
				c.emissive = new THREE.Color(spec.colour);
				c.emissiveIntensity = 0;
				clones.set(m, c);
				(this.lamps[spec.key] ||= []).push(c);
				this.lampPeak[spec.key] = spec.peak;
				if (spec.key === 'brake') this.brakeMats.push(c);
			}
			return c;
		};
		wrapper.traverse((child) => {
			if (!child.isMesh) return;
			child.material = Array.isArray(child.material)
				? child.material.map(cloneOf)
				: cloneOf(child.material);
		});
	}

	_buildSpoiler() {
		if (this._spoiler || !this.group || !this._fit) return;
		const h = this._fit.half;
		const black = new THREE.MeshStandardMaterial({
			color: 0x0d0f12, metalness: 0.45, roughness: 0.42, flatShading: true,
		});
		const g = new THREE.Group();
		const add = (w, hh, d, x, y, z) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), black);
			m.position.set(x, y, z);
			m.castShadow = false;
			m.receiveShadow = false;
			g.add(m);
		};

		this.group.updateMatrixWorld(true);
		const wb = new THREE.Box3().setFromObject(this.wrapper);
		if (!Number.isFinite(wb.max.y) || wb.isEmpty()) return;

		wb.applyMatrix4(new THREE.Matrix4().copy(this.group.matrixWorld).invert());
		const bodyTop = wb.max.y;
		const bodyHalfW = Math.max(0.2, (wb.max.x - wb.min.x) / 2);

		const zTail = wb.max.z * 0.88;
		const yDeck = bodyTop;

		const rise = bodyTop * 0.16;
		const blade = Math.max(0.025, bodyTop * 0.035);

		add(bodyHalfW * 1.5, blade, bodyHalfW * 0.42, 0, yDeck + rise, zTail);

		add(bodyHalfW * 0.10, rise, bodyHalfW * 0.30, -bodyHalfW * 0.50, yDeck + rise * 0.5, zTail);
		add(bodyHalfW * 0.10, rise, bodyHalfW * 0.30, bodyHalfW * 0.50, yDeck + rise * 0.5, zTail);
		this._spoiler = g;
		this.group.add(g);
	}

	setSpoiler(on) {
		if (on) this._buildSpoiler();
		if (this._spoiler) this._spoiler.visible = !!on;
	}

	_buildBeams() {
		if (this._beams || !this.group) return;
		const setup = BEAM_SETUPS[this.brights ? "main" : "dipped"];
		const make = (x) => {
			const s = new THREE.SpotLight(setup.colour, 0, setup.range, setup.angle, 0.5, 1.3);
			s.castShadow = false;

			s.position.set(x, 0.62, -1.6);

			s.target.position.set(x * 0.45, -setup.drop, -setup.range * 0.5);
			this.group.add(s);
			this.group.add(s.target);
			return s;
		};
		this._beams = [make(-0.62), make(0.62)];
	}

	setBrights(on) {
		this.brights = !!on;
		this._applyBeamSetup();
		return this.brights;
	}

	setBeamTuning(o) {
		this._beamTune = { ...(this._beamTune || {}), ...(o || {}) };
		this._applyBeamSetup();
		return this._beamTune;
	}

	beamTuning() {
		const setup = BEAM_SETUPS[this.brights ? "main" : "dipped"];
		const t = this._beamTune || {};
		return {
			gain: t.gain ?? setup.gain,
			cone: t.cone ?? setup.angle,
			drop: t.drop ?? setup.drop,
			range: t.range ?? setup.range,
		};
	}

	_applyBeamSetup() {
		const setup = BEAM_SETUPS[this.brights ? "main" : "dipped"];
		const t = this.beamTuning();
		this._beamGain = t.gain;
		if (!this._beams) return;
		for (const s of this._beams) {
			const x = s.position.x;
			s.distance = t.range;
			s.angle = t.cone;
			s.color.setHex(setup.colour);
			s.target.position.set(x * 0.45, -t.drop, -t.range * 0.5);
			s.target.updateMatrixWorld(true);

			s.intensity = (this._beamLevel || 0) * t.gain;
		}
	}

	setBeams(level) {
		const v = Math.max(0, Math.min(1, Number(level) || 0));

		this._beamLevel = v;
		if (v <= 0 && !this._beams) return;
		const fresh = !this._beams;
		this._buildBeams();
		if (!this._beams) return;

		if (fresh && this._beamTune) this._applyBeamSetup();
		for (const b of this._beams) b.intensity = v * (this._beamGain || BEAM_GAIN);
	}

	setLamp(key, on, dt) {
		const mats = this.lamps[key];
		if (!mats || !mats.length) return;
		const cur = this.lampGlow[key] || 0;
		const next = cur + ((on ? 1 : 0) - cur) * Math.min(1, 12 * dt);
		this.lampGlow[key] = next;
		const peak = (this.lampPeak[key] || 1) * LAMP_GAIN;
		for (const m of mats) m.emissiveIntensity = next * peak;
	}
}

export function createCarMesh(scene) {
	const cm = new CarMesh(scene);
	cm.load();
	return cm;
}
