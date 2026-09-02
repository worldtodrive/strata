

import * as THREE from 'three';

export const CAMERAS = {

	chaselow: {
		label: 'low',
		note: 'the low, close-to-the-road chase. One angle at every zoom — 20 degrees.',
		back: 7.0, up: 2.55, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 30, tiltFar: 30, zoomNear: 0.56, zoomFar: 6.00,

		fitCar: true,

		minBack: 3.9,

		speedFovScale: 0,

	},
	chasemid: {
		label: 'mid',
		note: 'the default. Standard chase height, 26 degrees, held at every zoom.',
		back: 7.0, up: 3.41, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 35, tiltFar: 35, zoomNear: 0.56, zoomFar: 6.00,

		fitCar: true,

		minBack: 3.9,

		speedFovScale: 0,

	},
	chasehigh: {
		label: 'high',
		note: 'sits up over the roof for a longer view down the road — 33 degrees.',
		back: 7.0, up: 4.55, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 40, tiltFar: 40, zoomNear: 0.56, zoomFar: 6.00,

		fitCar: true,

		minBack: 3.9,

		speedFovScale: 0,

	},

	chasedyn: {
		label: 'auto 2-step',
		note: 'low zoomed in, high pulled out, an even sweep the whole way — 20 degrees '
			+ 'at the closest notch to 33 at the furthest, with no flat section.',
		back: 7.0, up: 3.41, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 30, tiltFar: 40, zoomNear: 0.56, zoomFar: 6.00, tiltLog: true,

		fitCar: true,

		minBack: 3.9,

		speedFovScale: 0,

	},
	chasedyn3: {
		label: 'auto 3-step',
		note: 'the same low-to-high idea but holding the middle angle across the '
			+ 'everyday zooms — 20 in, 26 through the driving range, 33 pulled right out.',
		back: 7.0, up: 3.41, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,

		tiltNear: 30, zoomNear: 0.56,
		tiltFar: 35, zoomFar: 1.20, tiltLog: true,

		tiltOut: 40, zoomOut: 4.20,

		fitCar: true,

		minBack: 3.9,

		speedFovScale: 0,

	},

	chase: {
		label: 'chase',
		note: 'the default. Middle of the road — follows closely, still breathes in a corner.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
	},

	delta: {
		label: 'chase D',
		note: 'chase, with the tilt ramped 30 to 40 across the zoom and a closer '
			+ 'bottom notch. Same lag as chase — only the aim and the boom floor move.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 30, zoomNear: 0.30,
		tiltFar: 40, zoomFar: 4.20, tiltLog: true,
		minBack: 3.2,
	},

	echo: {
		label: 'chase E · steady',
		note: 'chase D with the car nailed down — the lens stops breathing with speed, '
			+ 'the aim never lags, and the shot reaches its 40° a full two notches '
			+ 'earlier. Same body and same four lag constants as chase.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 32, zoomNear: 0.30,
		tiltFar: 40, zoomFar: 2.20, tiltLog: true,
		minBack: 3.2,
		steady: true,
	},

	foxtrot: {
		label: 'chase F · steady, steeper',
		note: 'chase E looking down harder — 34° at the closest zoom opening to 42° '
			+ 'out. Only the two tilt anchors differ from chase E.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 34, zoomNear: 0.30,
		tiltFar: 42, zoomFar: 2.20, tiltLog: true,
		minBack: 3.2,
		steady: true,
	},

	golf: {
		label: 'chase G · steady, pinned',
		note: 'chase E with the distance pinned as well — the car cannot change size '
			+ 'under the throttle or the brakes. Still trails and swings in a bend; '
			+ 'only how far away it ends up is held.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 32, zoomNear: 0.30,
		tiltFar: 40, zoomFar: 2.20, tiltLog: true,
		minBack: 3.2,
		steady: true, pinBoom: true,
	},

	framed: {
		label: 'framed chase',
		note: 'chase, with the whole car kept in shot at every zoom and a higher eye. '
			+ 'Same lag as chase — past the fit limit the last zoom notches stop '
			+ 'magnifying rather than cropping the car.',

		back: 7.0, up: 3.6, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		frameBelow: 0.34,
		fitCar: true,
		speedFovScale: 0.35,
	},

	high: {
		label: 'high chase',
		note: 'framed chase from a higher eye, looking down at about 38 degrees. Same '
			+ 'boom and same lag as chase -- only the angle moves.',
		back: 7.0, up: 4.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,

		tiltNear: 28, zoomNear: 0.30,
		tiltFar: 40, zoomFar: 4.20, tiltLog: true,

		frameBelow: 0.36,
		fitCar: true,
		speedFovScale: 0.35,
	},

	tight: {
		label: 'tight top',
		note: 'short boom, high eye -- about 48 degrees down, the car filling the frame '
			+ 'from above. Stiffer than chase, because a close shot magnifies camera shake.',
		back: 4.5, up: 3.5, lag: 10.0, lagY: 6.0, lookLag: 14.0, lookLagY: 8.0,

		frameBelow: 0.30,

		fitCar: true,
		speedFovScale: 0.35,
	},
	gt: {
		label: 'close',
		note: 'Gran Turismo — bolted to the car. The world moves, the car does not.',
		back: 6.0, up: 2.8, lag: 14.0, lagY: 9.0, lookLag: 18.0, lookLagY: 11.0,

		fixedFov: true,
	},
	forza: {
		label: 'loose',
		note: 'Forza — the camera trails and swings into corners. Cinematic, less precise.',
		back: 8.6, up: 4.0, lag: 3.0, lagY: 1.6, lookLag: 4.5, lookLagY: 2.0,
	},

	hood: {
		label: 'cockpit',
		note: 'inside the car, bolted to the body. No lag — what you see IS the chassis pose. '
			+ 'Tune with ?camfwd= ?camup= ?camside= ?campitch= ?camfov=.',
		mounted: true,

		fwd: 0.55, up: 0.70,

		side: 0, pitch: 0, fov: 0,
	},

	bonnet: {
		label: 'hood',
		note: 'on the bonnet, ahead of the windscreen. The classic hood cam — the nose of the '
			+ 'car in shot and no lag anywhere.',
		mounted: true,
		fwd: 1.45, up: 0.82,
		side: 0, pitch: 0,

		fov: 70,
	},

	alfa: {
		label: 'chase A · 30° car high',
		note: 'a shallow axis with the car close to the middle of the frame. The most road '
			+ 'ahead of the three, and the least like looking down on the roof.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 30, tiltFar: 30, zoomNear: 0.30, zoomFar: 6.00,
		frameBelow: 0.25,
		fitCar: true, fitRadius: 1.05,
	},

	bravo: {
		label: 'chase B · 30° in, 42° out',
		note: 'A and C in one camera: 30 degrees at the closest notch, opening to 42 by the '
			+ 'furthest, and easing between. The everyday zooms sit in the middle of that.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 30, tiltFar: 42, zoomNear: 0.30, zoomFar: 6.00,
		frameBelow: 0.28,
		fitCar: true, fitRadius: 1.05,

		speedFovScale: 0,
	},
	charlie: {
		label: 'chase C · 42° car high',
		note: 'a steep axis with the car near the middle -- more of the car and the tarmac '
			+ 'immediately around it, less horizon. The opposite end from A.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 42, tiltFar: 42, zoomNear: 0.30, zoomFar: 6.00,
		frameBelow: 0.30,
		fitCar: true, fitRadius: 1.05,
	},

	highb: {
		label: 'high · 32° in, 40° out',
		note: 'the high chase view, holding its 32 degrees through the everyday zooms and '
			+ 'opening to 40 as you pull back. Closer at the near end than high, which caps '
			+ 'its magnification earlier.',
		back: 7.0, up: 4.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 32, tiltFar: 40, zoomNear: 1.00, zoomFar: 4.20,

		frameBelow: 0.44, trueFrame: true,
		fitCar: true, fitRadius: 1.05,
		speedFovScale: 0.35,
	},

	stiffpos: {
		label: 'chase · stiff car pos',
		note: 'the standard chase view with the car sitting exactly where the stiff camera '
			+ 'puts it -- measured off the screen rather than matched by eye, so it holds at '
			+ 'every zoom instead of only one.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		frameBelow: 0.283, trueFrame: true,
	},

	merged: {
		label: 'chase · 37°',
		note: 'the standard chase view with nothing changed but the angle -- a fixed 37 '
			+ 'degrees down at every zoom, instead of 26 falling away to 8. Same boom, same '
			+ 'filters, same lens behaviour, so it rides exactly as chase does.',
		back: 7.0, up: 4.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,

		tiltNear: 37, tiltFar: 37, zoomNear: 0.30, zoomFar: 6.00,
		frameBelow: 0.32,

		fitCar: true, fitRadius: 1.05,
	},

	gtloose: {
		label: 'stiff · loose',
		note: 'the stiff camera angle and fixed lens on a chase-view filter. The boom trails '
			+ 'and swings through a corner, which is also what stops the car jittering when '
			+ 'you zoom right in. Still centred while you orbit with K.',

		back: 6.0, up: 2.8, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,

		fixedFov: true, trueFrame: true,

		tiltNear: 34, tiltFar: 25, zoomNear: 0.30, zoomFar: 1.00,

		tiltOut: 40, zoomOut: 6.00,

		fitCar: true,
	},
	gtsoft: {
		label: 'stiff · looser',
		note: 'the same again with the boom looser still -- between the chase view and the '
			+ 'loose one. Drive this if the car is still jittery at the closest notches, '
			+ 'because a slower filter is what removes that.',

		back: 6.0, up: 2.8, lag: 4.0, lagY: 2.2, lookLag: 8.0, lookLagY: 4.0,
		fixedFov: true, trueFrame: true,

		tiltNear: 34, tiltFar: 25, zoomNear: 0.30, zoomFar: 1.00,

		tiltOut: 40, zoomOut: 6.00,
		fitCar: true,
	},

	highfirm: {
		label: 'high · stiff',
		note: 'the high chase angle, bolted to the car. Same 32 degrees and same framing as '
			+ 'high -- only the lag changes, from trailing to rigid.',
		back: 7.0, up: 4.4, lag: 14.0, lagY: 9.0, lookLag: 18.0, lookLagY: 11.0,
		frameBelow: 0.36,

		trueFrame: true, fitCar: true,

		speedFovScale: 0,
	},

	highlock: {
		label: 'high · locked',
		note: 'the high chase angle with the car nailed to one spot. Same trailing boom as '
			+ 'high, but the aim never leaves the car, so the throttle and the brakes cannot '
			+ 'move it on screen.',
		back: 7.0, up: 4.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		frameBelow: 0.36,
		trueFrame: true, lockAim: true, fitCar: true, speedFovScale: 0,
	},

	chasea: {
		label: 'chase A · snap at 1.7x',
		note: '38 degrees zoomed in, snapping to 42 as you pull past 1.7x. Car at 48% below '
			+ 'centre -- about three quarters of the way down the glass -- and pinned there '
			+ 'through any zoom, lens or throttle input.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 38, tiltFar: 42, zoomNear: 1.55, zoomFar: 1.85,
		frameBelow: 0.48, trueFrame: true, fitCar: true, speedFovScale: 0,
	},
	chaseb: {
		label: 'chase B · snap at 2.6x',
		note: 'the same pair of angles with the change further out -- the shallow shot holds '
			+ 'through the middle notches and only opens up when you pull right back.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 38, tiltFar: 42, zoomNear: 2.45, zoomFar: 2.75,
		frameBelow: 0.48, trueFrame: true, fitCar: true, speedFovScale: 0,
	},
	chasec: {
		label: 'chase C · car lower',
		note: 'A\'s angles and snap point, with the car pushed further down the glass -- 52% '
			+ 'of the way to the bottom edge rather than 48%. More road ahead in shot.',
		back: 7.0, up: 3.4, lag: 6.0, lagY: 3.0, lookLag: 8.0, lookLagY: 4.0,
		tiltNear: 38, tiltFar: 42, zoomNear: 1.55, zoomFar: 1.85,
		frameBelow: 0.60, trueFrame: true, fitCar: true, speedFovScale: 0,
	},

	std: {
		label: 'chase', v2: true,
		note: 'a standard third-person chase view. 19 degrees down, the car a little below '
			+ 'centre, and the angle is the same at every zoom. The boom trails behind the '
			+ 'car through a bend; the aim never leaves it.',
		back: 6.0, up: 2.67,
		omega: 7.0, omegaY: 6.0, lookLag: 20.0,
		frameBelow: 0.22, liftPow: 1.0,

		tiltNear: 24, tiltFar: 34, zoomNear: 1.2, zoomFar: 6.0,
		fitCar: true, speedFovScale: 0,
	},

	firm: {
		label: 'stiff', v2: true,
		note: 'the same shot bolted down. The boom hardly swings and the lens never moves -- '
			+ 'the precision view for judging where the car actually is.',
		back: 6.0, up: 2.67,
		omega: 16.0, omegaY: 6.0, lookLag: 20.0,
		frameBelow: 0.22, liftPow: 1.0,

		tiltNear: 24, tiltFar: 34, zoomNear: 1.2, zoomFar: 6.0,
		fitCar: true, fixedFov: true,
	},
	nose: {
		label: 'hood', v2: true,
		mounted: true,
		fwd: 2.15, up: 0.62,
		side: 0, pitch: 0,
		note: 'ahead of the bonnet, low and looking down the road. The bodywork is a hint at '
			+ 'the bottom edge rather than the subject.',

		fov: 74,

		zoomCap: 1.70,
	},

};

