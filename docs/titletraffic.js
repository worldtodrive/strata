

const TAU = Math.PI * 2;

export const CAR_LENGTH = 0.115;
export const CAR_WIDTH = 0.115 * (1.02 / 2.24);

const MIN_GAP = CAR_LENGTH + 0.03;
const LOOK_AHEAD = MIN_GAP + 0.10;
const LOOK_BEHIND = MIN_GAP + 0.06;
const FOLLOW_TIME = 1.0;
const SLOT_RATE = 2.4;
const SPEED_RATE = 1.2;
const HOLD = 1.5;
const BRAKE_DECEL = 0.004;
const BRAKE_HOLD = 0.6;

export function seedCars({ count, next, rIn, rOut }) {
	const width = rOut - rIn;

	const shift = width * 0.115;
	const perLane = [Math.ceil(count / 2), Math.floor(count / 2)];
	const cars = [];
	for (let i = 0; i < count; i++) {
		const outer = i % 2 === 1;
		const k = Math.floor(i / 2);
		const n = perLane[outer ? 1 : 0];
		const speed = 0.075 + next() * 0.055;
		const lane = outer ? rIn + width * 0.73 : rIn + width * 0.27;

		const angle = ((k + 0.35 * next()) / n) * TAU;
		cars.push({
			paint: next(),
			dir: outer ? -1 : 1,
			angle,
			lane,

			toCentre: outer ? -1 : 1,
			shift,
			speed,
			speedNow: speed,
			slot: 0,
			slotNow: 0,
			hold: next() * HOLD,
			r: lane - (outer ? -1 : 1) * shift,
			yaw: 0,
			braking: false,
		});
	}
	return cars;
}

const along = (c) => (((c.angle * c.dir) % TAU) + TAU) % TAU;
const occupies = (c, slot) => Math.abs(c.slotNow - slot) < 0.999;
const occupiesAny = (c, other) => (occupies(other, 0) && occupies(c, 0)) || (occupies(other, 1) && occupies(c, 1));

function gapsIn(c, others, slot) {
	let ahead = Infinity, behind = Infinity;
	for (const o of others) {
		if (o === c || !occupies(o, slot)) continue;
		const d = ((along(o) - along(c)) + TAU) % TAU;
		ahead = Math.min(ahead, d * c.lane);
		behind = Math.min(behind, (TAU - d) * c.lane);
	}
	return { ahead, behind };
}

function stepLane(lane, dt) {

	const caps = lane.map((c) => {
		let cap = Infinity;
		for (const o of lane) {
			if (o === c || !occupiesAny(c, o)) continue;
			const d = ((along(o) - along(c)) + TAU) % TAU * c.lane;
			if (d > LOOK_AHEAD * 3) continue;
			cap = Math.min(cap, o.speedNow + Math.max(0, d - MIN_GAP) / (c.lane * FOLLOW_TIME));
		}
		return cap;
	});
	lane.forEach((c, i) => {
		const was = c.speedNow;
		const free = c.speedNow + (c.speed - c.speedNow) * Math.min(1, dt * SPEED_RATE);
		c.speedNow = Math.min(free, caps[i]);
		const heldUp = caps[i] < c.speed * 0.97;

		if (dt > 0 && (was - c.speedNow) / dt > BRAKE_DECEL) c.brakeFor = BRAKE_HOLD;
		c.brakeFor = Math.max(0, (c.brakeFor || 0) - dt);
		c.braking = c.brakeFor > 0;

		c.hold = Math.max(0, c.hold - dt);
		const settled = Math.abs(c.slotNow - c.slot) < 1e-3;
		if (settled && c.hold === 0) {
			const other = 1 - c.slot;
			const g = gapsIn(c, lane, other);
			const clearThere = g.ahead >= LOOK_AHEAD && g.behind >= LOOK_BEHIND;
			if (c.slot === 0 && heldUp && clearThere) {
				c.slot = 1;
				c.hold = HOLD;
			} else if (c.slot === 1 && clearThere) {
				c.slot = 0;
				c.hold = HOLD;
			}
		}
	});
}

export function stepCars(cars, dt) {
	stepLane(cars.filter((c) => c.dir > 0), dt);
	stepLane(cars.filter((c) => c.dir < 0), dt);
	for (const c of cars) {
		const slotWas = c.slotNow;
		const step = SLOT_RATE * dt;
		c.slotNow = Math.abs(c.slot - c.slotNow) <= step ? c.slot : c.slotNow + Math.sign(c.slot - c.slotNow) * step;

		const s = (u) => u * u * (3 - 2 * u);
		c.angle += c.speedNow * c.dir * dt;
		c.r = c.lane + (s(c.slotNow) * 2 - 1) * c.toCentre * c.shift;

		const across = dt > 0 ? ((s(c.slotNow) - s(slotWas)) * 2 * c.toCentre * c.shift) / dt : 0;
		const steer = Math.atan2(across, Math.max(1e-4, c.speedNow * c.lane));
		c.yaw = -c.angle + (c.dir < 0 ? Math.PI : 0) + c.dir * steer;
	}
}
