

import * as THREE from 'three';

import RAPIER from './vendor/rapier.mjs';

const MODULE_STAMP = new URL(import.meta.url).search || '';

function _lampFlag(name, dflt) {
	if (typeof location === 'undefined') return dflt;
	const v = new URLSearchParams(location.search).get(name);
	if (v === null) return dflt;
	return v !== '0' && v !== 'off' && v !== 'false';
}

const HEADLIGHTS = _lampFlag('headlights', false);
const FOGLIGHTS = _lampFlag('foglights', false);

let _lensOverride = null;
export function setCarLamps(on) { _lensOverride = (on === null ? null : !!on); }

const BRAKELIGHTS_HELD = _lampFlag('brakelights', false);

const MAX_ENGINE_FORCE = 1800.0;
const MAX_BRAKE = 200.0;
const STEER_SIGN = 1.0;

const DRIVE_SIGN = -1.0;

export const CAR_SCALE = 0.72;

export const STEER_SCALES_WITH_CAR = false;

const GROUP_GROUND = 0x0001;
const GROUP_CHASSIS = 0x0002;

export const GROUND_GROUPS = (GROUP_GROUND << 16) | (0xFFFF & ~GROUP_CHASSIS);
export const CHASSIS_GROUPS = (GROUP_CHASSIS << 16) | (0xFFFF & ~GROUP_GROUND);

export const ALL_GROUPS = (0xFFFF << 16) | 0xFFFF;

export const CHASSIS_FRICTION = 0.0;

const BASE_HALF = { x: 0.9, y: 0.35, z: 2.1 };
const BASE_OFFSET_Y = 0.55;

const MASS = 1200.0;
const BASE_COM_Y = -0.32;
const BASE_WHEEL_R = 0.35;
const WHEEL_REST_LENGTH = 0.2;
const WHEEL_FRICTION = 8.0;
const SUSP_MAX_FORCE = 12000.0;

const HANDBRAKE = 90.0;

const HB_ON = 5.0;

const DRIFT_FROM_MS = 4.0;
const DRIFT_FULL_MS = 11.0;

let DRIFT_ANGLE_MAX = 0.85;
export function setDriftAngle(v) {
	if (Number.isFinite(v)) DRIFT_ANGLE_MAX = clamp(v, 0.1, 1.2);
}
export function getDriftAngle() { return DRIFT_ANGLE_MAX; }

let DRIFT_YAW_DAMP = 0.55;
export function setDriftCatch(v) {
	if (Number.isFinite(v)) DRIFT_YAW_DAMP = clamp(v, 0.0, 1.5);
}
export function getDriftCatch() { return DRIFT_YAW_DAMP; }

let _driftGain = 1.0;
export function setDriftGain(v) {
	if (Number.isFinite(v)) _driftGain = clamp(v, 0.2, 4.0);
}
export function getDriftGain() { return _driftGain; }

let _hbSlip = 0.28;
export function setHbSlip(v) {
	_hbSlip = Number.isFinite(v) ? clamp(v, 0.02, 1.0) : null;
}
export function getHbSlip() { return _hbSlip; }

const DRIFT_YAW_REF = 6.0;

export const POWER_LEVELS = ['gentle', 'standard', 'brisk', 'launch'];
const POWER_MUL = { gentle: 0.65, standard: 1.0, brisk: 1.5, launch: 2.2 };
let _power = 1.0;
export function setPower(v) {
	if (Number.isFinite(v)) _power = clamp(v, 0.3, 3.0);
}
export function getPower() { return _power; }
export function setPowerLevel(name) {
	const m = POWER_MUL[name];
	if (m !== undefined) _power = m;
}
export function getPowerLevel() {
	for (const k of POWER_LEVELS) {
		if (Math.abs(POWER_MUL[k] - _power) < 1e-6) return k;
	}
	return 'custom';
}

export const STEER_FEELS = ['direct', 'fine', 'finer', 'precise'];
const STEER_FEEL_CURVE = { direct: 1.0, fine: 1.5, finer: 1.9, precise: 2.4 };

let _steerCurve = null;
export function setSteerCurve(v) {
	_steerCurve = Number.isFinite(v) ? clamp(v, 1.0, 3.0) : null;
}
export function getSteerCurve() { return _steerCurve; }
export function setSteerFeel(name) {
	const c = STEER_FEEL_CURVE[name];
	_steerCurve = c === undefined ? null : c;
}

export function getSteerFeel() {
	for (const k of STEER_FEELS) {
		if (Math.abs(STEER_FEEL_CURVE[k] - (_steerCurve === null ? 1.0 : _steerCurve))
			< 1e-6) return k;
	}
	return 'custom';
}

let _steerLock = null;
export function setSteerLock(v) {
	_steerLock = Number.isFinite(v) ? clamp(v, 0.15, 0.8) : null;
}
export function getSteerLock() { return _steerLock; }

export const DRIFT_MODES = ['lock', 'torque'];
let _driftMode = 'lock';
export function setDriftMode(m) {
	_driftMode = DRIFT_MODES.indexOf(m) >= 0 ? m : 'lock';
}
export function getDriftMode() { return _driftMode; }
const HB_OFF = 10.0;