export const CAMERA_ORDER = [

	'chasedyn3', 'chasedyn', 'chasemid', 'chaselow', 'chasehigh', 'gt',

];

export const CAMERA_ORDER_V2 = ['std', 'firm'];

let classicCams = (() => {
	if (typeof location === 'undefined') return true;
	const v = new URLSearchParams(location.search).get('newcams');
	return !(v !== null && v !== '0' && v !== 'off');
})();
export function setClassicCameras(v) { classicCams = !!v; }
export function classicCameras() { return classicCams; }

export function cameraOrder() {
	return CAMERA_ORDER;
}

export function defaultCamera(touch = false) {

	if (touch && classicCams) return 'gt';

	return classicCams ? 'chasedyn3' : CAMERA_ORDER_V2[0];
}

const CAM_TUNE = (() => {
	if (typeof location === 'undefined') return {};
	const q = new URLSearchParams(location.search);
	const num = (k) => {
		const v = Number(q.get(k));
		return q.get(k) !== null && Number.isFinite(v) ? v : undefined;
	};
	return {
		fwd: num('camfwd'), up: num('camup'), side: num('camside'),
		pitch: num('campitch'), fov: num('camfov'),

		liftPow: num('camliftpow'),
	};
})();

const CAM_TUNE_BY_NAME = (() => {
	const out = {};
	if (typeof location === 'undefined') return out;
	for (const raw of new URLSearchParams(location.search).getAll('camtune')) {

		const m = /^\s*([A-Za-z][A-Za-z0-9]*)\.(fwd|up|side|pitch|fov|liftPow|back|frameBelow|tiltNear|tiltFar|zoomNear|zoomFar|lookLagY|lookLag|lagY|lag)\s*=\s*(-?[\d.]+)\s*$/.exec(raw);
		if (!m) {
			console.warn(`[camtune] ignored "${raw}" — expected <preset>.<field>=<number>, `
				+ 'where <field> is one of fwd, up, side, pitch, fov, liftPow, back, '
				+ 'frameBelow, tiltNear, tiltFar, zoomNear, zoomFar, lag, lagY, lookLag, '
				+ 'lookLagY. ⚠️ A second parameter needs & and not ? — '
				+ '?chunk=whole&camtune=chasedyn3.lagY=40');
			continue;
		}
		const v = Number(m[3]);
		if (!Number.isFinite(v)) {
			console.warn(`[camtune] ignored "${raw}" — "${m[3]}" is not a number`);
			continue;
		}
		if (!CAMERAS[m[1]]) {
			console.warn(`[camtune] "${m[1]}" is not a camera preset — the knob will be `
				+ 'parsed and never read. Names are the keys of CAMERAS, e.g. chasedyn3.');
		}
		;
		(out[m[1]] ||= {})[m[2]] = v;
	}
	return out;
})();

