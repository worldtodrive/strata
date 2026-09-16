

import * as THREE from 'three';
import { isLand } from './strata-globe.js?v=8bc150354e';

import { createTouchControls } from './touch.js?v=8bc150354e';

const STEP = 1 / 120;
const MAX_STEPS = 12;

const CRUISE_SPEED = 0.35;
const BOOST_SPEED = 0.9;
const MAX_SPEED = BOOST_SPEED;
const ACCEL = 0.3;
const BOOST_ACCEL = 0.9;

const OVER_DRAG = 0.6;
const BRAKE = 2.4;

const REVERSE_MAX = 0.22;
const REVERSE_ACCEL = 0.5;
const REVERSE_DELAY = 0.25;

const SHOW_DECK = false;
const COAST = 0.25;
const GRIP = 12;
const STEER_MAX = 3.0;
const STEER_FULL_AT = 0.25;
const STEER_HIGH_SPEED_CUT = 0.45;

const WATER_MAX = MAX_SPEED;
const WATER_DRAG = 2.5;
const WATER_STEPS = 6;
const G = 2.5;

const SLOPE_PULL = 0.25;

const UP_REACH = 0.05;
const DOWN_REACH = 0.06;
const LEAVE_TIME = 0.06;
const REACQUIRE_AFTER = 0.15;
const FALL_BLEND = 0.5;
const PLANET_SNAP = 0.012;
const ALIGN_ROAD = 30;
const ALIGN_PLANET = 18;
const ALIGN_AIR = 3;

const DECK_W = 0.18;
const DECK_H = 0.14;
const DECK_SPAN = 2.0;
const DECK_SEGS = 200;
const DECK_SLAB = 0.02;
const DECK_AHEAD = 0.5;

const CAM_BACK = 0.40;
const CAM_UP = 0.12;
const CAM_LOOK_AHEAD = 0.10;
const CAM_LOOK_UP = 0.035;

const CAM_PRESETS = {
	low: { up: CAM_UP, lookAhead: CAM_LOOK_AHEAD, lookUp: CAM_LOOK_UP },
	high: { up: 0.26, lookAhead: 0.16, lookUp: -0.02 },
};
const CAM_FOV = 58;
const CAM_FALL_LOOK = 0.35;

const LAND_EASE = 0.8;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;

const ZOOM_START = 0.6;

const ORBIT_DRAG = 0.006;
const ORBIT_STICK = Math.PI * 0.6;

const ORBIT_HOLD = 10.0;

const ORBIT_FREE_RATE = 2.2;
const ORBIT_RECENTRE = 2.5;

const EARTH_BIAS = 0.3;

const CAMERA_CYCLE = ['high', 'tilted', 'low'];
const CAM_NEAR = 0.004;

const FLY_START = 1.8;
const FLY_HOME = 1.2;
const FLY_RESET = 0.7;

const TOUCH_EAGER = false;

const SPAWN_LANE = 0.155;
const SPAWN_DIR = 1;

const AUTOPILOT_AHEAD = 0.18;

const V = () => new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const smooth = (a, b, x) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
const deg = (r) => (r * 180) / Math.PI;
const wrapAngle = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