const SUSP_STIFFNESS = 25.0;
const SUSP_TRAVEL = 0.3;
const SUSP_COMPRESSION = 0.7;
const SUSP_RELAXATION = 0.9;

const SUSP_COMP_RATIO = SUSP_COMPRESSION / (2.0 * Math.sqrt(SUSP_STIFFNESS));
const SUSP_RELAX_RATIO = SUSP_RELAXATION / (2.0 * Math.sqrt(SUSP_STIFFNESS));

const MPH = 2.236936;

const BASE_WHEELS = [
	{ x: -0.85, y: 0.35, z: -1.45, steer: true },
	{ x: 0.85, y: 0.35, z: -1.45, steer: true },
	{ x: -0.85, y: 0.35, z: 1.45, steer: false },
	{ x: 0.85, y: 0.35, z: 1.45, steer: false },
];

const DOWN = { x: 0, y: -1, z: 0 };
const AXLE = { x: -1, y: 0, z: 0 };

const BASE_WHEELBASE = 2.9;

export const HANDLING = {
	stock: {
		label: 'stock',
		note: 'the car as it was — no self-aligning, one 3.0 rad/s ramp, no governor. The control.',
		maxSteer: 0.45, rise: 3.0, fall: 3.0, falloff: 28.0, slew: 99.0,
		align: 0.0, hold: 0.0,
		topMph: null, down: 0.0,
		upright: 1.6, antiRoll: 2.2,
		susp: { stiff: SUSP_STIFFNESS, travel: SUSP_TRAVEL,
			compR: SUSP_COMP_RATIO, relaxR: SUSP_RELAX_RATIO },
	},
	settled: {
		label: 'settled',
		note: 'self-aligning only, softer in and quicker out. A car with caster. 55 mph.',
		maxSteer: 0.42, rise: 1.8, fall: 5.0, falloff: 28.0, slew: 8.0,
		align: 1.3, hold: 0.0, holdDamp: 0.0,
		topMph: 55, down: 0.0,
		upright: 1.6, antiRoll: 2.2,
		susp: { stiff: SUSP_STIFFNESS, travel: SUSP_TRAVEL,
			compR: SUSP_COMP_RATIO, relaxR: SUSP_RELAX_RATIO },
	},
	assisted: {
		label: 'assisted',
		note: 'settled plus a gentle heading hold — seam kicks are undone, not just damped.',
		maxSteer: 0.42, rise: 1.8, fall: 5.0, falloff: 28.0, slew: 8.0,
		align: 1.3, hold: 0.9, holdDamp: 0.35,
		topMph: 55, down: 0.0,
		upright: 1.6, antiRoll: 2.2,
		susp: { stiff: SUSP_STIFFNESS, travel: SUSP_TRAVEL,
			compR: SUSP_COMP_RATIO, relaxR: SUSP_RELAX_RATIO },
	},
	rails: {
		label: 'rails',
		note: 'strong hold. Hands off and it drives straight; it will fight a real bend.',
		maxSteer: 0.40, rise: 1.5, fall: 6.0, falloff: 28.0, slew: 8.0,
		align: 1.6, hold: 2.0, holdDamp: 0.35,
		topMph: 55, down: 0.0,
		upright: 1.6, antiRoll: 2.2,
		susp: { stiff: SUSP_STIFFNESS, travel: SUSP_TRAVEL,
			compR: SUSP_COMP_RATIO, relaxR: SUSP_RELAX_RATIO },
	},
	glide: {
		label: 'glide',

		note: 'legacy. Damped springs and heavy downforce — the hover feel. Not where this is going.',
		maxSteer: 0.42, rise: 1.4, fall: 5.0, falloff: 34.0, slew: 6.0,

		align: 1.3, hold: 0.0, holdDamp: 0.35,
		topMph: 45,

		down: 0.35,

		upright: 1.6, antiRoll: 2.2,
		wheelR: 0.38,
		susp: { stiff: 18.0, travel: 0.50, rest: 0.24, compR: 0.30, relaxR: 0.40, maxForce: 36000.0 },
	},

	arcade: {
		label: 'arcade',
		note: 'quick and planted. NOTHING touches your steering — the rear tyres do all of it.',
		maxSteer: 0.50, rise: 2.6, fall: 6.0, falloff: 30.0, slew: 12.0,

		align: 0.0, hold: 0.0, holdDamp: 0.0,
		gripF: 7.0, gripR: 11.0, hbSlip: 0.45,
		topMph: 60, down: 0.15,

		magnet: 0.6, airDamp: 0.94,

		wheelR: 0.38,
		upright: 1.6, antiRoll: 2.2, drift: 2.6,
		susp: { stiff: 18.0, travel: 0.68, rest: 0.24, compR: 0.30, relaxR: 0.40, maxForce: 46000.0 },
	},

	arcade2: {
		label: 'arcade 2',
		note: 'arcade lock with an analog wheel — taps are fine, holds go full lock. 80 mph, 128 boosted.',

		maxSteer: 0.50, rise: 2.4, fall: 6.0, falloff: 30.0, slew: 12.0,
		curve: 1.9,

		align: 0.0, hold: 0.0, holdDamp: 0.0,
		gripF: 7.0, gripR: 11.0, hbSlip: 0.45,
		topMph: 80, down: 0.22, boost: 1.9, boostTop: 1.6,

		magnet: 0.6, airDamp: 0.94,

		wheelR: 0.38,
		upright: 1.6, antiRoll: 2.2, drift: 2.6,
		susp: { stiff: 18.0, travel: 0.68, rest: 0.24, compR: 0.30, relaxR: 0.40, maxForce: 46000.0 },
	},
	loose: {
		label: 'loose',
		note: 'front grips harder than the rear, so it rotates. Handbrake turns it. Will spin.',
		maxSteer: 0.52, rise: 2.8, fall: 6.5, falloff: 32.0, slew: 12.0,
		align: 0.0, hold: 0.0, holdDamp: 0.0,
		gripF: 8.5, gripR: 7.0, hbSlip: 0.28,
		topMph: 60, down: 0.10,
		upright: 1.6, antiRoll: 2.2, drift: 3.4,
		wheelR: 0.38,
		susp: { stiff: 17.0, travel: 0.55, rest: 0.24, compR: 0.29, relaxR: 0.39, maxForce: 36000.0 },
	},
	grip: {
		label: 'grip',
		note: 'kart. Enormous grip both ends, heavy downforce, corners flat and fast.',
		maxSteer: 0.46, rise: 3.0, fall: 7.0, falloff: 26.0, slew: 14.0,

		align: 0.30, hold: 0.0, holdDamp: 0.0,
		gripF: 12.0, gripR: 14.0, hbSlip: 0.60,
		topMph: 65, down: 0.60,
		upright: 1.6, antiRoll: 2.2, drift: 1.8,
		wheelR: 0.36,
		susp: { stiff: 26.0, travel: 0.42, rest: 0.20, compR: 0.31, relaxR: 0.40, maxForce: 40000.0 },
	},
	kart: {
		label: 'kart',
		note: 'magnetised to the road — near enough incapable of air. Big soft wheels, drifts on the handbrake.',
		maxSteer: 0.54, rise: 3.0, fall: 7.0, falloff: 36.0, slew: 14.0,
		align: 0.0, hold: 0.0, holdDamp: 0.0,
		gripF: 9.0, gripR: 12.0, hbSlip: 0.40,
		topMph: 55, down: 0.10,

		magnet: 3.0, airDamp: 0.80,

		wheelR: 0.40,
		upright: 1.6, antiRoll: 2.2, drift: 3.2,
		susp: { stiff: 16.0, travel: 0.60, rest: 0.26, compR: 0.32, relaxR: 0.42, maxForce: 40000.0 },
	},
};