for (const [k, v] of Object.entries(CAMERAS)) v.key = k;

function tuned(c, field) {
	const named = CAM_TUNE_BY_NAME[c.key];
	return CAM_TUNE[field] ?? (named ? named[field] : undefined) ?? c[field];
}

export function cameraReadout(preset, zoom) {
	const c = preset || CAMERAS.chase;
	const activeKey = c.key || 'chase';
	const z = Number.isFinite(zoom) ? zoom : 1;
	const back = tuned(c, 'back');
	const up = tuned(c, 'up');
	const liftPow = tuned(c, 'liftPow') ?? 0.5;
	const below0 = c.frameBelow === undefined ? frameBelow : c.frameBelow;

	const trim = tiltTrim;

	const look = THREE.MathUtils.radToDeg(viewPitch);

	const ramp = rampTiltDeg(c, z);
	const baseDeg = ramp === undefined
		? THREE.MathUtils.radToDeg(Math.atan2(up * Math.pow(z, liftPow), back * z))
		: ramp;
	const deg = c.mounted ? 0 : baseDeg + trim + look;

	const off = trim + look;
	const upOut = off
		? +(back * Math.tan(Math.atan2(up, back)
			+ THREE.MathUtils.degToRad(off))).toFixed(3)
		: up;
	const bits = c.mounted
		? [`fwd=${tuned(c, 'fwd')}`, `up=${up}`, `pitch=${tuned(c, 'pitch')}`,
			`fov=${tuned(c, 'fov')}`]
		: ramp === undefined
			? [`back=${back}`, `up=${upOut}`, `frameBelow=${below0.toFixed(2)}`,
				`liftPow=${liftPow}`]

			: [`back=${back}`, `tiltNear=${c.tiltNear}`, `tiltFar=${c.tiltFar}`,
				`zoomNear=${c.zoomNear}`, `zoomFar=${c.zoomFar}`,
				`frameBelow=${below0.toFixed(2)}`];

	const stops = c.tiltStops && c.tiltStops.length
		? `tiltstops=${activeKey}:`
			+ c.tiltStops.map(([sz, sd]) => `${sz}=${sd}`).join(',')
		: '';
	const tune = bits.map((b) => `camtune=${activeKey}.${b}`).join('&');
	return {
		name: activeKey,
		label: c.label,
		mounted: !!c.mounted,
		back, up: upOut, liftPow, frameBelow: below0, zoom: z, tiltTrim: trim,
		fov: Math.round(currentFov()),
		degrees: +deg.toFixed(1),

		...rampZone(c, z),
		tiltStops: stops ? c.tiltStops.map((p) => p.slice()) : null,
		camtune: stops ? `${stops}&${tune}` : tune,
	};
}

export const CAM_ZOOM_STEPS = [

	0.56, 0.75, 1.00, 1.30, 1.70, 2.20, 3.00, 4.20, 6.00, 8.50, 12.00,
];

export const LAG_MODES = [
	{ label: 'exact', exact: true,
		note: '1 - exp(-dt*lag) — the same smoothing per second at any frame rate' },
	{ label: 'legacy', exact: false,
		note: 'min(dt*lag, 1) — what every preset has always used. Frame-rate dependent.' },
];
let exactLag = true;
export function setLagMode(exact) { exactLag = !!exact; }
export function lagModeIsExact() { return exactLag; }

let steadyMode = null;

let pinMode = null;
export function setSteady(v) { steadyMode = v === null ? null : !!v; }
export function getSteady() { return steadyMode; }

const BOOM_PULLS = { free: 0, gentle: 0.5, matched: 1, hard: 2 };
let boomPull = 'matched';
export function setBoomPull(v) { if (v in BOOM_PULLS) boomPull = v; }
export function getBoomPull() { return boomPull; }
export function boomPulls() { return Object.keys(BOOM_PULLS); }
const BOOM_MODES = ['classic', 'level', 'rigid', 'locked', 'smooth', 'rig', 'sweep'];

let boomMode = 'rig';
export function setBoomMode(v) { if (BOOM_MODES.includes(v)) boomMode = v; }
export function getBoomMode() { return boomMode; }
export function boomModes() { return BOOM_MODES.slice(); }
const TILT_R_MIN = 0.55;
const TILT_R_MAX = 1.80;
let holdAim = true;
export function setHoldAim(v) { holdAim = !!v; }
export function getHoldAim() { return holdAim; }
const aimVel = new THREE.Vector3();
const aimPrev = new THREE.Vector3();
let aimPrevOk = false;

const AIM_FF_LAG = 6;
const AIM_FF_LIMIT = 4.0;
let holdFrame = true;
export function setHoldFrame(v) { holdFrame = !!v; }
export function getHoldFrame() { return holdFrame; }

export function setPinBoom(v) { pinMode = v === null ? null : !!v; }
export function getPinBoom() { return pinMode; }

let pinRate = 50;

const ORBIT_PIN_RATE = 14;

const ORBIT_RELEASE = 1.5;
let orbitAmt = 0;

let fitMode = null;
export function setFitCar(v) { fitMode = v === null ? null : !!v; }
export function getFitCar() { return fitMode; }
function fitOn(c) { return fitMode === null ? !!c.fitCar : fitMode; }
export function setPinRate(v) { if (Number.isFinite(v) && v > 0) pinRate = v; }
export function getPinRate() { return pinRate; }

const pinAnchor = new THREE.Vector3();
let pinAnchorOk = false;
let pinAnchorRate = 25;
export function setPinAnchorRate(v) {
	if (Number.isFinite(v) && v >= 0) pinAnchorRate = v;
}
export function getPinAnchorRate() { return pinAnchorRate; }

function steadyOn(c) { return steadyMode === null ? !!c.steady : steadyMode; }



export const VIEW_PITCH_LIMIT = Math.PI * 0.42;
let viewYaw = 0;
let viewPitch = 0;

export function setViewAngles(yaw, pitch) {
	viewYaw = Number.isFinite(yaw) ? yaw : 0;
	viewPitch = THREE.MathUtils.clamp(
		Number.isFinite(pitch) ? pitch : 0, -VIEW_PITCH_LIMIT, VIEW_PITCH_LIMIT);
}
export function getViewAngles() { return { yaw: viewYaw, pitch: viewPitch }; }