export function createDriver(ctx) {
	const { scene, camera, stage, uiRoot, ring, spin, earth, R_IN, R_OUT, R_THICK, R_SEGS, LIGHT_DIR } = ctx;
	const ROAD_W = R_OUT - R_IN;
	const MID_R = (R_IN + R_OUT) / 2;
	const CAR_W = ctx.CAR_LENGTH * (1.02 / 2.24);

	const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
	const ringCollide = new THREE.Mesh(orientUp(annulus(R_IN, R_OUT, R_THICK / 2, R_SEGS)), hiddenMat);
	ringCollide.userData.surface = 'ring';
	spin.add(ringCollide);
	let deck = null;
	const roadSurfaces = [ringCollide];

	const ray = new THREE.Raycaster();
	const tmpN = V();

	function roadHits(origin, dir, far) {
		ray.set(origin, dir);
		ray.near = 0;
		ray.far = far;
		const out = [];
		for (const h of ray.intersectObjects(roadSurfaces, false)) {
			const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
			out.push({ point: h.point, n, d: h.distance, id: h.object.userData.surface });
		}
		return out;
	}

	function nearestRoad(p, up) {
		if (!ring.visible) return null;
		const origin = p.clone().addScaledVector(up, UP_REACH);
		const down = up.clone().negate();
		let best = null;
		for (const h of roadHits(origin, down, UP_REACH + DOWN_REACH)) {
			if (h.n.dot(up) < 0.5) continue;
			const gap = h.d - UP_REACH;
			if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { ...h, gap };
		}
		return best;
	}

	function stackAt(p, up) {
		if (!ring.visible) return 0;
		const origin = p.clone().addScaledVector(up, 0.4);
		return roadHits(origin, up.clone().negate(), 0.8).length;
	}

	let bins = null;
	function globeBins() {
		const g = ctx.getGlobe();
		if (!g) return null;
		if (!bins) bins = buildBins(g.mesh.geometry);
		return bins;
	}
	const L = V(), Ldir = V();
	function globeHit(pWorld) {
		earth.updateMatrixWorld(true);
		L.copy(pWorld);
		earth.worldToLocal(L);
		const rNow = L.length();
		Ldir.copy(L).divideScalar(rNow || 1);
		const b = globeBins();
		const hit = b ? rayGlobe(b, Ldir) : { r: 1, n: Ldir.clone() };
		const mask = ctx.getMask();
		const land = mask ? isLand(mask, Ldir.x, Ldir.y, Ldir.z) : true;
		const point = Ldir.clone().multiplyScalar(hit.r);
		earth.localToWorld(point);
		const n = hit.n.clone().transformDirection(earth.matrixWorld);
		return { point, n, gap: rNow - hit.r, land, r: hit.r };
	}
	const planetCentre = () => earth.getWorldPosition(V());

	function buildDeck(aStart, dirSign) {
		const top = R_THICK / 2;
		const rOut = R_OUT + DECK_W / 2;
		const rIn = R_IN - DECK_W / 2;
		const C = [];
		for (let i = 0; i <= DECK_SEGS; i++) {
			const s = i / DECK_SEGS;
			const a = aStart + dirSign * s * DECK_SPAN;
			const inward = smooth(0.32, 0.45, s) - smooth(0.55, 0.68, s);
			const r = rOut + (rIn - rOut) * inward;

			const h = DECK_H * (smooth(0.15, 0.32, s) - smooth(0.68, 0.85, s));
			C.push(new THREE.Vector3(Math.cos(a) * r, top + h, Math.sin(a) * r));
		}
		const topPos = [], topUv = [], slabPos = [];
		let along = 0;
		const uvLen = 2 * Math.PI * MID_R;
		const edges = [];
		for (let i = 0; i <= DECK_SEGS; i++) {
			const T = C[Math.min(DECK_SEGS, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize();
			const side = T.clone().cross(Y).normalize().multiplyScalar(DECK_W / 2);
			if (i > 0) along += C[i].distanceTo(C[i - 1]);
			const l = C[i].clone().add(side), r = C[i].clone().sub(side);
			edges.push([l, r]);
			topPos.push(l.x, l.y, l.z, r.x, r.y, r.z);
			topUv.push(along / uvLen, 0, along / uvLen, 1);
		}
		const topIdx = [];
		for (let i = 0; i < DECK_SEGS; i++) {
			const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
			topIdx.push(a, b, c, b, d, c);
		}
		const topGeo = new THREE.BufferGeometry();
		topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
		topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
		topGeo.setIndex(topIdx);
		orientUp(topGeo);
		topGeo.computeVertexNormals();

		for (let i = 0; i < DECK_SEGS; i++) {
			const [l0, r0] = edges[i], [l1, r1] = edges[i + 1];
			const dl0 = l0.clone().addScaledVector(Y, -DECK_SLAB), dl1 = l1.clone().addScaledVector(Y, -DECK_SLAB);
			const dr0 = r0.clone().addScaledVector(Y, -DECK_SLAB), dr1 = r1.clone().addScaledVector(Y, -DECK_SLAB);
			for (const q of [[l0, l1, dl1, dl0], [r0, dr0, dr1, r1], [dl0, dl1, dr1, dr0]]) {
				slabPos.push(...q[0].toArray(), ...q[1].toArray(), ...q[2].toArray());
				slabPos.push(...q[0].toArray(), ...q[2].toArray(), ...q[3].toArray());
			}
		}
		const slabGeo = new THREE.BufferGeometry();
		slabGeo.setAttribute('position', new THREE.Float32BufferAttribute(slabPos, 3));
		slabGeo.computeVertexNormals();

		const group = new THREE.Group();
		const drawnTop = new THREE.Mesh(topGeo, ctx.roadMat);
		const slab = new THREE.Mesh(slabGeo, new THREE.MeshLambertMaterial({ color: 0x2c2f35, side: THREE.DoubleSide }));
		const collide = new THREE.Mesh(topGeo, hiddenMat);
		collide.userData.surface = 'deck';
		group.add(drawnTop, slab, collide);
		return { group, collide, slabMat: slab.material, centre: C, angles: { start: aStart, end: aStart + dirSign * DECK_SPAN } };
	}

	function setDeck(aStart, dirSign) {
		if (deck) removeDeck();
		deck = buildDeck(aStart, dirSign);
		spin.add(deck.group);
		roadSurfaces.push(deck.collide);
	}
	function removeDeck() {
		if (!deck) return;
		spin.remove(deck.group);
		roadSurfaces.splice(roadSurfaces.indexOf(deck.collide), 1);
		deck.group.children[0].geometry.dispose();
		deck.group.children[1].geometry.dispose();
		deck.slabMat.dispose();
		deck = null;
	}

	const spare = ctx.makeCar(0xff4fa0);
	let carMesh = spare.group;
	let tailMat = spare.tail;
	let caught = null;

	let autopilot = null;
	const TAIL = new THREE.Color(0.34, 0.02, 0.01);
	const BRAKE_LAMP = new THREE.Color(1.0, 0.07, 0.03);

	const car = {
		p: V(), v: V(), q: new THREE.Quaternion(),
		pPrev: V(), qPrev: new THREE.Quaternion(),
		mode: 'road', source: 'road', surface: 'ring',
		carrier: null, carrierQ: new THREE.Quaternion(),
		offRoad: 0, airTime: 0, lastDown: V(), steer: 0, grounded: true, braking: false,
		land: true, gravity: V(), normal: V(), faceNormal: V(), gap: 0,
	};
	const upOf = (q, out = V()) => out.copy(Y).applyQuaternion(q);
	const fwdOf = (q, out = V()) => out.copy(Z).applyQuaternion(q);
	const sideOf = (q, out = V()) => out.copy(X).applyQuaternion(q);

	function setCarrier(body) {
		car.carrier = body;
		if (body) {
			body.updateMatrixWorld(true);
			body.getWorldQuaternion(car.carrierQ);
		}
	}
	const cq = new THREE.Quaternion(), dq = new THREE.Quaternion();
	function carry() {
		if (!car.carrier) return;
		car.carrier.updateMatrixWorld(true);
		car.carrier.getWorldQuaternion(cq);
		dq.copy(car.carrierQ).invert().premultiply(cq);
		if (Math.abs(dq.w) < 1 - 1e-12) {

			for (const vec of [car.p, car.v, car.pPrev]) vec.applyQuaternion(dq);
			car.q.premultiply(dq);
			car.qPrev.premultiply(dq);
		}
		car.carrierQ.copy(cq);
	}

	function basisQuat(up, fwd, out = new THREE.Quaternion()) {
		const f = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize();
		const x = up.clone().cross(f).normalize();
		const m = new THREE.Matrix4().makeBasis(x, up, f);
		return out.setFromRotationMatrix(m);
	}

	function ringFrame(angle, laneFrac, dirSign) {
		spin.updateMatrixWorld(true);
		const r = R_IN + ROAD_W * laneFrac;
		const p = new THREE.Vector3(Math.cos(angle) * r, R_THICK / 2, Math.sin(angle) * r);
		const f = dirSign < 0
			? new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle))
			: new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
		spin.localToWorld(p);
		f.transformDirection(spin.matrixWorld);
		const up = Y.clone().transformDirection(spin.matrixWorld);
		return { p, f, up };
	}

	function placeOnRing(angle, laneFrac = SPAWN_LANE, dirSign = SPAWN_DIR) {
		autopilot = null;
		const { p, f, up } = ringFrame(angle, laneFrac, dirSign);
		car.p.copy(p);
		car.v.set(0, 0, 0);
		basisQuat(up, f, car.q);
		car.pPrev.copy(car.p);
		car.qPrev.copy(car.q);
		car.mode = 'road'; car.source = 'road'; car.surface = 'ring';
		car.offRoad = 0; car.airTime = 0; car.grounded = true; car.steer = 0;
		car.gravity.copy(up).negate();
		car.normal.copy(up);
		car.faceNormal.copy(up);
		setCarrier(spin);
	}

	function alignUp(target, rate, dt) {
		const u = upOf(car.q);
		const k = 1 - Math.exp(-rate * dt);
		const t = u.clone().lerp(target, k);
		if (t.lengthSq() < 1e-10) return;
		t.normalize();
		dq.setFromUnitVectors(u, t);
		car.q.premultiply(dq).normalize();
		car.v.applyQuaternion(dq);
	}

	function applyDrive(inp, dt, surfaceCap) {
		const up = upOf(car.q), f = fwdOf(car.q), s = sideOf(car.q);
		let vf = car.v.dot(f), vs = car.v.dot(s);
		const vn = car.v.dot(up);
		const thr = inp.throttle || 0, brk = inp.brake || 0;
		const boost = !!inp.boost;
		const cap = Math.min(surfaceCap, boost ? BOOST_SPEED : CRUISE_SPEED);
		car.braking = false;
		if (thr > 0) {

			if (vf < 0) vf += BRAKE * thr * dt;
			if (vf >= 0 && vf < cap) vf = Math.min(cap, vf + (boost ? BOOST_ACCEL : ACCEL) * thr * dt);
		}
		if (brk > 0 && thr === 0) {
			if (vf > 0.005) {
				vf = Math.max(0, vf - BRAKE * brk * dt);
				car.braking = true;
				car.stopHeld = 0;
			} else {

				car.stopHeld = (car.stopHeld || 0) + dt;
				if (vf < -0.005 || car.stopHeld > REVERSE_DELAY) {
					vf = Math.max(-REVERSE_MAX, vf - REVERSE_ACCEL * brk * dt);
				} else {
					vf = 0;
					car.braking = true;
				}
			}
		} else {
			car.stopHeld = 0;
		}
		if (thr === 0 && brk === 0) vf -= vf * COAST * dt;
		if (vf > cap) vf = Math.max(cap, vf - (surfaceCap < CRUISE_SPEED ? WATER_DRAG : OVER_DRAG) * dt);
		if (!thr && !brk && Math.abs(vf) < 0.003) vf = 0;
		vs *= Math.exp(-GRIP * dt);

		car.steer += ((inp.steer || 0) - car.steer) * Math.min(1, dt * 8);
		const a = Math.abs(vf);
		const yaw = -car.steer * STEER_MAX * Math.min(1, a / STEER_FULL_AT)
			* (1 - STEER_HIGH_SPEED_CUT * Math.min(1, a / MAX_SPEED)) * Math.sign(vf);
		if (yaw) {
			dq.setFromAxisAngle(up, yaw * dt);
			car.q.premultiply(dq).normalize();
		}
		fwdOf(car.q, f); sideOf(car.q, s);
		car.v.copy(f).multiplyScalar(vf).addScaledVector(s, vs).addScaledVector(up, vn);
	}

	function corners() {
		const hl = ctx.CAR_LENGTH * 0.4, hw = CAR_W * 0.4;
		return [[hw, hl], [-hw, hl], [hw, -hl], [-hw, -hl]]
			.map(([x, z]) => new THREE.Vector3(x, 0, z).applyQuaternion(car.q).add(car.p));
	}
	function planeNormal(pts, up) {
		if (pts.some((x) => !x)) return null;
		const [fl, fr, rl, rr] = pts;
		const n = fl.clone().sub(rr).cross(fr.clone().sub(rl));
		if (n.lengthSq() < 1e-14) return null;
		n.normalize();
		if (n.dot(up) < 0) n.negate();
		return n;
	}

	let lastLanding = null;
	let respawns = 0;

	function stepRoad(inp, dt) {
		applyDrive(inp, dt, MAX_SPEED);
		car.p.addScaledVector(car.v, dt);
		const up = upOf(car.q);
		const hit = nearestRoad(car.p, up);
		if (hit) {
			car.offRoad = 0;
			const n = planeNormal(corners().map((c) => { const h = nearestRoad(c, up); return h && h.point; }), up) || hit.n;
			car.gap = hit.gap;
			car.p.addScaledVector(hit.n, -car.p.clone().sub(hit.point).dot(hit.n));
			car.v.addScaledVector(hit.n, -car.v.dot(hit.n));
			alignUp(n, ALIGN_ROAD, dt);
			car.surface = hit.id;
			car.source = 'road';
			car.grounded = true;
			car.normal.copy(n);
			car.faceNormal.copy(hit.n);
			car.gravity.copy(n).negate();
		} else {
			car.offRoad += dt;
			car.gap = NaN;
			car.v.addScaledVector(up, -G * dt);
			car.gravity.copy(up).negate();
			if (car.offRoad > LEAVE_TIME) {
				car.mode = 'air';
				car.source = 'point';
				car.surface = 'falling';
				car.airTime = 0;
				car.grounded = false;
				car.lastDown.copy(up).negate();
				setCarrier(null);
				earthHidden(false);
			}
		}
	}

	function stepPoint(inp, dt) {
		const centre = planetCentre();
		const out = car.p.clone().sub(centre).normalize();
		const radialDown = out.clone().negate();
		car.airTime += dt;
		const g = car.mode === 'air'
			? car.lastDown.clone().lerp(radialDown, smooth(0, FALL_BLEND, car.airTime)).normalize()
			: radialDown;
		if (g.lengthSq() < 0.5) g.copy(radialDown);
		car.gravity.copy(g);
		car.source = 'point';

		if (car.grounded) applyDrive(inp, dt, car.land ? MAX_SPEED : WATER_MAX);
		else {

			car.steer += ((inp.steer || 0) - car.steer) * Math.min(1, dt * 8);
		}

		if (car.grounded) {
			const n = car.normal;
			const along = g.clone().addScaledVector(n, -g.dot(n));
			car.v.addScaledVector(g.clone().projectOnVector(n), G * dt);
			car.v.addScaledVector(along, G * SLOPE_PULL * dt);
		} else {
			car.v.addScaledVector(g, G * dt);
		}

		const pNext = car.p.clone().addScaledVector(car.v, dt);

		if (car.mode === 'air' && car.airTime > REACQUIRE_AFTER && ring.visible) {
			const len = car.v.length() * dt;
			if (len > 0) {
				const dir = car.v.clone().normalize();
				const hits = roadHits(car.p, dir, len + 0.002).filter((h) => h.n.dot(dir) < -0.2);
				if (hits.length) {
					const h = hits[0];
					lastLanding = { on: h.id, penetration: 0, airTime: car.airTime, speed: car.v.length() };
					car.p.copy(h.point);
					car.v.addScaledVector(h.n, -car.v.dot(h.n));
					car.mode = 'road'; car.source = 'road'; car.surface = h.id; car.grounded = true;
					car.offRoad = 0; car.normal.copy(h.n); car.faceNormal.copy(h.n);
					car.gravity.copy(h.n).negate();
					setCarrier(spin);
					return;
				}
			}
		}

		const gh = globeHit(pNext);
		car.waterSteps = gh.land ? 0 : (car.waterSteps || 0) + 1;
		car.land = gh.land || car.waterSteps < WATER_STEPS;
		gh.land = car.land;
		const outNext = pNext.clone().sub(centre).normalize();
		if (gh.gap <= 0 || (car.grounded && gh.gap <= PLANET_SNAP && car.v.dot(outNext) < 0.25)) {
			if (!car.grounded) {
				lastLanding = { on: gh.land ? 'land' : 'water', penetration: -gh.gap, airTime: car.airTime, speed: car.v.length() };
				earthHidden(false);
				car.sinceLand = 0;
			}
			car.gap = gh.gap;
			pNext.addScaledVector(outNext, -gh.gap);
			car.p.copy(pNext);
			const n = planeNormal(corners().map((c) => globeHit(c).point), outNext) || gh.n;
			if (car.v.dot(n) < 0 || car.grounded) car.v.addScaledVector(n, -car.v.dot(n));
			car.mode = 'planet';
			car.grounded = true;
			car.normal.copy(n);
			car.faceNormal.copy(gh.n);
			car.surface = gh.land ? 'land' : 'water';
			if (car.carrier !== earth) setCarrier(earth);
			alignUp(n, ALIGN_AIR + (ALIGN_PLANET - ALIGN_AIR) * smooth(0, LAND_EASE * 0.6, car.sinceLand), dt);
		} else {
			car.gap = gh.gap;
			car.p.copy(pNext);
			if (car.mode === 'planet' && car.grounded) {
				car.grounded = false;
			}
			if (car.mode !== 'air') car.surface = 'airborne';
			alignUp(g.clone().negate(), ALIGN_AIR, dt);
		}
	}

	const touched = (inp) => !!(inp.throttle || inp.brake || inp.steer || inp.boost);
	function autopilotInput() {
		spin.updateMatrixWorld(true);
		const l = spin.worldToLocal(car.p.clone());
		const a = Math.atan2(l.z, l.x) + autopilot.dir * AUTOPILOT_AHEAD;

		const aimR = autopilot.r + 2 * (autopilot.r - Math.hypot(l.x, l.z));
		const target = spin.localToWorld(new THREE.Vector3(Math.cos(a) * aimR, R_THICK / 2, Math.sin(a) * aimR));
		const up = upOf(car.q), f = fwdOf(car.q);
		const t = target.sub(car.p);
		t.addScaledVector(up, -t.dot(up)).normalize();
		const ang = Math.atan2(f.clone().cross(t).dot(up), f.dot(t));
		const vf = car.v.dot(f);
		return { throttle: vf < autopilot.speed ? 0.6 : 0, steer: Math.max(-1, Math.min(1, -ang * 2.5)) };
	}

	function step(inp, dt = STEP) {
		if (autopilot) {
			if (touched(inp) || car.mode !== 'road') autopilot = null;
			else inp = autopilotInput();
		}
		carry();
		car.sinceLand = (car.sinceLand ?? 9) + dt;
		car.pPrev.copy(car.p);
		car.qPrev.copy(car.q);
		if (car.mode === 'road') stepRoad(inp, dt);
		else stepPoint(inp, dt);

		if (car.p.length() > 8 || car.p.clone().sub(planetCentre()).length() < 0.5) {
			respawns++;
			resetToRing();
		}
	}

	function resetToRing() {
		spin.updateMatrixWorld(true);
		const local = spin.worldToLocal(car.p.clone());
		const angle = Math.atan2(local.z, local.x);
		ringHidden(false);
		placeOnRing(angle);
	}

	const keys = new Set();
	const onKeyDown = (e) => {
		if (!api.active) return;
		const k = e.code;
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(k)) e.preventDefault();
		if (e.repeat) return;
		keys.add(k);
		if (k === 'KeyR') doReset();
		if (k === 'KeyH') ringHidden(!ringIsHidden);
		if (k === 'KeyG') earthHidden(!earthIsHidden);
		if (k === 'KeyC') toggleCamera();
		if (k === 'KeyT') setTouch(!touchOn);
		if (k === 'KeyK') toggleFreeCamera();
	};
	function toggleFreeCamera() {
		cam.free = !cam.free;
		if (!cam.free) cam.dragSince = 0;
	}
	function toggleCamera() {
		cam.preset = CAMERA_CYCLE[(CAMERA_CYCLE.indexOf(cam.preset) + 1) % CAMERA_CYCLE.length];
	}
	const onKeyUp = (e) => keys.delete(e.code);
	const onBlur = () => keys.clear();
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', onBlur);

	const onWheel = (e) => {
		if (!api.active) return;
		cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom * Math.exp(e.deltaY * 0.0012)));
	};

	let dragX = null;
	const onDragDown = (e) => {
		if (!api.active || e.button !== 0) return;

		if (dragX !== null) { onDragUp(); return; }
		dragX = e.clientX;
		cam.dragHeld = true;
		stage.setPointerCapture(e.pointerId);
		stage.style.cursor = 'grabbing';
	};
	const onDragMove = (e) => {
		if (dragX === null) return;
		cam.dragOrbit = wrapAngle(cam.dragOrbit - (e.clientX - dragX) * ORBIT_DRAG);
		dragX = e.clientX;
	};
	const onDragUp = () => {
		if (dragX === null) return;
		dragX = null;
		cam.dragHeld = false;
		cam.dragSince = 0;
		stage.style.cursor = '';
	};
	stage.addEventListener('pointerdown', onDragDown);
	window.addEventListener('pointermove', onDragMove);
	window.addEventListener('pointerup', onDragUp);
	window.addEventListener('pointercancel', onDragUp);
	window.addEventListener('wheel', onWheel, { passive: true });

	const padWas = {};
	let padZoom = 0;
	let padLook = 0;
	function readInput() {
		padLook = 0;
		const k = (...c) => (c.some((x) => keys.has(x)) ? 1 : 0);
		const inp = {
			throttle: k('KeyW', 'ArrowUp'),
			brake: k('KeyS', 'ArrowDown', 'Space'),
			steer: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'),
			boost: !!k('ShiftLeft', 'ShiftRight'),
		};
		padZoom = 0;

		const t = touchCtl && touchCtl.read();
		if (t) {
			if (t.held && t.steer) inp.steer = -t.steer;
			if (t.left) inp.steer = -1;
			if (t.right) inp.steer = 1;
			if (t.left && t.right) inp.steer = 0;
			if (t.forward) inp.throttle = 1;
			if (t.back) inp.brake = 1;
		}
		const pads = navigator.getGamepads ? navigator.getGamepads() : [];
		for (const pad of pads) {
			if (!pad || !pad.connected) continue;
			const b = (i) => (pad.buttons[i] ? pad.buttons[i].value : 0);
			const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
			let sx = pad.axes[0] || 0;
			sx = Math.abs(sx) < 0.12 ? 0 : Math.sign(sx) * ((Math.abs(sx) - 0.12) / 0.88) ** 1.6;
			if (sx) inp.steer = sx;
			inp.throttle = Math.max(inp.throttle, b(7));
			inp.brake = Math.max(inp.brake, b(6));
			if (pressed(0)) inp.boost = true;
			const zy = pad.axes[3] || 0;
			padZoom = Math.abs(zy) < 0.15 ? 0 : zy;
			const zx = pad.axes[2] || 0;
			padLook = Math.abs(zx) < 0.15 ? 0 : Math.sign(zx) * (Math.abs(zx) - 0.15) / 0.85;
			const edge = (i, fn) => { const now = pressed(i); if (now && !padWas[i]) fn(); padWas[i] = now; };
			edge(3, doReset);
			edge(10, toggleCamera);
			edge(11, toggleFreeCamera);
			edge(9, () => api.home());
			break;
		}
		return inp;
	}

	let ringIsHidden = false, earthIsHidden = false;
	function ringHidden(on) {

		if (on && car.mode === 'road') return;
		ringIsHidden = on;
		ring.visible = !on;
	}
	function earthHidden(on) {
		if (on && car.mode !== 'road') return;
		earthIsHidden = on;
		const g = ctx.getGlobe();
		if (g) g.mesh.visible = !on;
	}

	const cam = {
		up: V(), head: V(), dist: CAM_BACK * ZOOM_START, arm: NaN, init: false, zoom: ZOOM_START,
		preset: CAMERA_CYCLE[0], high: 1, tilt: 0,
		orbit: 0, dragOrbit: 0, dragHeld: false, dragSince: 99, free: false,
	};
	const occRay = new THREE.Raycaster();

	const occluders = () => spin.children.filter((o) => o.isMesh && o.material !== hiddenMat)
		.concat(deck ? deck.group.children.filter((o) => o.material !== hiddenMat) : []);
	const lookM = new THREE.Matrix4();
	const P = V(), Q = new THREE.Quaternion();
	function chasePose(dt, snap) {
		const U = upOf(Q), F = fwdOf(Q);
		if (!cam.init || snap) {
			snap = true;
			cam.up.copy(U);
			cam.head.copy(F).addScaledVector(U, -F.dot(U)).normalize();
			cam.init = true;
		}

		const air = car.mode === 'air';
		const settle = air ? 0 : smooth(0, LAND_EASE, car.sinceLand);
		let upTarget = U;
		if (air) {
			const out = car.p.clone().sub(planetCentre()).normalize();
			upTarget = U.clone().lerp(out, smooth(0, 0.6, car.airTime)).normalize();
		}
		const kU = 1 - Math.exp(-dt * (air ? 2.5 : 2 + 6 * settle));
		cam.up.lerp(upTarget, kU).normalize();
		const Fp = F.clone().addScaledVector(cam.up, -F.dot(cam.up));
		if (Fp.lengthSq() > 1e-8) cam.head.lerp(Fp.normalize(), 1 - Math.exp(-dt * (air ? 2.5 : 2.5 + 3.5 * settle)));
		cam.head.addScaledVector(cam.up, -cam.head.dot(cam.up)).normalize();
		const wantDist = CAM_BACK * cam.zoom * (1 + 0.25 * Math.min(1, car.v.length() / MAX_SPEED));
		cam.dist += (wantDist - cam.dist) * (1 - Math.exp(-dt * 3));

		const blendK = snap ? 1 : 1 - Math.exp(-dt * 5);
		cam.high += ((cam.preset === 'low' ? 0 : 1) - cam.high) * blendK;
		cam.tilt += ((cam.preset === 'tilted' ? 1 : 0) - cam.tilt) * blendK;
		const lo = CAM_PRESETS.low, hi = CAM_PRESETS.high, k = cam.high;
		const camUp = lo.up + (hi.up - lo.up) * k;
		const lookAhead = lo.lookAhead + (hi.lookAhead - lo.lookAhead) * k;
		const lookUp = lo.lookUp + (hi.lookUp - lo.lookUp) * k;

		if (cam.free) {
			if (padLook) cam.dragOrbit = wrapAngle(cam.dragOrbit - padLook * ORBIT_FREE_RATE * dt);
		} else if (!cam.dragHeld) {
			cam.dragSince += dt;
			if (cam.dragSince > ORBIT_HOLD) cam.dragOrbit *= Math.exp(-dt * ORBIT_RECENTRE);
		}
		let bias = 0;
		if (car.mode === 'road') {
			const tp = planetCentre().sub(P);
			tp.addScaledVector(cam.up, -tp.dot(cam.up));
			if (tp.lengthSq() > 1e-8) {
				tp.normalize();
				const across = cam.head.clone().cross(tp).dot(cam.up);
				bias = EARTH_BIAS * cam.tilt * Math.max(-1, Math.min(1, across * 2));
			}
		}
		const orbitWant = bias + cam.dragOrbit + (cam.free ? 0 : padLook * ORBIT_STICK);

		cam.orbit = wrapAngle(cam.orbit + wrapAngle(orbitWant - cam.orbit) * (snap ? 1 : 1 - Math.exp(-dt * 6)));
		const view = cam.head.clone().applyAxisAngle(cam.up, cam.orbit);
		const want = P.clone().addScaledVector(view, -cam.dist)
			.addScaledVector(cam.up, camUp * (cam.dist / CAM_BACK));
		const look = P.clone().addScaledVector(view, lookAhead).addScaledVector(cam.up, lookUp);

		cam.fallLook = (cam.fallLook || 0) + ((car.mode === 'air' ? 1 : 0) - (cam.fallLook || 0)) * (1 - Math.exp(-dt * 1.5));
		look.addScaledVector(car.gravity, CAM_FALL_LOOK * cam.fallLook);

		const from = P.clone().addScaledVector(cam.up, CAM_LOOK_UP);
		const toCam = want.clone().sub(from);
		const full = toCam.length();
		toCam.divideScalar(full || 1);
		let arm = full;
		if (ring.visible) {
			occRay.set(from, toCam);
			occRay.near = 0;
			occRay.far = full;
			const hit = occRay.intersectObjects(occluders(), false)[0];
			if (hit) arm = Math.max(0.05, hit.distance - 0.015);
		}

		if (!Number.isFinite(cam.arm) || snap) cam.arm = arm;
		else cam.arm += (arm - cam.arm) * (1 - Math.exp(-dt * (arm < cam.arm ? 18 : 3)));
		const pos = from.addScaledVector(toCam, cam.arm);
		lookM.lookAt(pos, look, cam.up);
		return {
			pos, quat: new THREE.Quaternion().setFromRotationMatrix(lookM), fov: CAM_FOV, near: CAM_NEAR, offY: 0,
			look, up: cam.up.clone(),
		};
	}

	function poseNow() {
		const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
		const d = api.active ? Math.max(0.05, camera.position.distanceTo(P)) : camera.position.length();
		return {
			pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, near: camera.near,
			offY: camera.view && camera.view.enabled ? camera.view.offsetY : 0,
			look: camera.position.clone().addScaledVector(fwd, d),
			up: Y.clone().applyQuaternion(camera.quaternion),
		};
	}
	const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
	function applyFlight(a, b, t) {
		const e = smoother(Math.min(1, Math.max(0, t)));

		const eLook = smoother(Math.min(1, t / 0.7));

		const lift = Math.min(0.6, 0.12 * a.pos.distanceTo(b.pos));
		const ctrl = a.pos.clone().lerp(b.pos, 0.75).addScaledVector(b.up, lift);
		const u = 1 - e;
		const pos = a.pos.clone().multiplyScalar(u * u).addScaledVector(ctrl, 2 * u * e).addScaledVector(b.pos, e * e);
		const look = a.look.clone().lerp(b.look, eLook);
		const up = a.up.clone().lerp(b.up, e);
		if (up.lengthSq() < 1e-6) up.copy(b.up);
		up.normalize();
		lookM.lookAt(pos, look, up);
		const quat = new THREE.Quaternion().setFromRotationMatrix(lookM);
		applyPose({ ...a, pos, quat }, { ...b, pos, quat }, e);
	}
	function applyPose(a, b, e) {
		camera.position.lerpVectors(a.pos, b.pos, e);
		camera.quaternion.slerpQuaternions(a.quat, b.quat, e);
		camera.fov = a.fov + (b.fov - a.fov) * e;
		camera.near = Math.exp(Math.log(a.near) + (Math.log(b.near) - Math.log(a.near)) * e);
		const off = a.offY + (b.offY - a.offY) * e;
		const w = stage.clientWidth, h = stage.clientHeight;
		if (Math.abs(off) > 0.01) camera.setViewOffset(w, h, 0, off, w, h);
		else camera.clearViewOffset();
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld(true);
	}

	const homeBtn = document.createElement('button');
	homeBtn.type = 'button';
	homeBtn.textContent = 'Home';
	homeBtn.style.cssText = 'position:absolute;right:14px;top:14px;z-index:6;display:none';
	homeBtn.addEventListener('click', () => api.home());
	uiRoot.appendChild(homeBtn);

	const isTouchDevice = () => (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0)
		&& (!window.matchMedia || window.matchMedia('(pointer: coarse)').matches);
	let touchRoot = null;
	let touchHome = null;
	let touchCtl = null;
	let touchResets = 0;
	let released = false;
	function ensureTouch() {
		if (touchCtl || released) return touchCtl;
		touchRoot = document.getElementById('touch');
		if (touchRoot) {
			touchHome = { parent: touchRoot.parentNode, next: touchRoot.nextSibling };
		} else {
			touchRoot = document.createElement('div');
			touchRoot.id = 'touch';
		}
		touchRoot.style.display = 'none';
		uiRoot.appendChild(touchRoot);
		touchCtl = createTouchControls({
			root: touchRoot,
			onZoom: (scale) => { cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom * scale)); },
			onMenu: () => api.home(),
			onReset: () => { touchResets++; doReset(); },
			busy: () => released || !api.active || !!(fly && fly.to === 'home'),
		});
		touchCtl.setSteerMode('buttons');
		return touchCtl;
	}
	let touchOn = isTouchDevice();
	function setTouch(on) {
		touchOn = !!on;
		if (touchOn) ensureTouch();
		if (touchCtl) touchCtl.setEnabled(touchOn && api.active);
		if (touchRoot) touchRoot.style.display = api.active ? '' : 'none';

		homeBtn.style.display = api.active && !touchOn ? 'block' : 'none';
	}
	if (TOUCH_EAGER) ensureTouch();

	let fly = null;
	let homePose = null;
	let homeFraming = null;
	let acc = 0;
	let paused = false;
	let inputOverride = null;
	const stats = { startMs: null, arrivedMs: null, pressedAt: 0 };

	function framingNow() {
		camera.updateMatrixWorld(true);
		return { m: camera.matrixWorld.toArray(), p: camera.projectionMatrix.toArray() };
	}

	function chooseSpawnAngle() {
		spin.updateMatrixWorld(true);
		let best = 0, bestD = Infinity;
		for (let i = 0; i < 144; i++) {
			const a = (i / 144) * Math.PI * 2;
			const p = new THREE.Vector3(Math.cos(a) * MID_R, 0, Math.sin(a) * MID_R);
			spin.localToWorld(p);
			const d = p.distanceTo(camera.position);
			if (d < bestD) { bestD = d; best = a; }
		}
		return best;
	}

	function catchCar() {
		const { cars, traffic } = ctx.traffic;
		spin.updateMatrixWorld(true);
		let best = null, bestD = Infinity;
		for (const t of traffic) {
			if (t.car.dir !== SPAWN_DIR) continue;
			const d = t.mesh.getWorldPosition(V()).distanceTo(camera.position);
			if (d < bestD) { bestD = d; best = t; }
		}
		if (!best) {
			const a = chooseSpawnAngle();
			placeOnRing(a);
			carMesh = spare.group; tailMat = spare.tail;
			return a;
		}
		const c = best.car;
		const pos = best.mesh.getWorldPosition(V());
		const quat = best.mesh.getWorldQuaternion(new THREE.Quaternion());
		traffic.splice(traffic.indexOf(best), 1);
		cars.splice(cars.indexOf(c), 1);
		spin.remove(best.mesh);
		caught = best;
		carMesh = best.mesh;
		tailMat = best.tail;
		placeOnRing(c.angle, (c.r - R_IN) / ROAD_W, c.dir);

		car.p.copy(pos);
		car.q.copy(quat);
		car.pPrev.copy(pos);
		car.qPrev.copy(quat);
		car.v.copy(fwdOf(car.q)).multiplyScalar(c.speedNow * c.r);
		autopilot = { r: c.lane - c.toCentre * c.shift, dir: c.dir, speed: c.speedNow * c.r };
		return c.angle;
	}

	function releaseCar() {
		if (!caught) return;
		const { cars, traffic } = ctx.traffic;
		const c = caught.car;
		if (car.mode === 'road') {
			spin.updateMatrixWorld(true);
			const l = spin.worldToLocal(car.p.clone());
			c.angle = Math.atan2(l.z, l.x);
		}
		c.speedNow = c.speed;
		caught.mesh.position.set(0, 0, 0);
		caught.mesh.quaternion.identity();
		caught.mesh.rotation.set(0, 0, 0);
		caught.braking = null;
		scene.remove(caught.mesh);
		spin.add(caught.mesh);
		cars.push(c);
		traffic.push(caught);
		caught = null;
		carMesh = spare.group;
		tailMat = spare.tail;
	}

	function doReset() {
		if (!api.active || (fly && fly.to === 'home')) return;
		const from = poseNow();
		resetToRing();
		cam.init = false;
		fly = { t: 0, dur: FLY_RESET, from, to: 'chase' };
	}

	const api = {
		active: false,
		start(pressedAt = performance.now()) {
			if (api.active) return;
			stats.pressedAt = pressedAt;
			stats.startMs = null;
			stats.arrivedMs = null;
			homePose = poseNow();
			homeFraming = framingNow();
			const angle = catchCar();
			cam.zoom = ZOOM_START;
			cam.dist = CAM_BACK * ZOOM_START;
			if (SHOW_DECK) setDeck(angle - DECK_AHEAD, -1);
			scene.add(carMesh);
			ringHidden(false);
			earthHidden(false);
			cam.init = false;
			acc = 0;
			fly = { t: 0, dur: FLY_START, from: homePose, to: 'chase' };
			api.active = true;
			setTouch(touchOn);
		},
		home() {
			if (!api.active || (fly && fly.to === 'home')) return;
			fly = { t: 0, dur: FLY_HOME, from: poseNow(), to: 'home' };
		},
		frame(dt) {
			if (!api.active) return;
			const now = performance.now();
			ring.updateMatrixWorld(true);
			earth.updateMatrixWorld(true);
			const inp = inputOverride || readInput();
			if (padZoom) cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom * Math.exp(padZoom * dt * 1.5)));
			const flyingHome = fly && fly.to === 'home';
			if (!paused && !flyingHome) {
				acc += dt;
				let n = 0;
				while (acc >= STEP && n < MAX_STEPS) { step(inp); acc -= STEP; n++; }
				if (n === MAX_STEPS) acc = 0;
			}
			if (stats.startMs === null) stats.startMs = now - stats.pressedAt;
			const alpha = paused ? 1 : acc / STEP;
			P.lerpVectors(car.pPrev, car.p, alpha);
			Q.slerpQuaternions(car.qPrev, car.q, alpha);
			carMesh.position.copy(P);
			carMesh.quaternion.copy(Q);
			tailMat.color.copy(car.braking ? BRAKE_LAMP : TAIL);

			const chase = chasePose(paused ? 1 : dt, false);
			if (fly) {
				fly.t += dt;
				applyFlight(fly.from, fly.to === 'home' ? homePose : chase, fly.t / fly.dur);
				if (fly.t >= fly.dur) {
					const to = fly.to;
					fly = null;
					if (to === 'home') finishHome();
					else if (stats.arrivedMs === null) stats.arrivedMs = performance.now() - stats.pressedAt;
				}
			} else {
				applyPose(chase, chase, 1);
			}
		},

		release() {
			if (released) return;
			released = true;
			api.active = false;
			fly = null;
			keys.clear();
			if (touchCtl) touchCtl.setEnabled(false);
			if (touchRoot) {
				touchRoot.replaceChildren();
				touchRoot.removeAttribute('class');
				touchRoot.removeAttribute('style');
				const home = touchHome;
				if (home && home.parent) {
					home.parent.insertBefore(touchRoot, home.next && home.next.parentNode === home.parent ? home.next : null);
				} else {
					touchRoot.remove();
				}
			}
			touchRoot = null;
			touchHome = null;
		},

		dispose() {
			api.release();
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
			stage.removeEventListener('pointerdown', onDragDown);
			window.removeEventListener('pointermove', onDragMove);
			window.removeEventListener('pointerup', onDragUp);
			window.removeEventListener('pointercancel', onDragUp);
			window.removeEventListener('wheel', onWheel);
			onDragUp();
			homeBtn.remove();
			removeDeck();
		},
		debug: null,
	};

	function finishHome() {
		api.active = false;
		scene.remove(carMesh);
		releaseCar();
		removeDeck();
		ringHidden(false);
		earthIsHidden = false;
		const g = ctx.getGlobe();
		if (g) g.mesh.visible = true;
		camera.fov = homePose.fov;
		camera.near = homePose.near;
		camera.clearViewOffset();
		ctx.homeFraming();
		homeBtn.style.display = 'none';
		if (touchCtl) touchCtl.setEnabled(false);
		if (touchRoot) touchRoot.style.display = 'none';
		keys.clear();
		onDragUp();
		cam.dragOrbit = 0;
		ctx.onHome();
		const after = framingNow();
		stats.framingError = Math.max(
			...after.m.map((x, i) => Math.abs(x - homeFraming.m[i])),
			...after.p.map((x, i) => Math.abs(x - homeFraming.p[i])),
		);
	}

	function sideOfDay() {
		const out = car.mode === 'road' ? upOf(car.q) : car.p.clone().sub(planetCentre()).normalize();
		const ndl = out.dot(LIGHT_DIR);
		return { ndl, label: ndl > 0.12 ? 'day' : ndl < -0.30 ? 'night' : 'terminator' };
	}

	function stateRecord() {
		const up = upOf(car.q);
		const angle = car.grounded && car.faceNormal.lengthSq() > 0
			? deg(Math.acos(Math.min(1, Math.max(-1, -car.gravity.dot(car.faceNormal)))))
			: null;
		const day = sideOfDay();
		return {
			mode: car.mode, source: car.source, surface: car.surface, grounded: car.grounded,
			speed: car.v.dot(fwdOf(car.q)), vmag: car.v.length(),
			gap: Number.isFinite(car.gap) ? car.gap : null,
			angle,
			upVsGravity: deg(Math.acos(Math.min(1, Math.max(-1, -up.dot(car.gravity))))),
			p: car.p.toArray(), up: up.toArray(), air: car.airTime,
			stack: stackAt(car.p, up), ndl: day.ndl, side: day.label,
			r: car.p.clone().sub(planetCentre()).length(),
		};
	}

	const lat2local = (lat, lon) => new THREE.Vector3(
		Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
	api.debug = {
		driver: api,
		stats,
		state: stateRecord,
		pause(on) { paused = on; acc = 0; },
		setInput(inp) { inputOverride = inp; },
		respawns: () => respawns,
		lastLanding: () => lastLanding,
		constants: {
			STEP, MAX_SPEED, CRUISE_SPEED, BOOST_SPEED, G, UP_REACH, DOWN_REACH, LEAVE_TIME, REACQUIRE_AFTER, FALL_BLEND,
			DECK_H, DECK_W, DECK_SPAN, CAR_LENGTH: ctx.CAR_LENGTH, CAR_W, ROAD_W, MID_R,
		},
		placeOnRing(angle, lane = SPAWN_LANE, dir = -1) { placeOnRing(angle, lane, dir); cam.init = false; },
		ringAngle() { spin.updateMatrixWorld(true); const l = spin.worldToLocal(car.p.clone()); return Math.atan2(l.z, l.x); },
		ringRadius() { spin.updateMatrixWorld(true); const l = spin.worldToLocal(car.p.clone()); return Math.hypot(l.x, l.z); },

		deckPath() {
			if (!deck) return null;
			spin.updateMatrixWorld(true);
			return deck.centre.map((c) => spin.localToWorld(c.clone()).toArray());
		},
		deckAngles() { return deck ? deck.angles : null; },
		ringPoint(angle, lane = SPAWN_LANE) { return ringFrame(angle, lane, -1).p.toArray(); },

		setEarthRotation(y) { earth.rotation.y = y; earth.updateMatrixWorld(true); },
		earthRotation: () => earth.rotation.y,
		carLatLon() {
			earth.updateMatrixWorld(true);
			const l = earth.worldToLocal(car.p.clone()).normalize();
			return [deg(Math.asin(l.y)), deg(Math.atan2(-l.z, l.x))];
		},
		reset: doReset,
		hideRing: ringHidden,
		hideEarth: earthHidden,
		framing: framingNow,

		sim(n, input, every = 1) {
			const out = [];
			for (let i = 0; i < n; i++) {
				ring.updateMatrixWorld(true);
				earth.updateMatrixWorld(true);
				const inp = typeof input === 'function' ? input(stateRecord(), i) : (input || {});
				if (inp && inp.stop) break;
				step(inp);
				if (i % every === 0) out.push({ i, ...stateRecord() });
			}
			return out;
		},

		globeAt(lat, lon) {
			earth.updateMatrixWorld(true);
			const l = lat2local(lat, lon);
			const mask = ctx.getMask();
			const w = earth.localToWorld(l.clone());
			return { p: w.toArray(), land: mask ? isLand(mask, l.x, l.y, l.z) : null, ndl: w.clone().normalize().dot(LIGHT_DIR) };
		},

		placeOnPlanet(lat, lon, toward) {
			earth.updateMatrixWorld(true);
			const w = earth.localToWorld(lat2local(lat, lon));
			const gh = globeHit(w.clone().multiplyScalar(1.05));
			const out = gh.point.clone().normalize();
			const t = new THREE.Vector3().fromArray(toward).sub(gh.point);
			car.p.copy(gh.point);
			car.v.set(0, 0, 0);
			basisQuat(out, t, car.q);
			car.pPrev.copy(car.p); car.qPrev.copy(car.q);
			car.mode = 'planet'; car.source = 'point'; car.grounded = true; car.land = gh.land;
			car.surface = gh.land ? 'land' : 'water';
			car.normal.copy(out); car.faceNormal.copy(gh.n); car.gravity.copy(out).negate();
			setCarrier(earth);
			cam.init = false;
		},

		steerToward(target, gain = 2.5) {
			const up = upOf(car.q), f = fwdOf(car.q);
			const t = new THREE.Vector3().fromArray(target).sub(car.p);
			t.addScaledVector(up, -t.dot(up));
			if (t.lengthSq() < 1e-10) return 0;
			t.normalize();
			const cross = f.clone().cross(t).dot(up);
			const ang = Math.atan2(cross, f.dot(t));
			return Math.max(-1, Math.min(1, -ang * gain));
		},
		distanceTo(target) { return car.p.distanceTo(new THREE.Vector3().fromArray(target)); },
		snapCamera() { cam.init = false; },

		simCamera(n, input) {
			const recs = [];
			let prevQ = null, prevW = 0;
			cam.init = false;
			for (let i = 0; i < n; i++) {
				ring.updateMatrixWorld(true);
				earth.updateMatrixWorld(true);
				const inp = typeof input === 'function' ? input(stateRecord(), i) : (input || {});
				if (inp && inp.stop) break;
				step(inp);
				P.copy(car.p);
				Q.copy(car.q);
				const pose = chasePose(STEP, false);
				const w = prevQ ? deg(2 * Math.acos(Math.min(1, Math.abs(prevQ.dot(pose.quat))))) / STEP : 0;
				recs.push({ i, mode: car.mode, surface: car.surface, w, dw: prevQ ? Math.abs(w - prevW) / STEP : 0, arm: cam.arm });
				prevQ = pose.quat;
				prevW = w;
			}
			return recs;
		},
		zoom: () => cam.zoom,
		headingDir: () => fwdOf(car.q).toArray(),
		orbit: () => ({ orbitDeg: deg(cam.orbit), dragDeg: deg(cam.dragOrbit), held: cam.dragHeld, free: cam.free }),
		camera: () => ({ preset: cam.preset, blend: cam.high, tilt: cam.tilt }),
		touch: () => ({ on: touchOn, input: touchCtl ? touchCtl.read() : null, resets: touchResets }),
		setTouch: (on) => setTouch(on),
		autopilot: () => (autopilot ? { ...autopilot } : null),
		caught: () => (caught ? { dir: caught.car.dir, paint: caught.car.paint } : null),
		trafficCount: () => ctx.traffic.traffic.length,
		cameraPitchDeg() {
			const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
			return deg(Math.asin(Math.max(-1, Math.min(1, -f.dot(upOf(car.q))))));
		},
		cameraDistance: () => camera.position.distanceTo(P),
	};
	return api;
}