export const HANDLING_ORDER = [
	'stock', 'arcade', 'arcade2', 'kart', 'loose', 'grip', 'glide', 'settled', 'assisted', 'rails'];
export const HANDLING_DEFAULT = 'arcade';

const ASSIST_FADE_LO_MS = 2.0;
const ASSIST_FADE_HI_MS = 7.0;

const HOLD_LATCH_YAW_RATE = 0.15;

const UPRIGHT_FROM = 0.52;

const ANTI_ROLL_DAMP = 0.45;

function moveToward(a, b, delta) {
	if (Math.abs(b - a) <= delta) return b;
	return a + Math.sign(b - a) * delta;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function wrapPi(a) {
	while (a > Math.PI) a -= 2 * Math.PI;
	while (a < -Math.PI) a += 2 * Math.PI;
	return a;
}

export async function initRapier() {
	await RAPIER.init();
	return RAPIER;
}

export const GROUND_FRICTION = (() => {
	const q = Number(new URLSearchParams(location.search).get('grip'));
	return Number.isFinite(q) && q > 0 ? q : 1.0;
})();

export function addTrimeshCollider(world, object3D) {
	object3D.updateMatrixWorld(true);
	const positionChunks = [];
	const indexChunks = [];
	let totalVerts = 0;
	let totalIndices = 0;
	const v = new THREE.Vector3();
	const IDENTITY = new THREE.Matrix4();
	object3D.traverse((obj) => {
		if (!obj.isMesh) return;
		const pos = obj.geometry.getAttribute('position');
		if (!pos) return;

		if (obj.matrixWorld.equals(IDENTITY)
			&& pos.itemSize === 3 && pos.array.length === pos.count * 3) {
			positionChunks.push(pos.array instanceof Float32Array
				? pos.array : Float32Array.from(pos.array));
		} else {
			const out = new Float32Array(pos.count * 3);
			for (let i = 0; i < pos.count; i++) {
				v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
				out[i * 3] = v.x;
				out[i * 3 + 1] = v.y;
				out[i * 3 + 2] = v.z;
			}
			positionChunks.push(out);
		}

		const index = obj.geometry.getIndex();
		const chunk = new Uint32Array(index ? index.count : pos.count);
		if (index) {
			for (let i = 0; i < index.count; i++) chunk[i] = index.getX(i) + totalVerts;
		} else {
			for (let i = 0; i < pos.count; i++) chunk[i] = i + totalVerts;
		}
		indexChunks.push(chunk);
		totalVerts += pos.count;
		totalIndices += chunk.length;
	});

	const vertices = new Float32Array(totalVerts * 3);
	let off = 0;
	for (const c of positionChunks) { vertices.set(c, off); off += c.length; }
	const indices = new Uint32Array(totalIndices);
	off = 0;
	for (const c of indexChunks) { indices.set(c, off); off += c.length; }

	const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

	const desc = RAPIER.ColliderDesc.trimesh(
		vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);

	desc.setCollisionGroups(GROUND_GROUPS);
	desc.setFriction(GROUND_FRICTION);
	const collider = world.createCollider(desc, body);
	return { collider, body, triangles: totalIndices / 3 };
}

export const addRoadCollider = addTrimeshCollider;

export class Vehicle {
	constructor(world, scene, scale) {
		this.world = world;
		this.scene = scene;

		const sc = this.scale = (scale && scale > 0) ? scale : CAR_SCALE;
		this.half = { x: BASE_HALF.x * sc, y: BASE_HALF.y * sc, z: BASE_HALF.z * sc };
		this.offsetY = BASE_OFFSET_Y * sc;
		this.wheelbase = BASE_WHEELBASE * sc;
		this.baseWheelR = BASE_WHEEL_R * sc;
		this.wheels = BASE_WHEELS.map((b) => (
			{ x: b.x * sc, y: b.y * sc, z: b.z * sc, steer: b.steer }));

		const m = MASS;
		const w = this.half.x * 2, h = this.half.y * 2, d = this.half.z * 2;
		const inertia = {
			x: (m / 12) * (h * h + d * d),
			y: (m / 12) * (w * w + d * d),
			z: (m / 12) * (w * w + h * h),
		};
		const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setAdditionalMassProperties(
				m, { x: 0, y: BASE_COM_Y * sc, z: 0 }, inertia,
				{ x: 0, y: 0, z: 0, w: 1 })
			.setLinearDamping(0.05)

			.setAngularDamping(0.2 / sc)
			.setCcdEnabled(true)
			.setCanSleep(false);
		this.chassis = world.createRigidBody(bodyDesc);

		const cd = RAPIER.ColliderDesc.cuboid(this.half.x, this.half.y, this.half.z)
			.setTranslation(0, this.offsetY, 0)
			.setMass(0)

			.setFriction(CHASSIS_FRICTION)

			.setCollisionGroups(ALL_GROUPS);
		this.chassisCollider = world.createCollider(cd, this.chassis);

		this.controller = world.createVehicleController(this.chassis);
		for (let i = 0; i < this.wheels.length; i++) {
			const wh = this.wheels[i];
			this.controller.addWheel(
				{ x: wh.x, y: wh.y, z: wh.z }, DOWN, AXLE,
				WHEEL_REST_LENGTH * this.scale, this.baseWheelR);
			this.controller.setWheelSuspensionStiffness(i, SUSP_STIFFNESS);
			this.controller.setWheelFrictionSlip(i, WHEEL_FRICTION);
			this.controller.setWheelMaxSuspensionForce(i, SUSP_MAX_FORCE);
			this.controller.setWheelMaxSuspensionTravel(i, SUSP_TRAVEL);
			this.controller.setWheelSuspensionCompression(i, SUSP_COMPRESSION);
			this.controller.setWheelSuspensionRelaxation(i, SUSP_RELAXATION);
		}

		this.gripMode = { lo: 1.0, hi: 1.0, ref: 15.0 };

		this.antiRollOn = true;

		this.bare = false;

		this.throttleRate = 1e9;
		this._throttle = 0.0;
		this._steer = 0.0;
		this._steerInput = 0.0;
		this._holdYaw = null;
		this._hb = 0.0;

		this.kerbLift = 1.8;
		this.handlingName = HANDLING_DEFAULT;
		this.handling = HANDLING[HANDLING_DEFAULT];
		this.setHandling(HANDLING_DEFAULT);

		this._q = new THREE.Quaternion();
		this._fwd = new THREE.Vector3();
		this._up = new THREE.Vector3();

		this._prevPos = new THREE.Vector3();
		this._prevQuat = new THREE.Quaternion();
		this._currPos = new THREE.Vector3();
		this._currQuat = new THREE.Quaternion();
		this.renderPos = new THREE.Vector3();
		this.renderQuat = new THREE.Quaternion();

		this._prevSusp = new Float64Array(this.wheels.length);
		this._currSusp = new Float64Array(this.wheels.length);
		const t0 = this.chassis.translation();
		const r0 = this.chassis.rotation();
		this._currPos.set(t0.x, t0.y, t0.z);
		this._currQuat.set(r0.x, r0.y, r0.z, r0.w);
		this._prevPos.copy(this._currPos);
		this._prevQuat.copy(this._currQuat);

		this._buildMeshes(scene);
	}

	recordPose() {
		this._prevPos.copy(this._currPos);
		this._prevQuat.copy(this._currQuat);
		const t = this.chassis.translation();
		const r = this.chassis.rotation();
		this._currPos.set(t.x, t.y, t.z);
		this._currQuat.set(r.x, r.y, r.z, r.w);

		for (let i = 0; i < this._currSusp.length; i++) {
			this._prevSusp[i] = this._currSusp[i];
			this._currSusp[i] = this.controller.wheelSuspensionLength(i)
				?? (WHEEL_REST_LENGTH * this.scale);
		}
	}

	_buildMeshes(scene) {
		const bodyGeo = new THREE.BoxGeometry(
			this.half.x * 2, this.half.y * 2, this.half.z * 2);
		bodyGeo.translate(0, this.offsetY, 0);
		this.bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
			color: 0xd94a2e, roughness: 0.5, metalness: 0.0,
		}));
		scene.add(this.bodyMesh);

		const wheelGeo = new THREE.CylinderGeometry(
			this.baseWheelR, this.baseWheelR, 0.25 * this.scale, 16);
		wheelGeo.rotateZ(Math.PI / 2);
		const wheelMat = new THREE.MeshStandardMaterial({
			color: 0x151517, roughness: 0.9, metalness: 0.0,
		});
		const k = (this.wheelRadius || this.baseWheelR) / this.baseWheelR;
		this.wheelMeshes = this.wheels.map(() => {
			const mesh = new THREE.Mesh(wheelGeo, wheelMat);

			mesh.scale.setScalar(k);
			scene.add(mesh);
			return mesh;
		});

		this.carMesh = null;
		import(`./carmesh.js${MODULE_STAMP}`).then(({ createCarMesh }) => {
			if (!this.chassis) return;
			this.carMesh = createCarMesh(scene);
			this.carMesh.fit(this.half, this.wheels, this._restSusp || 0);
		}).catch((err) => {
			console.warn('[vehicle] carmesh.js not loaded — keeping the box car.',
				err && err.message ? err.message : err);
		});
	}

	get speedMs() { return Math.abs(this.controller.currentVehicleSpeed()); }
	get position() { return this.chassis.translation(); }

	teleport(pos, yaw) {
		const half = yaw * 0.5;
		const q = { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
		this.chassis.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
		this.chassis.setRotation(q, true);
		this.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
		this.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
		this._steer = 0.0;
		this._steerInput = 0.0;
		this._hb = 0.0;

		this._holdYaw = null;

		this._currPos.set(pos.x, pos.y, pos.z);
		this._currQuat.set(q.x, q.y, q.z, q.w);
		this._prevPos.copy(this._currPos);
		this._prevQuat.copy(this._currQuat);
		this.renderPos.copy(this._currPos);
		this.renderQuat.copy(this._currQuat);
	}

	setHandling(name) {
		const p = HANDLING[name];
		if (!p) return false;
		this.handlingName = name;
		this.handling = p;
		this._holdYaw = null;

		const s = p.susp;

		const stiff = s.stiff / this.scale;

		const c = 2.0 * Math.sqrt(stiff);

		this.wheelRadius = (p.wheelR || BASE_WHEEL_R) * this.scale;

		if (this.wheelMeshes) {

			const k = this.wheelRadius / this.baseWheelR;
			for (const m of this.wheelMeshes) m.scale.setScalar(k);
		}

		const lift = this.kerbLift || 1.0;
		const restLen = (s.rest || WHEEL_REST_LENGTH) * this.scale * lift;
		this._restSusp = Math.max(0,
			restLen - Math.abs(GRAVITY_Y) / (4 * stiff));

		if (this.carMesh) this.carMesh.fit(this.half, this.wheels, this._restSusp);
		for (let i = 0; i < this.wheels.length; i++) {
			this.controller.setWheelRadius(i, this.wheelRadius);
			this.controller.setWheelSuspensionStiffness(i, stiff);

			this.controller.setWheelMaxSuspensionTravel(i, s.travel * this.scale * lift);

			this.controller.setWheelSuspensionRestLength(i, restLen);
			this.controller.setWheelSuspensionCompression(i, s.compR * c);
			this.controller.setWheelSuspensionRelaxation(i, s.relaxR * c);

			this.controller.setWheelMaxSuspensionForce(
				i, (s.maxForce || SUSP_MAX_FORCE) * lift);
		}
		return true;
	}

	setKerbClimb(k) {
		const v = Number.isFinite(k) ? clamp(k, 1.0, 2.0) : 1.0;
		if (v === this.kerbLift) return false;
		this.kerbLift = v;
		return this.setHandling(this.handlingName);
	}

	gripScaleAt(speed) {
		const m = this.gripMode;
		if (!m) return 1.0;
		if (m.lo === m.hi) return m.lo;
		const t = clamp(Math.abs(speed) / Math.max(m.ref, 1e-6), 0.0, 1.0);
		return m.lo + (m.hi - m.lo) * t;
	}

	get speedMph() { return this.speedMs * MPH; }

	_frame() {
		const r = this.chassis.rotation();
		this._q.set(r.x, r.y, r.z, r.w);
		this._fwd.set(0, 0, -1).applyQuaternion(this._q);
		this._up.set(0, 1, 0).applyQuaternion(this._q);
	}

	_forwardSpeed() {
		const lv = this.chassis.linvel();
		return lv.x * this._fwd.x + lv.y * this._fwd.y + lv.z * this._fwd.z;
	}

	_yawRate() {
		const av = this.chassis.angvel();
		return av.x * this._up.x + av.y * this._up.y + av.z * this._up.z;
	}

	driftInfo() {
		const MPH = 0.44704;
		return {
			slipDeg: (this._slip || 0) * 180 / Math.PI,
			targetDeg: (this._driftTarget || 0) * 180 / Math.PI,
			hb: this._hb,
			yawRate: this._yawRate(),
			mph: Math.hypot(this.chassis.linvel().x, this.chassis.linvel().z) / MPH,
			steer: this._steerInput,
		};
	}

	_heading() {
		return Math.atan2(-this._fwd.x, -this._fwd.z);
	}

	update(dt, input) {
		const p = this.handling;
		const speed = this.speedMs;

		const maxSteer = _steerLock !== null ? _steerLock : p.maxSteer;
		const limit = (maxSteer * (STEER_SCALES_WITH_CAR ? this.scale : 1.0))
			/ (1.0 + speed / p.falloff);

		const analog = typeof input.steer === 'number';
		let want = 0.0;
		if (analog) {
			want = clamp(input.steer, -1.0, 1.0) * STEER_SIGN;
			this._steerInput = want;
		} else {
			if (input.left) want += STEER_SIGN;
			if (input.right) want -= STEER_SIGN;

			const returning = want === 0.0
				|| (this._steerInput !== 0.0 && Math.sign(want) !== Math.sign(this._steerInput));
			this._steerInput = moveToward(
				this._steerInput, want, (returning ? p.fall : p.rise) * dt);
		}

		const u = this._steerInput;
		const cv = _steerCurve !== null ? _steerCurve : p.curve;
		const curved = cv && cv !== 1.0
			? Math.sign(u) * Math.pow(Math.abs(u), cv) : u;
		let steer = curved * limit;

		this._frame();
		const vFwd = this._forwardSpeed();
		const fade = clamp(
			(Math.abs(vFwd) - ASSIST_FADE_LO_MS) / (ASSIST_FADE_HI_MS - ASSIST_FADE_LO_MS),
			0.0, 1.0);

		if (fade > 0.0 && (p.align > 0.0 || p.hold > 0.0)) {
			const yawRate = this._yawRate();

			if (p.align > 0.0) {

				const yawWanted = vFwd * Math.tan(steer) / this.wheelbase;

				const vSafe = Math.abs(vFwd) < 1.0 ? (vFwd < 0 ? -1.0 : 1.0) : vFwd;
				const dEquiv = (yawRate - yawWanted) * this.wheelbase / vSafe;
				steer -= p.align * fade * dEquiv;
			}

			if (p.hold > 0.0) {

				if (Math.abs(want) > 0.02) {
					this._holdYaw = null;
				} else if (this._holdYaw === null) {

					if (Math.abs(yawRate) < HOLD_LATCH_YAW_RATE) this._holdYaw = this._heading();
				} else {

					const err = wrapPi(this._holdYaw - this._heading())
						- (p.holdDamp || 0.0) * yawRate;

					steer += p.hold * fade * err * (vFwd < 0 ? -1.0 : 1.0);
				}
			}
		} else {
			this._holdYaw = null;
		}

		steer = clamp(steer, -limit, limit);

		this._steer = moveToward(this._steer, steer, p.slew * dt);

		let throttle = 0.0;
		const analogT = typeof input.throttle === 'number';
		if (analogT) {
			throttle = clamp(input.throttle, -1.0, 1.0);
		} else {
			if (input.forward) throttle += 1.0;
			if (input.back) throttle -= 1.0;
		}

		if (!analogT && this.throttleRate > 0.0 && this.throttleRate < 1e6) {
			this._throttle = moveToward(
				this._throttle, throttle, this.throttleRate * dt);
			throttle = this._throttle;
		} else {
			this._throttle = throttle;
		}

		const boost = input.boost ? (p.boost || 1.6) : 1.0;
		if (p.topMph) {

			const lift = Number.isFinite(input.topLift)
				? clamp(input.topLift, 1.0, 2.0) : 1.0;
			const topMs = p.topMph * lift
				* (input.boost ? (p.boostTop || 1.5) : 1.0) / MPH;

			const t = clamp((speed / topMs - 0.85) / 0.15, 0.0, 1.0);
			if (throttle > 0.0) throttle *= 1.0 - t;
		}

		const force = throttle * MAX_ENGINE_FORCE * _power * boost * DRIVE_SIGN;

		const brakeVal = (typeof input.brake === 'number'
			? clamp(input.brake, 0.0, 1.0) : (input.brake ? 1.0 : 0.0)) * MAX_BRAKE;

		this._brakeOn = brakeVal > 0.0 || this._hb > 0.05;

		if (p.down > 0.0 && !this.bare) {
			const n = p.down * MASS * 9.81 * (speed * speed) / 400.0;
			this.chassis.applyImpulse({ x: 0, y: -n * dt, z: 0 }, true);
		}

		if (p.antiRoll > 0.0 && this.antiRollOn && !this.bare) {

			const cx = -this._up.z, cz = this._up.x;
			const roll = cx * this._fwd.x + cz * this._fwd.z;
			const av = this.chassis.angvel();
			const rollRate = av.x * this._fwd.x + av.y * this._fwd.y + av.z * this._fwd.z;

			const g = p.antiRoll * this.scale;
			const k = (g * roll - g * ANTI_ROLL_DAMP * rollRate) * MASS * dt;
			this.chassis.applyTorqueImpulse(
				{ x: this._fwd.x * k, y: this._fwd.y * k, z: this._fwd.z * k }, true);
		}

		if (p.upright > 0.0 && !this.bare) {

			const tilt = Math.acos(clamp(this._up.y, -1.0, 1.0));
			if (tilt > UPRIGHT_FROM) {

				const ax = -this._up.z, az = this._up.x;
				const len = Math.hypot(ax, az);
				if (len > 1e-6) {
					const k = p.upright * MASS * this.scale
						* (tilt - UPRIGHT_FROM) * dt / len;
					this.chassis.applyTorqueImpulse(
						{ x: ax * k, y: 0, z: az * k }, true);
				}
			}
		}

		const hbWant = typeof input.handbrake === 'number'
			? clamp(input.handbrake, 0.0, 1.0) : (input.handbrake ? 1.0 : 0.0);
		this._hb = moveToward(
			this._hb, hbWant, (hbWant > this._hb ? HB_ON : HB_OFF) * dt);
		const hb = this._hb;

		{
			const lv = this.chassis.linvel();
			const vf = lv.x * this._fwd.x + lv.z * this._fwd.z;
			const vr = lv.x * -this._fwd.z + lv.z * this._fwd.x;
			const planar = Math.hypot(vf, vr);

			this._slip = planar > 0.5 ? Math.atan2(vr, vf) : 0.0;
		}

		if (p.drift > 0.0 && hb > 0.0 && !this.bare && this._forwardSpeed() > 0.0) {
			const vd = Math.abs(this._forwardSpeed());
			const fade = clamp((vd - DRIFT_FROM_MS) / (DRIFT_FULL_MS - DRIFT_FROM_MS), 0, 1);
			if (fade > 0.0) {

				let amt;
				if (_driftMode === 'torque') {
					amt = this._steerInput;
				} else {

					const beta = this._slip;

					this._driftTarget = this._steerInput * DRIFT_ANGLE_MAX;
					const target = this._driftTarget;
					const err = clamp((target - beta) / DRIFT_ANGLE_MAX, -1, 1);

					const damp = DRIFT_YAW_DAMP
						* clamp(this._yawRate() / DRIFT_YAW_REF, -1, 1);
					amt = clamp(err - damp, -1, 1);
				}
				const k = p.drift * _driftGain * hb * fade * amt * MASS * this.scale * dt;
				this.chassis.applyTorqueImpulse(
					{ x: this._up.x * k, y: this._up.y * k, z: this._up.z * k }, true);
			}
		}

		if (p.magnet > 0.0 && !this.bare) {
			let grounded = 0;
			for (let i = 0; i < this.wheels.length; i++) {
				if (this.controller.wheelIsInContact(i)) grounded++;
			}

			const air = clamp((3.0 - grounded) / 3.0, 0.0, 1.0);
			if (air > 0.0) {
				this.chassis.applyImpulse(
					{ x: 0, y: -p.magnet * air * MASS * 9.81 * dt, z: 0 }, true);
				const lv = this.chassis.linvel();

				if (lv.y > 0.0) {
					const d = p.airDamp === undefined ? 0.85 : p.airDamp;
					this.chassis.setLinvel(
						{ x: lv.x, y: lv.y * (1.0 - air * (1.0 - d)), z: lv.z }, true);
				}
			}
		}

		const gs = this.gripScaleAt(speed);
		const gripF = (p.gripF || WHEEL_FRICTION) * gs;
		const gripR = (p.gripR || WHEEL_FRICTION) * gs;

		const hbSlip = _hbSlip !== null ? _hbSlip
			: (p.hbSlip === undefined ? 0.4 : p.hbSlip);

		for (let i = 0; i < this.wheels.length; i++) {
			const front = this.wheels[i].steer;

			this.controller.setWheelFrictionSlip(
				i, front ? gripF : gripR * (1.0 - hb * (1.0 - hbSlip)));

			this.controller.setWheelEngineForce(i, force);
			this.controller.setWheelBrake(
				i, front ? brakeVal : Math.max(brakeVal, hb * HANDBRAKE));
			if (front) this.controller.setWheelSteering(i, this._steer);
		}

		this.controller.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
	}

	syncMeshes(alpha) {
		this.renderPos.copy(this._prevPos).lerp(this._currPos, alpha);
		this.renderQuat.copy(this._prevQuat).slerp(this._currQuat, alpha);
		const p = this.renderPos;
		const q = this.renderQuat;

		this.bodyMesh.position.copy(p);
		this.bodyMesh.quaternion.copy(q);

		for (let i = 0; i < this.wheels.length; i++) {
			const wh = this.wheels[i];

			const susp = this._prevSusp[i]
				+ (this._currSusp[i] - this._prevSusp[i]) * alpha;
			const local = new THREE.Vector3(wh.x, wh.y - susp, wh.z).applyQuaternion(q);
			this.wheelMeshes[i].position.copy(p).add(local);

			const steerQ = wh.steer
				? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._steer)
				: new THREE.Quaternion();
			this.wheelMeshes[i].quaternion.copy(q).multiply(steerQ);
		}

		if (this.carMesh && this.carMesh.isLoaded) {

			if (this.bodyMesh && this.bodyMesh.visible) this._hideStandIn();

			if (!this._suspLerp) this._suspLerp = new Float64Array(this.wheels.length);
			for (let i = 0; i < this._suspLerp.length; i++) {
				this._suspLerp[i] = this._prevSusp[i]
					+ (this._currSusp[i] - this._prevSusp[i]) * alpha;
			}

			const now = (typeof performance !== 'undefined') ? performance.now() : 0;
			const dt = this._lastDrawT ? Math.min(0.1, (now - this._lastDrawT) / 1000) : 1 / 60;
			this._lastDrawT = now;
			const fwd = this._forwardSpeed();
			this.carMesh.sync(p, q, this._suspLerp, this._steer, fwd, dt);

			this.carMesh.setLights({
				head: _lensOverride === null ? HEADLIGHTS : _lensOverride,
				fog: _lensOverride === null ? FOGLIGHTS : _lensOverride,
				brake: !!this._brakeOn || BRAKELIGHTS_HELD, forwardSpeed: fwd,
			}, dt);
		}
	}

	dispose() {
		if (this.bodyMesh) {
			this.bodyMesh.geometry.dispose();
			this.bodyMesh.material.dispose();
			if (this.scene) this.scene.remove(this.bodyMesh);
			this.bodyMesh = null;
		}

		if (this.wheelMeshes && this.wheelMeshes.length) {
			this.wheelMeshes[0].geometry.dispose();
			this.wheelMeshes[0].material.dispose();
			for (const m of this.wheelMeshes) {
				if (this.scene) this.scene.remove(m);
			}
		}
		this.wheelMeshes = [];

		if (this.carMesh) { this.carMesh.dispose(); this.carMesh = null; }
		if (this.controller) this.world.removeVehicleController(this.controller);

		if (this.chassis) this.world.removeRigidBody(this.chassis);
		this.controller = null;
		this.chassis = null;
	}

	_hideStandIn() {
		this._standInRetired = true;
		if (this.bodyMesh) this.bodyMesh.visible = false;
		for (const w of (this.wheelMeshes || [])) w.visible = false;
	}

	setVisible(v) {

		const box = v && !this._standInRetired;
		if (this.bodyMesh) this.bodyMesh.visible = box;
		for (const w of (this.wheelMeshes || [])) w.visible = box;
		if (this.carMesh) this.carMesh.group.visible = v && this.carMesh.isLoaded;
	}
}