let fovTrim = 0;
let liveFov = 0;
export function setFovTrim(deg) { fovTrim = Number.isFinite(deg) ? deg : 0; }
export function getFovTrim() { return fovTrim; }

export function currentFov() { return liveFov; }

export const SPEED_FOV_V0 = 8;
export const SPEED_FOV_V1 = 45;
const SPEED_FOV_LAG = 2.2;
let speedFovGain = 10;
let speedFovNow = 0;
export function setSpeedFovGain(deg) {
	speedFovGain = Number.isFinite(deg) ? deg : 0;
}
export function getSpeedFovGain() { return speedFovGain; }

export function speedFovApplied() { return speedFovNow; }

export const DEFAULT_AIM = 0.8;

let frameBelow = 0.30;
export function setFrameBelow(v) {
	frameBelow = THREE.MathUtils.clamp(Number.isFinite(v) ? v : 0.30, -0.4, 0.85);
}
export function getFrameBelow() { return frameBelow; }

const MIN_BACK_UNITS = 3.9;

function minBackOf(c) {
	return tuned(c, 'minBack') ?? MIN_BACK_UNITS;
}

const MIN_LIFT_UNITS = 1.2;

function stopsTiltDeg(stops, zoom) {
	const n = stops.length;
	if (!n) return undefined;
	if (n === 1) return stops[0][1];
	const z = Math.max(zoom, 1e-4);
	if (z <= stops[0][0]) return stops[0][1];
	if (z >= stops[n - 1][0]) return stops[n - 1][1];
	for (let i = 1; i < n; i++) {
		const [z1, d1] = stops[i];
		if (z > z1) continue;
		const [z0, d0] = stops[i - 1];

		if (!(z1 > z0)) return d1;
		const t = Math.log(z / z0) / Math.log(z1 / z0);
		return d0 + (d1 - d0) * (t * t * (3 - 2 * t));
	}
	return stops[n - 1][1];
}

function parseTiltStops(text) {
	const out = [];
	for (const part of String(text).split(',')) {
		const m = /^\s*(-?[\d.]+)\s*[=:]\s*(-?[\d.]+)\s*$/.exec(part);
		if (!m) continue;
		const z = Number(m[1]);
		const d = Number(m[2]);
		if (Number.isFinite(z) && Number.isFinite(d) && z > 0) out.push([z, d]);
	}
	out.sort((p, q) => p[0] - q[0]);
	return out;
}

export function setTiltStops(name, text) {
	const c = CAMERAS[name];
	if (!c) return null;
	const stops = parseTiltStops(text);
	if (stops.length) c.tiltStops = stops;
	else delete c.tiltStops;
	return c.tiltStops || null;
}

(() => {
	if (typeof location === 'undefined') return;
	for (const raw of new URLSearchParams(location.search).getAll('tiltstops')) {
		const i = String(raw).indexOf(':');
		if (i <= 0) continue;
		setTiltStops(raw.slice(0, i).trim(), raw.slice(i + 1));
	}
})();

function rampZone(c, zoom) {
	const hi = tuned(c, 'tiltFar');
	if (hi === undefined) return { zone: 'none', zoneT: 0 };
	const near = tuned(c, 'zoomNear') ?? 1.0;
	const far = tuned(c, 'zoomFar') ?? 6.0;
	const lo = tuned(c, 'tiltNear')
		?? THREE.MathUtils.radToDeg(Math.atan2(tuned(c, 'up'), tuned(c, 'back')));
	const out = tuned(c, 'tiltOut');
	const zOut = tuned(c, 'zoomOut') ?? 6.0;
	const frac = (a, b) => (b > a && zoom > 0 && a > 0
		? THREE.MathUtils.clamp(Math.log(zoom / a) / Math.log(b / a), 0, 1)
		: 0);
	if (out !== undefined && zoom > far && zOut > far) {
		const t = frac(far, zOut);

		return t >= 1
			? { zone: 'high', zoneT: 1 }
			: { zone: 'med→high', zoneT: +t.toFixed(2) };
	}
	if (lo === hi && out === undefined) return { zone: 'flat', zoneT: 0 };
	if (zoom <= near) return { zone: 'low', zoneT: 0 };
	if (zoom >= far) {
		return { zone: out === undefined ? 'high' : 'med', zoneT: 1 };
	}
	return { zone: out === undefined ? 'low→high' : 'low→med',
		zoneT: +frac(near, far).toFixed(2) };
}

function rampTiltDeg(c, zoom) {

	if (c.tiltStops && c.tiltStops.length) return stopsTiltDeg(c.tiltStops, zoom);

	const hi = tuned(c, 'tiltFar');
	if (hi === undefined) return undefined;
	const near = tuned(c, 'zoomNear') ?? 1.0;
	const far = tuned(c, 'zoomFar') ?? 6.0;
	const a = tuned(c, 'tiltNear')
		?? THREE.MathUtils.radToDeg(Math.atan2(tuned(c, 'up'), tuned(c, 'back')));

	if (!(far > near)) return a;

	const out = tuned(c, 'tiltOut');
	const zOut = tuned(c, 'zoomOut') ?? 6.0;
	if (out !== undefined && zoom > far && zOut > far) {

		const u = tuned(c, 'tiltLog') && far > 0 && zoom > 0
			? THREE.MathUtils.clamp(
				Math.log(zoom / far) / Math.log(zOut / far), 0, 1)
			: THREE.MathUtils.clamp((zoom - far) / (zOut - far), 0, 1);

		const f = tuned(c, 'tiltLog') ? u * (2 - u) : u * u * (3 - 2 * u);
		return hi + (out - hi) * f;
	}

	const t = tuned(c, 'tiltLog') && near > 0 && zoom > 0
		? THREE.MathUtils.clamp(Math.log(zoom / near) / Math.log(far / near), 0, 1)
		: THREE.MathUtils.clamp((zoom - near) / (far - near), 0, 1);
	return a + (hi - a) * (t * t * (3 - 2 * t));
}

const RIG_SWINGS = { chase: 0, bolted: 16, firm: 11, medium: 8, loose: 5.5, glide: 4 };
let rigSwing = 'chase';

export const TURN_MODES = [
	{ id: 'loose', label: 'loose',
		note: 'the camera trails and cuts the corner — what the page has always done' },
	{ id: 'stiff', label: 'stiff',
		note: 'the boom stays exactly behind the car — what K gives you today' },
];
let turnMode = 'loose';
export function setTurnMode(v) {
	if (TURN_MODES.some((m) => m.id === v)) turnMode = v;
}
export function getTurnMode() { return turnMode; }

let craneMode = false;
let craneHead = null;
export function setCraneMode(v) { craneMode = !!v; if (!v) craneHead = null; }
export function getCraneMode() { return craneMode; }

let freeLook = false;
export function setFreeLook(v) { freeLook = !!v; }

let craneAmt = 0;

const rigEye = new THREE.Vector3();
let rigEyeOk = false;

let rigOff = 0;

let rigYawVel = 0;
let rigHeadPrev = null;
let rigYawRate = 0;

const RIG_RATE_LAG = 5;
const RIG_FF_LIMIT = 0.45;
export function setRigSwing(v) { if (v in RIG_SWINGS) rigSwing = v; }
export function getRigSwing() { return rigSwing; }
const rigAnchor = new THREE.Vector3();
const rigWheel = new THREE.Vector3();
let rigYaw = null;

