

const STICK_DEADZONE = 0.08;
const TRIGGER_DEADZONE = 0.04;

export function deadzone(v, dz) {
	if (!Number.isFinite(v)) return 0;
	if (Math.abs(v) < dz) return 0;
	return Math.sign(v) * ((Math.abs(v) - dz) / (1 - dz));
}

export function curve(v, exp) {
	const e = Number.isFinite(exp) ? exp : 2;
	if (e === 1) return v;
	return Math.sign(v) * Math.pow(Math.abs(v), e);
}

export const PAD_MAP = {
	steerAxis: 0,
	camXAxis: 2,
	camYAxis: 3,
	boost: 0,
	handbrake: 1,
	reverse: 2,
	reset: 3,
	zoomMod: 4,
	brake: 6,
	throttle: 7,
	snapView: 10,

	snapView2: 4,

	menu: 9,
	menuPad: 17,

	camCycle: 5,
	tabPrev: 4,
	tabNext: 5,

	dpadUp: 12,
	dpadDown: 13,
	dpadLeft: 14,
	dpadRight: 15,

	confirm: 0,

	back: 1,

	orbitClick: 11,
};

export const CAM_YAW_RATE = 2.6;
export const CAM_PITCH_RATE = 1.6;

export const CAM_ZOOM_RATE = 2.0;

export const CAM_ZOOM_EXP = 1.25;

export const BRAKE_EXP = 2.0;

export const TRIGGER_TOP_LIFT = 1.45;

const TOP_LIFT_FROM = 0.9;

export function rawPad() {
	if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
	const pads = navigator.getGamepads();
	if (!pads) return null;
	for (const pad of pads) {
		if (!pad || !pad.connected) continue;
		if (pad.mapping !== 'standard') continue;
		if (pad.axes.length < 4 || pad.buttons.length < 8) continue;
		return pad;
	}
	return null;
}

const btn = (pad, i) => (pad.buttons[i] ? pad.buttons[i].pressed : false);
const val = (pad, i) => (pad.buttons[i] ? pad.buttons[i].value : 0);

export function readPad(opts) {
	const pad = rawPad();
	if (!pad) return null;
	const o = opts || {};
	const map = o.map || PAD_MAP;
	const invertY = !!o.invertY;
	const camExp = o.camExp === undefined ? 2 : o.camExp;
	const yawRate = o.yawRate === undefined ? CAM_YAW_RATE : o.yawRate;
	const pitchRate = o.pitchRate === undefined ? CAM_PITCH_RATE : o.pitchRate;
	const zoomRate = o.zoomRate === undefined ? CAM_ZOOM_RATE : o.zoomRate;
	const zoomExp = o.zoomExp === undefined ? CAM_ZOOM_EXP : o.zoomExp;
	const brakeExp = o.brakeExp === undefined ? BRAKE_EXP : o.brakeExp;
	const topLift = o.topLift === undefined ? TRIGGER_TOP_LIFT : o.topLift;

	const steer = deadzone(-pad.axes[map.steerAxis], STICK_DEADZONE);
	const fwd = deadzone(val(pad, map.throttle), TRIGGER_DEADZONE);
	const rev = btn(pad, map.reverse) ? 1 : 0;

	const brake = curve(deadzone(val(pad, map.brake), TRIGGER_DEADZONE), brakeExp);
	const handbrake = btn(pad, map.handbrake);
	const boost = btn(pad, map.boost);

	const rx = curve(deadzone(pad.axes[map.camXAxis], STICK_DEADZONE), camExp);
	const ryRaw = deadzone(pad.axes[map.camYAxis], STICK_DEADZONE);

	const orbit = !!o.orbit;

	const camZoom = orbit ? 0 : curve(ryRaw, zoomExp) * zoomRate;
	const ry = orbit ? curve(ryRaw, camExp) : 0;

	return {

		steer,
		throttle: rev > 0 ? -rev : fwd,
		brake,
		handbrake,
		boost,

		topLift: 1 + Math.max(0, (fwd - TOP_LIFT_FROM) / (1 - TOP_LIFT_FROM))
			* (topLift - 1),

		camYaw: -rx * yawRate,
		camPitch: orbit ? (invertY ? -ry : ry) * pitchRate : 0,

		camZoom,

		snapView: btn(pad, map.snapView) || btn(pad, map.snapView2),

		reset: btn(pad, map.reset),

		zoomMod: btn(pad, map.zoomMod),

		orbitClick: btn(pad, map.orbitClick),

		menu: btn(pad, map.menu) || btn(pad, map.menuPad),
		camCycle: btn(pad, map.camCycle),
		tabPrev: btn(pad, map.tabPrev),
		tabNext: btn(pad, map.tabNext),
		up: btn(pad, map.dpadUp),
		down: btn(pad, map.dpadDown),
		left: btn(pad, map.dpadLeft),
		right: btn(pad, map.dpadRight),
		confirm: btn(pad, map.confirm),
		back: btn(pad, map.back),

		driving: steer !== 0 || fwd !== 0 || rev !== 0 || brake !== 0
			|| handbrake || boost,
		looking: rx !== 0 || ryRaw !== 0,
		id: pad.id,
		index: pad.index,
	};
}

export function padFamily(id) {
	const s = String(id || '').toLowerCase();
	if (/dualsense|dualshock|playstation|054c|wireless controller/.test(s)) return 'playstation';
	if (/xbox|xinput|045e/.test(s)) return 'xbox';
	if (/switch|joy-?con|pro controller|nintendo|057e/.test(s)) return 'nintendo';
	return 'generic';
}

export const PAD_LABELS = {
	playstation: {
		menu: 'Options', confirm: 'cross', shoulderL: 'L1', shoulderR: 'R1',
		triggerL: 'L2', triggerR: 'R2', faceR: 'circle', faceL: 'square', faceU: 'triangle',
		stickL: 'L3', stickR: 'R3',
	},
	xbox: {
		menu: 'Start', confirm: 'A', shoulderL: 'LB', shoulderR: 'RB',
		triggerL: 'LT', triggerR: 'RT', faceR: 'B', faceL: 'X', faceU: 'Y',
		stickL: 'LS', stickR: 'RS',
	},
	nintendo: {
		menu: '+', confirm: 'B', shoulderL: 'L', shoulderR: 'R',
		triggerL: 'ZL', triggerR: 'ZR', faceR: 'A', faceL: 'Y', faceU: 'X',
		stickL: 'L3', stickR: 'R3',
	},
	generic: {
		menu: 'Start', confirm: 'bottom face', shoulderL: 'L1', shoulderR: 'R1',
		triggerL: 'L2', triggerR: 'R2', faceR: 'right face', faceL: 'left face',
		faceU: 'top face', stickL: 'L3', stickR: 'R3',
	},
};

export function describePads() {
	if (typeof navigator === 'undefined' || !navigator.getGamepads) {
		return { supported: false, pads: [] };
	}
	const out = [];
	for (const pad of navigator.getGamepads()) {
		if (!pad) continue;
		out.push({
			index: pad.index,
			id: pad.id,
			mapping: pad.mapping,
			connected: pad.connected,
			usable: pad.mapping === 'standard' && pad.axes.length >= 4
				&& pad.buttons.length >= 8,
			axes: Array.from(pad.axes).map((a) => +a.toFixed(3)),
			buttons: pad.buttons.map((b) => +b.value.toFixed(3)),
			pressed: pad.buttons
				.map((b, i) => (b.pressed ? i : -1)).filter((i) => i >= 0),
		});
	}
	return { supported: true, pads: out };
}