export const FIXED_DT = 1 / 120;

export const GRIP_MODES = [
	{ label: 'full', lo: 1.0, hi: 1.0, ref: 15.0 },
	{ label: 'flat .35', lo: 0.35, hi: 0.35, ref: 15.0 },
	{ label: 'rising', lo: 0.35, hi: 1.0, ref: 15.0 },
	{ label: 'falling', lo: 1.0, hi: 0.35, ref: 15.0 },
];

export const THROTTLE_RATES = [
	{ label: 'instant', rate: 1e9 },
	{ label: '0.15 s', rate: 6.7 },
	{ label: '0.30 s', rate: 3.3 },
	{ label: '0.60 s', rate: 1.7 },
];

export const SOLVER_STEPS = [4, 8, 16, 32];

export const DRIVEN_DEFAULTS = {
	handling: HANDLING_DEFAULT,
	gripStep: 1,
	throttleStep: 0,
	solverStep: 0,
	antiRoll: true,

	chassisHitsGround: true,
};

export const GRAVITY_Y = -9.81;

export function createPhysicsWorld(RAPIER, gravityY = GRAVITY_Y) {
	const world = new RAPIER.World({ x: 0, y: gravityY, z: 0 });
	world.timestep = FIXED_DT;
	return world;
}

function scaleFromUrl(dflt) {
	if (typeof location === 'undefined') return dflt;
	const v = Number(new URLSearchParams(location.search).get('carscale'));
	return (Number.isFinite(v) && v > 0.05 && v <= 4) ? v : dflt;
}