function rigGroundY(vehicle, carPos) {
	const w = vehicle.wheels;
	const susp = vehicle._suspLerp || vehicle._currSusp;
	if (!w || !susp || !w.length || susp.length !== w.length) return carPos.y;
	let sum = 0;
	for (let i = 0; i < w.length; i++) {
		rigWheel.set(w[i].x, w[i].y - susp[i], w[i].z)
			.applyQuaternion(vehicle.renderQuat);
		sum += rigWheel.y;
	}
	return carPos.y + sum / w.length - (vehicle.baseWheelR || 0);
}

function applyRig(camera, vehicle, dt, c, carPos, carScale, heading) {

	rigAnchor.x = carPos.x;
	rigAnchor.z = carPos.z;
	rigAnchor.y = rigGroundY(vehicle, carPos) + CAR_BODY_CENTRE * carScale;

	if (!rigEyeOk || dt >= 0.5) {
		rigEye.set(camArm.x, 0, camArm.z);
		rigEyeOk = true;
	} else {
		const ke = smooth(dt, tuned(c, 'lag') || 8);
		rigEye.x += (camArm.x - rigEye.x) * ke;
		rigEye.z += (camArm.z - rigEye.z) * ke;
	}
	const om = RIG_SWINGS[rigSwing] || 8;

	if (rigHeadPrev === null || dt >= 0.5 || !(dt > 1e-4)) {
		rigYawRate = 0;
	} else {
		let hd = heading - rigHeadPrev;
		if (hd > Math.PI) hd -= 2 * Math.PI;
		if (hd < -Math.PI) hd += 2 * Math.PI;
		rigYawRate += (hd / dt - rigYawRate) * smooth(dt, RIG_RATE_LAG);
	}
	rigHeadPrev = heading;
	const ff = THREE.MathUtils.clamp(
		2 * rigYawRate / om, -RIG_FF_LIMIT, RIG_FF_LIMIT);
	const want = heading + ff;
	if (rigYaw === null || dt >= 0.5) {
		rigYaw = want;
		rigYawVel = 0;
	} else {
		let d = want - rigYaw;
		if (d > Math.PI) d -= 2 * Math.PI;
		if (d < -Math.PI) d += 2 * Math.PI;
		springStep(0, rigYawVel, d, om, dt);
		rigYaw += _spr.x;
		rigYawVel = _spr.v;
	}

	const d = Math.hypot(camArm.x, camArm.z);
	const h = camArm.y;

	const ex = rigEye.x;
	const ez = rigEye.z;
	const filtered = (rigSwing === 'chase' && (ex * ex + ez * ez) > 1e-6)
		? Math.atan2(ez, ex)
		: Math.atan2(camArm.z, camArm.x) + (rigYaw - heading);

	let exactAz = Math.atan2(camArm.z, camArm.x);

	const craneOn = craneMode && freeLook;
	const offWant = (turnMode === 'stiff' || craneOn) ? 1 : 0;
	if (dt >= 0.5) rigOff = offWant;
	else if (offWant >= rigOff) rigOff = offWant;
	else rigOff += (offWant - rigOff) * smooth(dt, ORBIT_RELEASE);
	if (rigOff < 0.01) rigOff = 0;

	if (dt >= 0.5) craneAmt = craneOn ? 1 : 0;
	else craneAmt += ((craneOn ? 1 : 0) - craneAmt) * smooth(dt, ORBIT_RELEASE);
	if (craneAmt < 0.01) craneAmt = 0;
	if (craneAmt > 0) {
		if (craneHead === null) craneHead = heading;
		let dh = heading - craneHead;
		if (dh > Math.PI) dh -= 2 * Math.PI;
		if (dh < -Math.PI) dh += 2 * Math.PI;
		exactAz -= dh * craneAmt;
	} else {
		craneHead = null;
	}

	let dAz = filtered - exactAz;
	if (dAz > Math.PI) dAz -= 2 * Math.PI;
	if (dAz < -Math.PI) dAz += 2 * Math.PI;
	const az = exactAz + dAz * (1 - rigOff);
	camera.position.x = rigAnchor.x + Math.cos(az) * d;
	camera.position.z = rigAnchor.z + Math.sin(az) * d;
	camera.position.y = rigAnchor.y + h;

	const halfFov = THREE.MathUtils.degToRad(liveFov || 62) * 0.5;
	const below0 = c.frameBelow === undefined ? frameBelow : c.frameBelow;
	const below = Math.atan2(h, Math.max(d, 0.05));
	const aimUp = h + d * Math.tan(below0 * halfFov - below);
	camLook.set(rigAnchor.x, rigAnchor.y + aimUp, rigAnchor.z);
	camera.lookAt(camLook);
	camera.up.set(0, 1, 0);
	probeFraming(camera, carPos, carScale, dt);
}

function smoothPolar(camera, carPos, aA, aR) {
	const wantR = Math.hypot(camArm.x, camArm.z);
	const wantTh = Math.atan2(camArm.z, camArm.x);
	const ox = camera.position.x - carPos.x;
	const oz = camera.position.z - carPos.z;
	let haveR = Math.hypot(ox, oz);
	let haveTh;
	if (haveR < 1e-3) { haveR = wantR; haveTh = wantTh; }
	else haveTh = Math.atan2(oz, ox);
	const d = wantTh - haveTh;
	const th = haveTh + Math.atan2(Math.sin(d), Math.cos(d)) * aA;
	const r = haveR + (wantR - haveR) * aR;
	camera.position.x = carPos.x + Math.cos(th) * r;
	camera.position.z = carPos.z + Math.sin(th) * r;
}

const CAR_BODY_CENTRE = 0.354;

const CAR_FIT_RADIUS = 1.73;

const CAR_FIT_MARGIN = 1.15;

const probePt = new THREE.Vector3();

const PROBE_WINDOW = 2.0;
const probe = {
	below: 0, side: 0, ok: false,

	tilt: 0, tLo: Infinity, tHi: -Infinity, tPreLo: Infinity, tPreHi: -Infinity,
	dist: 0, dLo: Infinity, dHi: -Infinity, dPreLo: Infinity, dPreHi: -Infinity,
	curLo: Infinity, curHi: -Infinity,
	preLo: Infinity, preHi: -Infinity,
	t: 0,

	prevBelow: null, prevSide: null,
	jSum: 0, jN: 0, jPrev: 0,
};

function probeFraming(camera, carPos, carScale, dt) {

	const bx = camera.position.x - carPos.x;
	const by2 = camera.position.y - carPos.y;
	const bz = camera.position.z - carPos.z;
	const run = Math.hypot(bx, bz);
	probe.tilt = THREE.MathUtils.radToDeg(Math.atan2(by2, Math.max(run, 1e-4)));
	probe.dist = Math.hypot(bx, by2, bz);
	if (probe.tilt < probe.tLo) probe.tLo = probe.tilt;
	if (probe.tilt > probe.tHi) probe.tHi = probe.tilt;
	if (probe.dist < probe.dLo) probe.dLo = probe.dist;
	if (probe.dist > probe.dHi) probe.dHi = probe.dist;
	camera.updateMatrixWorld();
	camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

	probePt.set(carPos.x, carPos.y + CAR_BODY_CENTRE * carScale, carPos.z)
		.applyMatrix4(camera.matrixWorldInverse);

	if (probePt.z > -0.01) { probe.ok = false; return; }
	const tanHalf = Math.tan(THREE.MathUtils.degToRad(liveFov || 62) * 0.5);
	if (!(tanHalf > 1e-6)) { probe.ok = false; return; }
	probe.below = -(probePt.y / -probePt.z) / tanHalf;
	probe.side = (probePt.x / -probePt.z) / tanHalf;

	if (probe.prevBelow !== null) {
		probe.jSum += Math.hypot(
			probe.below - probe.prevBelow, probe.side - probe.prevSide);
		probe.jN += 1;
	}
	probe.prevBelow = probe.below;
	probe.prevSide = probe.side;
	probe.ok = true;
	if (probe.below < probe.curLo) probe.curLo = probe.below;
	if (probe.below > probe.curHi) probe.curHi = probe.below;
	probe.t += dt;
	if (probe.t >= PROBE_WINDOW) {
		probe.preLo = probe.curLo; probe.preHi = probe.curHi;
		probe.curLo = Infinity; probe.curHi = -Infinity;
		probe.tPreLo = probe.tLo; probe.tPreHi = probe.tHi;
		probe.tLo = Infinity; probe.tHi = -Infinity;
		probe.dPreLo = probe.dLo; probe.dPreHi = probe.dHi;
		probe.dLo = Infinity; probe.dHi = -Infinity;
		probe.jPrev = probe.jN > 0 ? probe.jSum / probe.jN : 0;
		probe.jSum = 0; probe.jN = 0;
		probe.t = 0;
	}
}