function annulus(inner, outer, y, segs) {
	const pos = [], idx = [];
	for (let i = 0; i <= segs; i++) {
		const a = (i / segs) * Math.PI * 2;
		const ca = Math.cos(a), sa = Math.sin(a);
		pos.push(ca * inner, y, sa * inner, ca * outer, y, sa * outer);
	}
	for (let i = 0; i < segs; i++) {
		const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
		idx.push(a, b, c, b, d, c);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex(idx);
	return g;
}

function orientUp(g) {
	const p = g.attributes.position, idx = g.index.array;
	const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
	const tri = new THREE.Triangle();
	const n = new THREE.Vector3();
	for (let i = 0; i < idx.length; i += 3) {
		a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
		tri.set(a, b, c).getNormal(n);
		if (n.y < 0) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
	}
	g.index.needsUpdate = true;
	return g;
}

const NLON = 90, NLAT = 45;
function cellOf(lat, lon) {
	const la = Math.min(NLAT - 1, Math.max(0, Math.floor(((lat + Math.PI / 2) / Math.PI) * NLAT)));
	const lo = ((Math.floor(((lon + Math.PI) / (2 * Math.PI)) * NLON) % NLON) + NLON) % NLON;
	return [la, lo];
}

function buildBins(geo) {
	const a = geo.attributes.position.array;
	const n = a.length / 9;
	const cells = Array.from({ length: NLON * NLAT }, () => []);
	for (let t = 0; t < n; t++) {
		let latMin = 9, latMax = -9;
		const lons = [];
		for (let k = 0; k < 3; k++) {
			const x = a[t * 9 + k * 3], y = a[t * 9 + k * 3 + 1], z = a[t * 9 + k * 3 + 2];
			const r = Math.hypot(x, y, z);
			const lat = Math.asin(y / r);
			latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
			lons.push(Math.atan2(-z, x));
		}
		let lo0, lo1;
		if (Math.max(...lons) - Math.min(...lons) > Math.PI) {
			const shifted = lons.map((l) => (l < 0 ? l + 2 * Math.PI : l));
			lo0 = Math.min(...shifted); lo1 = Math.max(...shifted);
		} else { lo0 = Math.min(...lons); lo1 = Math.max(...lons); }
		const [la0] = cellOf(latMin, 0), [la1] = cellOf(latMax, 0);
		const polar = latMax > 1.35 || latMin < -1.35;
		const c0 = Math.floor(((lo0 + Math.PI) / (2 * Math.PI)) * NLON) - 1;
		const c1 = Math.floor(((lo1 + Math.PI) / (2 * Math.PI)) * NLON) + 1;
		for (let la = Math.max(0, la0 - 1); la <= Math.min(NLAT - 1, la1 + 1); la++) {
			if (polar) { for (let lo = 0; lo < NLON; lo++) cells[la * NLON + lo].push(t); continue; }
			for (let c = c0; c <= c1; c++) cells[la * NLON + (((c % NLON) + NLON) % NLON)].push(t);
		}
	}
	return { a, cells };
}

function rayGlobe(bins, dir) {
	const lat = Math.asin(Math.max(-1, Math.min(1, dir.y)));
	const lon = Math.atan2(-dir.z, dir.x);
	const [la, lo] = cellOf(lat, lon);
	const list = bins.cells[la * NLON + lo];
	const a = bins.a;
	const ox = dir.x * 1.1, oy = dir.y * 1.1, oz = dir.z * 1.1;
	const dx = -dir.x, dy = -dir.y, dz = -dir.z;
	let bestT = Infinity, bn = null;
	for (const t of list) {
		const i = t * 9;
		const e1x = a[i + 3] - a[i], e1y = a[i + 4] - a[i + 1], e1z = a[i + 5] - a[i + 2];
		const e2x = a[i + 6] - a[i], e2y = a[i + 7] - a[i + 1], e2z = a[i + 8] - a[i + 2];
		const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
		const det = e1x * px + e1y * py + e1z * pz;
		if (Math.abs(det) < 1e-12) continue;
		const inv = 1 / det;
		const tx = ox - a[i], ty = oy - a[i + 1], tz = oz - a[i + 2];
		const u = (tx * px + ty * py + tz * pz) * inv;
		if (u < -1e-9 || u > 1 + 1e-9) continue;
		const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
		const v = (dx * qx + dy * qy + dz * qz) * inv;
		if (v < -1e-9 || u + v > 1 + 1e-9) continue;
		const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
		if (tt > 0 && tt < bestT) {
			bestT = tt;
			bn = [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x];
		}
	}
	if (!bn) return { r: 1, n: dir.clone(), miss: true };
	const n = new THREE.Vector3(bn[0], bn[1], bn[2]).normalize();
	if (n.dot(dir) < 0) n.negate();
	return { r: 1.1 - bestT, n };
}