export function createVehicle(world, scene, opts = {}) {
	const o = { ...DRIVEN_DEFAULTS, ...opts };
	const v = new Vehicle(world, scene, scaleFromUrl(o.scale));
	v.setHandling(o.handling);
	v.gripMode = GRIP_MODES[o.gripStep];
	v.throttleRate = THROTTLE_RATES[o.throttleStep].rate;
	v.antiRollOn = o.antiRoll;
	if (v.chassisCollider) {
		v.chassisCollider.setCollisionGroups(
			o.chassisHitsGround ? ALL_GROUPS : CHASSIS_GROUPS);
	}
	if ('numSolverIterations' in world) {
		world.numSolverIterations = SOLVER_STEPS[o.solverStep];
	}
	return v;
}

export function parityLine(vehicle, world) {
	if (!vehicle) return 'no car';

	const groups = vehicle.chassisCollider
		? vehicle.chassisCollider.collisionGroups() >>> 0 : 0;
	return [
		`scale ${vehicle.scale.toFixed(3)}`,
		`preset ${vehicle.handlingName}`,
		`dt 1/${Math.round(1 / FIXED_DT)}`,
		`world.dt 1/${Math.round(1 / world.timestep)}`,
		`grip ${vehicle.gripMode ? vehicle.gripMode.label : '—'}`,
		`chassis ${groups === (ALL_GROUPS >>> 0) ? 'in' : 'out'}`,
		`g ${world.gravity.y.toFixed(2)}`,
	].join('  ');
}