export function framingProbe() {
	const lo = Math.min(probe.curLo, probe.preLo);
	const hi = Math.max(probe.curHi, probe.preHi);
	const spanned = Number.isFinite(lo) && Number.isFinite(hi);

	const live = probe.jN > 0 ? probe.jSum / probe.jN : 0;
	const tLoAll = Math.min(probe.tLo, probe.tPreLo);
	const tHiAll = Math.max(probe.tHi, probe.tPreHi);
	const spanTilt = Number.isFinite(tLoAll) && Number.isFinite(tHiAll);
	const dLoAll = Math.min(probe.dLo, probe.dPreLo);
	const dHiAll = Math.max(probe.dHi, probe.dPreHi);
	const spanDist = Number.isFinite(dLoAll) && Number.isFinite(dHiAll);
	return {
		ok: probe.ok,
		below: probe.below,
		lo: spanned ? lo : probe.below,
		hi: spanned ? hi : probe.below,
		walk: spanned ? hi - lo : 0,
		jitter: probe.jPrev || live,

		tilt: probe.tilt,
		tSwing: spanTilt ? tHiAll - tLoAll : 0,
		dist: probe.dist,
		dSwing: spanDist ? dHiAll - dLoAll : 0,
		fov: liveFov,
	};
}

const _spr = { x: 0, v: 0 };
function springStep(cur, vel, target, omega, dt) {
	const f = 1 + 2 * dt * omega;
	const oo = omega * omega;
	const hoo = dt * oo;
	const hhoo = dt * hoo;
	const det = 1 / (f + hhoo);
	_spr.x = (cur * f + vel * dt + target * hhoo) * det;
	_spr.v = (vel + hoo * (target - cur)) * det;
}

let stabilise = 0.75;
export function setStabilise(v) {
	stabilise = THREE.MathUtils.clamp(Number.isFinite(v) ? v : 0.75, 0, 1);
}
export function getStabilise() { return stabilise; }

let warnedMissingPreset = false;
const camVel = new THREE.Vector3();

let carYSmooth = null;

let boomYaw = null;
let boomYawVel = 0;

let prevHeading = null;
let yawRate = 0;

const YAW_RATE_LAG = 7.0;

let carYPrev = null;
let carVySmooth = 0;

const CAR_VY_LAG = 4.0;

const VY_FF_LIMIT = 1.5;

const YAW_FF_LIMIT = 0.45;

let tiltTrim = (() => {
	if (typeof location === 'undefined') return 0;
	const v = Number(new URLSearchParams(location.search).get('camtilt'));
	return Number.isFinite(v) ? THREE.MathUtils.clamp(v, -20, 20) : 0;
})();
export function setTiltTrim(deg) {
	tiltTrim = THREE.MathUtils.clamp(Number.isFinite(deg) ? deg : 0, -20, 20);
}
export function getTiltTrim() { return tiltTrim; }

function applyChaseV2(camera, vehicle, dt, opts, c) {
	const carPos = vehicle.renderPos;
	const carScale = opts.carScale;

	camFwd.set(0, 0, -1).applyQuaternion(vehicle.renderQuat);
	camFwd.y = 0;
	if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1); else camFwd.normalize();

	const heading = Math.atan2(camFwd.x, camFwd.z);
	if (prevHeading === null || dt >= 0.5) {
		prevHeading = heading;
		yawRate = 0;
	} else {
		let turned = heading - prevHeading;

		if (turned > Math.PI) turned -= 2 * Math.PI;
		if (turned < -Math.PI) turned += 2 * Math.PI;
		prevHeading = heading;
		yawRate += ((dt > 1e-4 ? turned / dt : 0) - yawRate) * smooth(dt, YAW_RATE_LAG);
	}

	const liftPow = tuned(c, 'liftPow') ?? 0.5;

	const backUnits = tuned(c, 'back');
	const rawUnits = backUnits * opts.zoom;
	const units = Math.max(rawUnits, minBackOf(c));
	const dist = units * carScale;

	const effZoom = units / backUnits;
	const lift = carScale * Math.pow(effZoom, liftPow);

	camArm.copy(camFwd).multiplyScalar(-dist);

	const rampDeg = rampTiltDeg(c, opts.zoom);
	const armYWant = rampDeg === undefined
		? tuned(c, 'up') * lift
		: dist * Math.tan(THREE.MathUtils.degToRad(rampDeg));
	camArm.y = Math.max(armYWant, MIN_LIFT_UNITS * carScale);

	if (tiltTrim) {
		const horiz = Math.hypot(camArm.x, camArm.z);
		if (horiz > 1e-4) {
			const theta = Math.atan2(camArm.y, horiz)
				+ THREE.MathUtils.degToRad(tiltTrim);
			camArm.y = horiz * Math.tan(THREE.MathUtils.clamp(theta, -0.15, 1.25));
		}
	}

	const ff = THREE.MathUtils.clamp(
		2 * yawRate / (c.omega || 8), -YAW_FF_LIMIT, YAW_FF_LIMIT);
	const wantYaw = heading + ff + viewYaw;
	if (boomYaw === null || dt >= 0.5) {
		boomYaw = wantYaw;
		boomYawVel = 0;
	} else {

		let d = wantYaw - boomYaw;
		if (d > Math.PI) d -= 2 * Math.PI;
		if (d < -Math.PI) d += 2 * Math.PI;
		springStep(0, boomYawVel, d, c.omega || 8, dt);
		boomYaw += _spr.x;
		boomYawVel = _spr.v;
	}

	camArm.x = -Math.sin(boomYaw) * dist;
	camArm.z = -Math.cos(boomYaw) * dist;
	if (viewPitch) {
		camAxis.set(-camArm.z, 0, camArm.x);
		if (camAxis.lengthSq() > 1e-9) {
			camArm.applyAxisAngle(camAxis.normalize(), viewPitch);
		}
	}
	camWant.copy(carPos).add(camArm);

	camera.position.x = camWant.x;
	camera.position.z = camWant.z;

	const omY = (c.omegaY || c.omega || 6) * (2.4 - 2.1 * stabilise);
	const carVy = dt > 1e-4 ? (carPos.y - (carYPrev === null ? carPos.y : carYPrev)) / dt : 0;
	carYPrev = carPos.y;
	if (dt >= 0.5) carVySmooth = 0;
	else carVySmooth += (carVy - carVySmooth) * smooth(dt, CAR_VY_LAG);

	const vyFF = THREE.MathUtils.clamp(
		2 * carVySmooth / Math.max(omY, 0.5), -VY_FF_LIMIT, VY_FF_LIMIT);
	if (dt >= 0.5 || carYSmooth === null) {
		carYSmooth = carPos.y;
		camVel.set(0, 0, 0);
	} else {
		springStep(carYSmooth, camVel.y, carPos.y + vyFF, omY, dt);
		carYSmooth = _spr.x;
		camVel.y = _spr.v;
	}
	camera.position.y = carYSmooth + camArm.y;

	const h = camera.position.y - carPos.y;
	const armDist = Math.max(
		Math.hypot(camera.position.x - carPos.x, camera.position.z - carPos.z), 0.05);
	const halfFov = THREE.MathUtils.degToRad(liveFov || 62) * 0.5;
	const below = Math.atan2(h - CAR_BODY_CENTRE * carScale, armDist);
	const below0 = c.frameBelow === undefined ? frameBelow : c.frameBelow;

	const target = Math.atan(below0 * Math.tan(halfFov));
	const aimWorld = h + armDist * Math.tan(target - below);

	const b = smooth(dt, tuned(c, 'lookLag') || 8);
	if (dt >= 0.5) {
		camLook.set(carPos.x, carPos.y + aimWorld, carPos.z);
	} else {
		camLook.x += (carPos.x - camLook.x) * b;
		camLook.z += (carPos.z - camLook.z) * b;
		camLook.y = carPos.y + aimWorld;
	}
	camera.lookAt(camLook);
	camera.up.set(0, 1, 0);
	probeFraming(camera, carPos, carScale, dt);
}

function smooth(dt, rate) {
	if (!(rate > 0)) return 1;
	return exactLag
		? 1 - Math.exp(-dt * rate)
		: Math.min(dt * rate, 1);
}

const camLook = new THREE.Vector3();
const camFwd = new THREE.Vector3();
const camWant = new THREE.Vector3();
const mountOff = new THREE.Vector3();

const camArm = new THREE.Vector3();
const camAxis = new THREE.Vector3();

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function applyCamera(camera, vehicle, dt, opts) {

	const c = opts.preset || CAMERAS[defaultCamera()];
	if (!opts.preset && !warnedMissingPreset) {
		warnedMissingPreset = true;
		console.warn('[camera] no preset supplied — falling back to', defaultCamera());
	}
	if (!c || !vehicle || !vehicle.renderPos) return;

	const boomShort = c.mounted
		? 1
		: Math.min(1, (c.back * opts.zoom) / minBackOf(c));

	const zoom = c.zoomCap ? Math.min(opts.zoom, c.zoomCap) : opts.zoom;
	applyFov(camera, c, zoom, vehicle, dt, boomShort, opts.carScale);
	if (c.mounted) return applyMounted(camera, vehicle, c, opts.carScale);

	if (c.v2) return applyChaseV2(camera, vehicle, dt, opts, c);

	const carPos = vehicle.renderPos;

	camFwd.set(0, 0, -1).applyQuaternion(vehicle.renderQuat);
	camFwd.y = 0;
	if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1); else camFwd.normalize();

	const rawUnits = c.back * opts.zoom;
	const units = Math.max(rawUnits, minBackOf(c));
	const dist = units * opts.carScale;
	const boom = opts.carScale * opts.zoom;

	const liftPow = tuned(c, 'liftPow') ?? 0.5;
	const lift = opts.carScale * Math.pow(opts.zoom, liftPow);

	camArm.copy(camFwd).multiplyScalar(-dist);

	const rampDeg = rampTiltDeg(c, opts.zoom);
	camArm.y = rampDeg === undefined
		? c.up * lift
		: dist * Math.tan(THREE.MathUtils.degToRad(rampDeg));

	if (tiltTrim) {
		const horiz = Math.hypot(camArm.x, camArm.z);
		if (horiz > 1e-4) {
			const theta = Math.atan2(camArm.y, horiz)
				+ THREE.MathUtils.degToRad(tiltTrim);
			camArm.y = horiz * Math.tan(THREE.MathUtils.clamp(theta, -0.15, 1.25));
		}
	}

	if (viewYaw) camArm.applyAxisAngle(WORLD_UP, viewYaw);
	if (viewPitch) {

		camAxis.set(-camArm.z, 0, camArm.x);
		if (camAxis.lengthSq() > 1e-9) {
			camArm.applyAxisAngle(camAxis.normalize(), viewPitch);
		}
	}

	if (boomMode === 'rig' && !c.mounted) {
		return applyRig(camera, vehicle, dt, c, carPos, opts.carScale,
			Math.atan2(camFwd.x, camFwd.z));
	}
	camWant.copy(carPos).add(camArm);

	const steady = steadyOn(c);

	const offWant = (c.lockAim || steady) ? 1
		: Math.min(1, (Math.abs(viewYaw) + Math.abs(viewPitch)) / 0.16);
	if (!(dt < 1)) orbitAmt = offWant;
	else if (offWant >= orbitAmt) orbitAmt = offWant;
	else orbitAmt += (offWant - orbitAmt) * smooth(dt, ORBIT_RELEASE);

	if (orbitAmt < 0.01) orbitAmt = 0;
	const offAmt = orbitAmt;

	const pinFull = pinMode === true || steady || !!c.pinBoom;
	const pinAmt = pinMode === false ? 0 : pinFull ? 1 : offAmt;
	const pinR = pinFull ? pinRate : Math.min(pinRate, ORBIT_PIN_RATE);
	const pinned = pinAmt > 0;

	const a = smooth(dt, tuned(c, 'lag'));
	const ay = smooth(dt, tuned(c, 'lagY'));

	if (!pinAnchorOk || dt >= 1 || pinAnchorRate <= 0) {
		pinAnchor.copy(carPos);
		pinAnchorOk = true;
	} else {
		const k = smooth(dt, pinAnchorRate);
		pinAnchor.x += (carPos.x - pinAnchor.x) * k;
		pinAnchor.z += (carPos.z - pinAnchor.z) * k;

		pinAnchor.y = carPos.y;
	}
	if (pinned) {
		smoothPolar(camera, pinAnchor, a, smooth(dt, pinR * pinAmt));
	} else {
		camera.position.x += (camWant.x - camera.position.x) * a;
		camera.position.z += (camWant.z - camera.position.z) * a;
	}

	const nomR = Math.hypot(camArm.x, camArm.z);
	let wantY = camWant.y;

	let sweepY = null;
	if (boomMode !== 'classic' && !c.mounted && nomR > 1e-3) {
		const ox = camera.position.x - carPos.x;
		const oz = camera.position.z - carPos.z;
		const r = Math.hypot(ox, oz);

		const th = r > 1e-3 ? Math.atan2(oz, ox) : Math.atan2(camArm.z, camArm.x);
		if (boomMode === 'level') {

			const mul = BOOM_PULLS[boomPull] || 0;
			const rr = mul > 0
				? r + (nomR - r) * smooth(dt, tuned(c, 'lagY') * mul)
				: r;
			if (mul > 0 && r > 1e-3) {
				camera.position.x = carPos.x + Math.cos(th) * rr;
				camera.position.z = carPos.z + Math.sin(th) * rr;
			}
			const ratio = THREE.MathUtils.clamp(rr / nomR, TILT_R_MIN, TILT_R_MAX);
			wantY = carPos.y + camArm.y * ratio;
		} else if (boomMode === 'locked') {

			camera.position.x = carPos.x + camArm.x;
			camera.position.z = carPos.z + camArm.z;
		} else if (boomMode === 'sweep') {

			camera.position.x = carPos.x + Math.cos(th) * nomR;
			camera.position.z = carPos.z + Math.sin(th) * nomR;
			sweepY = rigGroundY(vehicle, carPos)
				+ CAR_BODY_CENTRE * opts.carScale + camArm.y;
		} else {

			const ax = boomMode === 'smooth' ? pinAnchor.x : carPos.x;
			const az = boomMode === 'smooth' ? pinAnchor.z : carPos.z;
			camera.position.x = ax + Math.cos(th) * nomR;
			camera.position.z = az + Math.sin(th) * nomR;
		}
	}

	if (sweepY !== null) {
		camera.position.y = sweepY;
	} else if (boomMode === 'locked' && !c.mounted) {
		camera.position.y = carPos.y + camArm.y;
	} else {
		camera.position.y += (wantY - camera.position.y) * ay;
	}

	const b = smooth(dt, tuned(c, 'lookLag'));
	const by = smooth(dt, tuned(c, 'lookLagY'));

	const ffRate = tuned(c, 'lookLag') || 8;
	if (!aimPrevOk || dt >= 0.5 || !(dt > 1e-4)) {
		aimVel.x = 0;
		aimVel.z = 0;
	} else {
		const kf = smooth(dt, AIM_FF_LAG);
		aimVel.x += ((carPos.x - aimPrev.x) / dt - aimVel.x) * kf;
		aimVel.z += ((carPos.z - aimPrev.z) / dt - aimVel.z) * kf;
	}
	aimPrev.x = carPos.x;
	aimPrev.z = carPos.z;
	const ffX = holdAim
		? THREE.MathUtils.clamp(aimVel.x / ffRate, -AIM_FF_LIMIT, AIM_FF_LIMIT) : 0;
	const ffZ = holdAim
		? THREE.MathUtils.clamp(aimVel.z / ffRate, -AIM_FF_LIMIT, AIM_FF_LIMIT) : 0;
	const bx = b + (1 - b) * offAmt;
	camLook.x += (carPos.x + ffX - camLook.x) * bx;
	camLook.z += (carPos.z + ffZ - camLook.z) * bx;

	const eyeH = camera.position.y - carPos.y;
	const eyeDist = Math.hypot(
		camera.position.x - carPos.x, camera.position.z - carPos.z);

	const solveFromEye = c.trueFrame || steady || pinned || holdFrame;

	const screenFrame = c.trueFrame;

	const eyeMix = (c.trueFrame || steady || c.pinBoom || pinMode === true || holdFrame)
		? 1 : offAmt;
	const h = eyeMix >= 1 ? eyeH
		: eyeMix <= 0 ? camArm.y
			: camArm.y + (eyeH - camArm.y) * eyeMix;

	const armRaw = Math.hypot(camArm.x, camArm.z);
	const armDist = Math.max(
		eyeMix >= 1 ? eyeDist
			: eyeMix <= 0 ? armRaw
				: armRaw + (eyeDist - armRaw) * eyeMix, 0.05);

	const halfFov = THREE.MathUtils.degToRad(liveFov || 62) * 0.5;

	const below = Math.atan2(h - CAR_BODY_CENTRE * opts.carScale, armDist);

	const below0 = c.frameBelow === undefined ? frameBelow : c.frameBelow;

	const target = screenFrame
		? Math.atan(below0 * Math.tan(halfFov))
		: below0 * halfFov;
	const aimWorld = c.aim === undefined
		? h + armDist * Math.tan(target - below)
		: c.aim * lift;

	const exactAim = c.trueFrame || steady;

	const tgtY = carPos.y + aimWorld;
	const ffRateY = tuned(c, 'lookLagY') || 4;
	if (!aimPrevOk || dt >= 0.5 || !(dt > 1e-4)) aimVel.y = 0;
	else aimVel.y += ((tgtY - aimPrev.y) / dt - aimVel.y) * smooth(dt, AIM_FF_LAG);
	aimPrev.y = tgtY;
	aimPrevOk = true;
	const ffY = holdAim
		? THREE.MathUtils.clamp(aimVel.y / ffRateY, -AIM_FF_LIMIT, AIM_FF_LIMIT) : 0;
	if (exactAim) camLook.y = tgtY;
	else camLook.y += (tgtY + ffY - camLook.y) * by;
	camera.lookAt(camLook);

	camera.up.set(0, 1, 0);

	probeFraming(camera, carPos, opts.carScale, dt);
}

function applyMounted(camera, vehicle, c, carScale) {
	const fwd = tuned(c, 'fwd');
	const up = tuned(c, 'up');
	const side = tuned(c, 'side') || 0;
	const pitch = tuned(c, 'pitch') || 0;
	mountOff.set(side * carScale, up * carScale, -fwd * carScale)
		.applyQuaternion(vehicle.renderQuat);
	camera.position.copy(vehicle.renderPos).add(mountOff);
	camera.quaternion.copy(vehicle.renderQuat);

	if (viewYaw) camera.rotateY(viewYaw);

	const totalPitch = pitch - viewPitch;
	if (totalPitch) camera.rotateX(totalPitch);

	camLook.copy(vehicle.renderPos);

	probe.ok = false;
}

let baseFov = 0;
function applyFov(camera, c, zoom, vehicle, dt, boomShort, carScale) {
	if (!baseFov) baseFov = camera.fov;
	let want = tuned(c, 'fov') || baseFov;

	if (c.mounted && zoom > 0) {
		const t = Math.tan(THREE.MathUtils.degToRad(want) * 0.5) * zoom;
		want = THREE.MathUtils.clamp(
			THREE.MathUtils.radToDeg(2 * Math.atan(t)), 24, 100);
	}

	if (boomShort !== undefined && boomShort < 1) {
		const t = Math.tan(THREE.MathUtils.degToRad(want) * 0.5) * boomShort;
		want = THREE.MathUtils.clamp(
			THREE.MathUtils.radToDeg(2 * Math.atan(t)), 24, 100);
	}

	if (fovTrim) want = THREE.MathUtils.clamp(want + fovTrim, 20, 110);

	const speed = (vehicle && vehicle.speedMs) || 0;
	const t = THREE.MathUtils.clamp(
		(speed - SPEED_FOV_V0) / (SPEED_FOV_V1 - SPEED_FOV_V0), 0, 1);

	const eased = t * t * (3 - 2 * t);
	speedFovNow += (speedFovGain * eased - speedFovNow) * smooth(dt, SPEED_FOV_LAG);

	const speedScale = steadyOn(c) ? 0
		: c.fixedFov ? 0
			: (c.speedFovScale === undefined ? 1 : c.speedFovScale);
	if (speedFovNow > 0.01 && speedScale > 0) {
		want = THREE.MathUtils.clamp(want + speedFovNow * speedScale, 20, 120);
	}

	if (fitOn(c) && !c.mounted && carScale > 0) {

		const dist = Math.max(c.back * zoom, minBackOf(c)) * carScale;

		const fitR = tuned(c, 'fitRadius') ?? CAR_FIT_RADIUS;
		const need = fitR * carScale * CAR_FIT_MARGIN;
		if (dist > 0) {
			const s = THREE.MathUtils.clamp(need / dist, 0, 0.999);
			const fitFov = Math.min(THREE.MathUtils.radToDeg(2 * Math.asin(s)), 120);

			const band = 6;
			const d = fitFov - want;
			if (d >= band) want = fitFov;
			else if (d > -band) want += (d + band) * (d + band) / (4 * band);
		}
	}

	want = Math.round(want * 50) / 50;
	liveFov = want;

	if (camera.fov !== want) {
		camera.fov = want;
		camera.updateProjectionMatrix();
	}
}
