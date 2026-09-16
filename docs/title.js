

import * as THREE from 'three';
import { ringsFrom, landMask, buildGlobe, rng } from './strata-globe.js?v=482ef01b2c';
import { seedCars, stepCars, CAR_LENGTH } from './titletraffic.js?v=482ef01b2c';

const WORDS = {
	mark: 'STRATA',
	play: 'Play',
	info: 'i',
	about: 'About',
	levels: 'Levels',
	close: 'Close',
};

const CSS = `
#title {
	position: fixed; inset: 0; z-index: 9500;
	background: #05070d; color: #e8edf6;
	font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	-webkit-font-smoothing: antialiased;
	overflow: hidden;
	transition: opacity 260ms ease;
}
#title.gone { opacity: 0; pointer-events: none; }
#title .t-stage { position: absolute; inset: 0; cursor: grab; touch-action: none; }
#title .t-stage.turning { cursor: grabbing; }
#title .t-stage canvas { display: block; width: 100%; height: 100%; }
#title .t-word {
	position: absolute; left: 0; right: 0; top: 40%; z-index: 2;
	transform: translateY(-50%); pointer-events: none;
	text-align: center; margin: 0;
	font-size: clamp(30px, min(8vw, 10vh), 78px); font-weight: 700;
	letter-spacing: 0.34em; text-indent: 0.34em; line-height: 1;
}
#title .t-word .wall, #title .t-word .face {
	display: block; -webkit-text-stroke-color: #05070d; paint-order: stroke fill;
}
#title .t-word .wall { position: absolute; left: 0; right: 0; top: 0; }
#title .t-word .face { position: relative; color: #e8edf6; user-select: none; }
#title .t-col {
	position: absolute; left: 50%; transform: translateX(-50%); z-index: 3;
	bottom: calc(max(28px, 6vh) + env(safe-area-inset-bottom, 0px));
	width: min(320px, 80vw);
	display: flex; flex-direction: column; align-items: center;
}
#title button {
	font: inherit; font-size: 15px; letter-spacing: 0.04em;
	color: #e8edf6; background: rgba(12,16,24,0.62);
	border: 1px solid rgba(232,237,246,0.18); border-radius: 10px;
	padding: 12px 18px; cursor: pointer; text-align: center;
	backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
	transition: background 0.16s, border-color 0.16s, transform 0.16s;
}
#title button:hover, #title button:focus-visible {
	background: rgba(40,46,58,0.78); border-color: rgba(232,237,246,0.38); outline: none;
}
#title button:active { transform: translateY(1px); }
#title .t-col button.t-primary {
	width: 100%; padding: 17px 18px; font-size: 19px; font-weight: 650; letter-spacing: 0.06em;
	background: rgba(232,237,246,0.94); color: #0a0d14; border-color: transparent;
}
#title .t-col button.t-primary:hover, #title .t-col button.t-primary:focus-visible { background: #fff; }
#title button.t-word-hit, #title button.t-word-hit:hover, #title button.t-word-hit:focus-visible {
	position: absolute; z-index: 2; padding: 0; margin: 0;
	background: transparent; border: 0; border-radius: 8px;
	backdrop-filter: none; -webkit-backdrop-filter: none; transform: none;
}
#title .t-word { transition: filter 0.16s, opacity 0.35s; }
#title .t-col, #title .t-info, #title .t-word-hit { transition: opacity 0.35s; }
/* RINGLAB: while driving the wordmark, Play and "i" fade out and stop taking clicks. */
#title.driving .t-word, #title.driving .t-col, #title.driving .t-info, #title.driving .t-word-hit {
	opacity: 0; pointer-events: none;
}
#title.driving .t-stage { cursor: default; }
#title .t-word-hit:hover + .t-word { filter: brightness(1.18); }
#title .t-info {
	position: absolute; z-index: 3;
	top: calc(14px + env(safe-area-inset-top, 0px)); right: calc(14px + env(safe-area-inset-right, 0px));
	width: 40px; height: 40px; padding: 0; border-radius: 50%;
	display: flex; align-items: center; justify-content: center;
	font: italic 600 19px/1 Georgia, "Times New Roman", serif; letter-spacing: 0;
}
#title .t-modal {
	position: absolute; inset: 0; z-index: 4;
	display: flex; align-items: center; justify-content: center;
	padding: 16px; background: rgba(3,5,10,0.55);
	backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
}
#title .t-modal[hidden] { display: none; }
#title .t-card {
	position: relative;
	width: min(420px, 100%); overflow: hidden; transform-origin: center center;
	display: flex; flex-direction: column; gap: 10px;
	background: rgba(11,15,23,0.94); border: 1px solid rgba(232,237,246,0.16); border-radius: 14px;
	padding: 22px 24px; box-shadow: 0 18px 60px rgba(0,0,0,0.5);
}
#title .t-card h2, #title .t-card h3 {
	margin: 6px 0 4px; font-size: 12px; letter-spacing: 0.14em; font-weight: 600;
	text-transform: uppercase; color: #e8edf6;
}
#title .t-card > h2:first-child, #title .t-card > h3:first-child { margin-top: 0; }
#title .t-card.t-wide { width: min(600px, 100%); gap: 6px; }
#title .t-card p { margin: 0 0 4px; color: #b6c0d0; font-size: 13.5px; }
#title .t-card.t-wide p { font-size: 13px; line-height: 1.5; }
#title .t-card a { color: #b6c0d0; }
#title .t-card .dim { color: #7d8899; font-size: 12px; }
#title .t-card .t-head, #title .t-card .t-foot { display: flex; align-items: center; gap: 12px; }
#title .t-card .t-head { justify-content: space-between; }
#title .t-card .t-foot { justify-content: flex-start; margin-top: 6px; }
#title .t-card .t-head h2 { margin: 0; }
#title .t-card .t-body { display: flex; flex-direction: column; gap: inherit; }
#title .t-card.t-wide .t-body { gap: 6px; }
#title .t-card .t-body button { width: 100%; }
#title .t-card button.t-close {
	width: auto; padding: 9px 22px; border-radius: 999px;
	background: transparent; border: 1px solid rgba(232,237,246,0.34);
	backdrop-filter: none; -webkit-backdrop-filter: none;
	font-size: 14px; letter-spacing: 0.05em; color: #e8edf6;
}
#title .t-card button.t-close:hover, #title .t-card button.t-close:focus-visible {
	background: rgba(232,237,246,0.08); border-color: rgba(232,237,246,0.6);
}
`;

export function mountTitle({ levels, worldUrl = './world.json', onPick }) {
	const style = document.createElement('style');
	style.textContent = CSS;
	document.head.appendChild(style);

	const root = document.createElement('div');
	root.id = 'title';
	document.body.appendChild(root);

	const stage = document.createElement('div');
	stage.className = 't-stage';
	root.appendChild(stage);

	const word = document.createElement('h1');
	word.className = 't-word';
	word.dataset.text = WORDS.mark;
	root.appendChild(word);

	const col = document.createElement('nav');
	col.className = 't-col';
	root.appendChild(col);

	const button = (text, cls) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		if (cls) b.className = cls;
		return b;
	};

	let open = null;
	let opener = null;
	const modal = (heading, wide = false) => {
		const m = document.createElement('div');
		m.className = 't-modal';
		m.hidden = true;
		m.setAttribute('role', 'dialog');
		m.setAttribute('aria-modal', 'true');
		const card = document.createElement('div');
		card.className = wide ? 't-card t-wide' : 't-card';

		const head = document.createElement('div');
		head.className = 't-head';
		const h = document.createElement('h2');
		h.textContent = heading || '';
		head.appendChild(h);
		const top = button(WORDS.close, 't-close');
		top.addEventListener('click', () => close());
		head.appendChild(top);
		card.appendChild(head);
		const body = document.createElement('div');
		body.className = 't-body';
		card.appendChild(body);
		const foot = document.createElement('div');
		foot.className = 't-foot';
		const bottom = button(WORDS.close, 't-close');
		bottom.addEventListener('click', () => close());
		foot.appendChild(bottom);
		card.appendChild(foot);
		m.appendChild(card);
		m.addEventListener('click', (e) => { if (e.target === m) close(); });
		root.appendChild(m);
		return { el: m, card, body, heading: h };
	};

	function fit(m) {
		m.card.style.transform = '';
		const availH = m.el.clientHeight - 32;
		const availW = m.el.clientWidth - 32;
		const k = Math.min(1, availH / m.card.offsetHeight, availW / m.card.offsetWidth);
		if (k < 1) m.card.style.transform = `scale(${k.toFixed(3)})`;
	}
	function show(m, from, keyboard) {
		if (open) open.el.hidden = true;
		open = m;
		opener = from;
		m.el.hidden = false;
		fit(m);
		if (keyboard) {
			const first = m.body.querySelector('button') || m.el.querySelector('.t-close');
			if (first) first.focus({ preventScroll: true });
		}
	}
	function close() {
		if (!open) return;
		open.el.hidden = true;
		open = null;
		if (opener && document.activeElement && root.contains(document.activeElement)) opener.focus();
	}

	const list = modal(WORDS.levels);
	let picked = false;
	for (const l of levels) {
		const b = button(l.name);
		b.addEventListener('click', () => pick(l.cut));
		list.body.append(b);
	}

	const about = modal(null, true);
	const source = document.getElementById('page-about');
	if (source) {
		for (const n of source.childNodes) about.body.appendChild(n.cloneNode(true));

		const first = about.body.firstElementChild;
		if (first && first.tagName === 'H3') {
			about.heading.textContent = first.textContent;
			first.remove();
		}
	}

	const playBtn = button(WORDS.play, 't-primary');
	playBtn.addEventListener('click', (e) => show(list, playBtn, e.detail === 0));
	col.append(playBtn);

	const wordHit = button('', 't-word-hit');
	wordHit.setAttribute('aria-label', WORDS.play);
	wordHit.tabIndex = -1;

	wordHit.addEventListener('click', (e) => {
		if (STRATA_STARTS_DRIVE && scene3d) startDrive();
		else show(list, playBtn, e.detail === 0);
	});
	root.insertBefore(wordHit, word);
	function seatWordHit() {
		const face = word.querySelector('.face');
		if (!face) return;
		const range = document.createRange();
		range.selectNodeContents(face);
		const r = range.getBoundingClientRect();
		const box = root.getBoundingClientRect();
		wordHit.style.left = `${Math.round(r.left - box.left)}px`;
		wordHit.style.top = `${Math.round(r.top - box.top)}px`;
		wordHit.style.width = `${Math.round(r.width)}px`;
		wordHit.style.height = `${Math.round(r.height)}px`;
	}

	if (source) {
		const info = button(WORDS.info, 't-info');
		info.setAttribute('aria-label', WORDS.about);
		info.title = WORDS.about;
		info.addEventListener('click', (e) => show(about, info, e.detail === 0));
		root.appendChild(info);
	}

	const onKey = (e) => {

		if (e.key === 'Enter' && !open && scene3d && !scene3d.driving()) {
			if (document.activeElement && root.contains(document.activeElement)
				&& document.activeElement.tagName === 'BUTTON') return;
			e.preventDefault();
			startDrive();
			return;
		}
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopImmediatePropagation();
		if (open) close();
		else if (scene3d && scene3d.driving()) stopDrive();
	};
	window.addEventListener('keydown', onKey, true);

	let scene3d = null;
	function startDrive() {
		if (!scene3d || picked) return;
		close();
		root.classList.add('driving');
		scene3d.drive(root, () => root.classList.remove('driving'));
	}
	function stopDrive() {
		if (scene3d) scene3d.home();
	}
	try {
		scene3d = buildScene(stage, word, col);
		scene3d.load(worldUrl);
	} catch (e) {
		scene3d = null;
	}

	function layout() {
		extrudeWordmark(word);
		if (scene3d) scene3d.resize();
		seatWordHit();
		if (open) fit(open);
	}
	window.addEventListener('resize', layout);
	layout();

	function dispose() {
		window.removeEventListener('keydown', onKey, true);
		window.removeEventListener('resize', layout);
		if (scene3d) scene3d.dispose();
		scene3d = null;
		root.remove();
		style.remove();
	}

	function pick(cut) {
		if (picked) return;
		picked = true;
		for (const b of root.querySelectorAll('button')) b.disabled = true;
		root.classList.add('gone');

		if (scene3d) {
			scene3d.stop();
			scene3d.release();
		}
		onPick(cut);
		setTimeout(dispose, 280);
	}

	return { dispose };
}

const SKY = 0x05070d;
const LOOK = {
	land: 0x74c65c, landAlt: 0x74c65c, ocean: 0x2f7ac6,
	sun: 0xfff3dd, ambient: 0x4d5c78,
	glow: 0xffc07a, glowAmount: 0.10, rim: 0x5f9fe0,
	band: 0.0, jitter: 0.09, wrap: 0.40,
	road: { asphalt: '#43474e', edge: '#f2f4f7', lane: '#f2f4f7', centre: '#ffd23f' },
	stars: 0.75,
};

const CAM_HEIGHT = 0.95;
const CAM_DIST = 6.6;
const CAM_TARGET = new THREE.Vector3(0, -0.30, 0);
const LIGHT_DIR = new THREE.Vector3(1, 0.35, 0.6).normalize();
const RELIEF = 0.016;

const R_IN = 1.30, R_OUT = 1.58, R_THICK = 0.035, R_SEGS = 220;

const FRAME_TOP = 28;
const FRAME_SIDE = 16;
const FRAME_ABOVE_PLAY = 28;

const EARTH_SPIN = 0.035;
const RING_SPIN = 0.012;

const STRATA_STARTS_DRIVE = true;

const SPIN_WHILE_DRIVING = { earth: false, ring: false };

function buildScene(stage, word, col) {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	stage.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(SKY);
	const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

	const sun = new THREE.DirectionalLight(0xffffff, 2.6);
	sun.position.copy(LIGHT_DIR).multiplyScalar(10);
	scene.add(sun);
	scene.add(new THREE.AmbientLight(0xffffff, 0.55));

	const stars = makeStars(77002, 1400, 60);
	const starsBright = makeStars(31337, 90, 58);
	starsBright.material.size = 3.2;
	stars.material.opacity = LOOK.stars;
	starsBright.material.opacity = LOOK.stars;
	scene.add(stars, starsBright);

	const earth = new THREE.Group();
	scene.add(earth);
	let globe = null;
	let mask = null;
	let disposed = false;

	function load(worldUrl) {
		fetch(worldUrl, { cache: 'force-cache' })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((world) => {
				if (disposed) return;
				mask = landMask(ringsFrom(world));
				globe = buildGlobe(mask, { detail: 15, relief: RELIEF });
				const u = globe.uniforms;
				u.uLightDir.value.copy(LIGHT_DIR);
				u.uLand.value.setHex(LOOK.land);
				u.uLandAlt.value.setHex(LOOK.landAlt);
				u.uOcean.value.setHex(LOOK.ocean);
				u.uSun.value.setHex(LOOK.sun);
				u.uAmbient.value.setHex(LOOK.ambient);
				u.uGlow.value.setHex(LOOK.glow);
				u.uRim.value.setHex(LOOK.rim);
				u.uGlowAmount.value = LOOK.glowAmount;
				u.uBandAmount.value = LOOK.band;
				u.uJitAmount.value = LOOK.jitter;
				u.uWrap.value = LOOK.wrap;
				earth.add(globe.mesh);
			})
			.catch(() => {   });
	}

	const roadMat = new THREE.MeshLambertMaterial({
		map: roadTexture(LOOK.road, renderer), side: THREE.DoubleSide,
	});
	const rimMat = new THREE.MeshLambertMaterial({
		color: parseInt(LOOK.road.edge.slice(1), 16), side: THREE.DoubleSide,
	});

	const ring = new THREE.Group();
	const spin = new THREE.Group();
	ring.add(spin);
	spin.add(new THREE.Mesh(roadBand(R_IN, R_OUT, R_THICK / 2, false), roadMat));
	spin.add(new THREE.Mesh(roadBand(R_IN, R_OUT, -R_THICK / 2, true), roadMat));
	for (const r of [R_IN, R_OUT]) {
		spin.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, R_THICK, R_SEGS, 1, true), rimMat));
	}

	ring.rotation.z = 0.248;
	ring.rotation.x = 0.181;
	scene.add(ring);

	const traffic = seedTraffic(spin, 22, 4471);

	let drag = null;
	let velocity = 0;
	const onDown = (e) => {
		if (e.button !== 0) return;
		if (driver && driver.active) return;
		drag = { x: e.clientX, fromY: earth.rotation.y };
		stage.setPointerCapture(e.pointerId);
		stage.classList.add('turning');
	};
	const onMove = (e) => {
		if (!drag) return;
		const was = earth.rotation.y;
		earth.rotation.y = drag.fromY + (e.clientX - drag.x) * 0.006;
		velocity = earth.rotation.y - was;
	};
	const onUp = () => {
		drag = null;
		stage.classList.remove('turning');
	};
	stage.addEventListener('pointerdown', onDown);
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', onUp);
	window.addEventListener('pointercancel', onUp);

	const PROBE = new THREE.Vector3();
	function extent() {
		ring.updateMatrixWorld(true);
		camera.updateMatrixWorld(true);
		const w = stage.clientWidth, h = stage.clientHeight;
		const y = () => (1 - PROBE.y) / 2 * h;
		const x = () => (PROBE.x + 1) / 2 * w;
		PROBE.copy(earth.position).project(camera);
		const centre = y(), cx = x();
		PROBE.set(0, -(1 + RELIEF), 0).project(camera);
		let low = y();
		PROBE.set(0, 1 + RELIEF, 0).project(camera);
		let high = y();
		let half = Math.abs(low - high) / 2;
		for (let i = 0; i < 72; i++) {
			const a = (i / 72) * Math.PI * 2;
			PROBE.set(Math.cos(a) * R_OUT, 0, Math.sin(a) * R_OUT);
			ring.localToWorld(PROBE);
			PROBE.project(camera);
			low = Math.max(low, y());
			high = Math.min(high, y());
			half = Math.max(half, Math.abs(x() - cx));
		}
		return { high, low, half, centre };
	}

	function resize() {
		const w = stage.clientWidth, h = stage.clientHeight;
		if (!w || !h) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;

		if (driver && driver.active) {
			camera.updateProjectionMatrix();
			return;
		}
		camera.clearViewOffset();
		camera.position.set(0, CAM_HEIGHT, CAM_DIST);
		camera.lookAt(CAM_TARGET);
		camera.updateProjectionMatrix();
		const top = FRAME_TOP;
		const bottom = col.offsetTop - FRAME_ABOVE_PLAY;
		const roomH = Math.max(80, bottom - top);
		const roomW = Math.max(80, w - 2 * FRAME_SIDE);
		let e = extent();
		for (let i = 0; i < 3; i++) {
			const need = Math.max((e.low - e.high) / roomH, (2 * e.half) / roomW);
			camera.position.multiplyScalar(need);
			camera.lookAt(CAM_TARGET);
			e = extent();
		}
		const offset = (e.high + e.low) / 2 - (top + bottom) / 2;
		if (Math.abs(offset) > 0.5) camera.setViewOffset(w, h, 0, offset, w, h);
		word.style.top = `${Math.round(e.centre - offset)}px`;
	}

	let driver = null;
	let driverModule = null;
	const loadDriver = () => (driverModule ||= import('./ringdrive.js?v=482ef01b2c'));
	const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
	idle(() => { if (!disposed) loadDriver().catch(() => { driverModule = null; }); }, { timeout: 3000 });

	const spinRate = { earth: 1, ring: 1 };

	function ringTop() {
		return spin.children[0];
	}
	async function drive(uiRoot, onHome) {
		const pressed = performance.now();
		const mod = await loadDriver();
		if (disposed || handedBack) return;
		if (!driver) {
			driver = mod.createDriver({
				THREE, scene, camera, renderer, stage, uiRoot, ring, spin, earth,
				getGlobe: () => globe, getMask: () => mask, ringTop, roadMat, rimMat, makeCar, traffic,
				R_IN, R_OUT, R_THICK, R_SEGS, LIGHT_DIR, RELIEF, CAR_LENGTH,
				homeFraming: () => { resize(); },
				onHome: () => onHome(),
			});
		}
		driver.start(pressed);
	}
	function home() { if (driver) driver.home(); }
	const driving = () => !!(driver && driver.active);

	let handedBack = false;
	function release() {
		handedBack = true;
		if (driver) driver.release();
	}

	const clock = new THREE.Clock();
	renderer.setAnimationLoop(() => {
		const dt = Math.min(clock.getDelta(), 0.1);
		const busy = driving();
		const ease = 1 - Math.exp(-dt * 3);
		spinRate.earth += ((busy && !SPIN_WHILE_DRIVING.earth ? 0 : 1) - spinRate.earth) * ease;
		spinRate.ring += ((busy && !SPIN_WHILE_DRIVING.ring ? 0 : 1) - spinRate.ring) * ease;
		if (!drag) {
			earth.rotation.y += dt * EARTH_SPIN * spinRate.earth;
			spin.rotation.y -= dt * RING_SPIN * spinRate.ring;
			if (Math.abs(velocity) > 0.0001) {
				earth.rotation.y += velocity;
				velocity *= 0.94;
			}
		}
		driveTraffic(traffic, dt);
		if (driver) driver.frame(dt);
		if (globe) globe.uniforms.uCam.value.copy(camera.position);
		renderer.render(scene, camera);
	});

	function stop() { renderer.setAnimationLoop(null); }

	function dispose() {
		if (disposed) return;
		disposed = true;
		stop();
		if (driver) {
			driver.dispose();
			driver = null;
		}
		stage.removeEventListener('pointerdown', onDown);
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onUp);
		const seen = new Set();
		scene.traverse((o) => {
			if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
			for (const m of [].concat(o.material || [])) {
				if (seen.has(m)) continue;
				seen.add(m);
				if (m.map) m.map.dispose();
				if (m.uniforms && m.uniforms.uMask) m.uniforms.uMask.value.dispose();
				m.dispose();
			}
		});
		renderer.dispose();
		renderer.forceContextLoss();
		renderer.domElement.remove();
	}

	return { load, resize, stop, dispose, drive, home, driving, release };
}

function makeStars(seed, count, radius) {
	const pos = new Float32Array(count * 3);
	const col = new Float32Array(count * 3);
	const next = rng(seed);
	const c = new THREE.Color();
	for (let i = 0; i < count; i++) {

		const z = next() * 2 - 1;
		const t = next() * Math.PI * 2;
		const r = Math.sqrt(1 - z * z);
		pos[i * 3] = Math.cos(t) * r * radius;
		pos[i * 3 + 1] = z * radius;
		pos[i * 3 + 2] = Math.sin(t) * r * radius;
		const warm = next();
		c.setHSL(warm < 0.18 ? 0.08 : warm > 0.88 ? 0.58 : 0.12, warm < 0.18 || warm > 0.88 ? 0.45 : 0.05,
			0.55 + next() * 0.45);
		col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	const mat = new THREE.PointsMaterial({
		size: 1.7, sizeAttenuation: false, vertexColors: true,
		transparent: true, depthWrite: false,
	});
	return new THREE.Points(geo, mat);
}

function roadTexture(paint, renderer) {
	const c = document.createElement('canvas');
	c.width = 512; c.height = 128;
	const ctx = c.getContext('2d');
	ctx.fillStyle = paint.asphalt;
	ctx.fillRect(0, 0, 512, 128);
	ctx.fillStyle = paint.edge;
	ctx.fillRect(0, 2, 512, 4);
	ctx.fillRect(0, 122, 512, 4);
	ctx.fillStyle = paint.centre;
	ctx.fillRect(0, 59, 512, 3);
	ctx.fillRect(0, 66, 512, 3);
	ctx.fillStyle = paint.lane;
	for (let i = 0; i < 8; i++) {
		ctx.fillRect(i * 64 + 12, 33, 36, 3);
		ctx.fillRect(i * 64 + 12, 92, 36, 3);
	}
	const t = new THREE.CanvasTexture(c);
	t.wrapS = THREE.RepeatWrapping;
	t.wrapT = THREE.ClampToEdgeWrapping;
	t.repeat.set(34, 1);
	t.anisotropy = renderer.capabilities.getMaxAnisotropy();
	return t;
}

function roadBand(inner, outer, y, flip) {
	const pos = [], uv = [], idx = [];
	for (let i = 0; i <= R_SEGS; i++) {
		const a = (i / R_SEGS) * Math.PI * 2;
		const ca = Math.cos(a), sa = Math.sin(a);
		pos.push(ca * inner, y, sa * inner, ca * outer, y, sa * outer);
		uv.push(i / R_SEGS, 0, i / R_SEGS, 1);
	}
	for (let i = 0; i < R_SEGS; i++) {
		const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
		if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

const CAR_Y = R_THICK / 2;
const CAR_W = 1.02, CAR_L = 2.24;
const CAR_SCALE = CAR_LENGTH / CAR_L;
const CAR_PAINT = [0xe0574a, 0x3f8fd6, 0xf0c04a, 0xe8e6e2, 0x4fb07a, 0x8a6fc4, 0xe08a3c, 0x66707e];

const HEAD_COLOUR = new THREE.Color(0.85, 0.56, 0.14);
const TAIL_COLOUR = new THREE.Color(0.34, 0.02, 0.01);
const BRAKE_COLOUR = new THREE.Color(1.0, 0.07, 0.03);
const LAMP_SIZE = 0.22;

let lampGeo = null;
let headMat = null;
function lampPair(face, y, halfX, material) {
	if (!lampGeo) lampGeo = new THREE.BoxGeometry(LAMP_SIZE * 1.5, LAMP_SIZE, LAMP_SIZE * 0.6);
	const g = new THREE.Group();
	const z = face + Math.sign(face) * (LAMP_SIZE * 0.3 - 0.01);
	for (const sx of [-1, 1]) {
		const m = new THREE.Mesh(lampGeo, material);
		m.position.set(sx * halfX, y, z);
		g.add(m);
	}
	return g;
}

function makeCar(colour) {
	const g = new THREE.Group();
	const paint = new THREE.MeshLambertMaterial({ color: colour, flatShading: true });
	const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_W, 0.36, CAR_L), paint);
	body.position.y = 0.28;
	g.add(body);
	const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR_W * 0.82, 0.30, CAR_L * 0.46), paint);
	cabin.position.set(0, 0.58, -0.10);
	g.add(cabin);
	if (!headMat) {
		headMat = new THREE.MeshBasicMaterial({
			color: HEAD_COLOUR, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
		});
	}
	g.add(lampPair(CAR_L / 2, 0.30, 0.32, headMat));
	const tail = new THREE.MeshBasicMaterial({ color: TAIL_COLOUR.clone() });
	g.add(lampPair(-CAR_L / 2, 0.34, 0.34, tail));
	g.scale.setScalar(CAR_SCALE);
	return { group: g, tail };
}

function seedTraffic(ring, count, seed) {
	const cars = seedCars({ count, next: rng(seed), rIn: R_IN, rOut: R_OUT });
	const traffic = cars.map((car) => {
		const drawn = makeCar(CAR_PAINT[Math.floor(car.paint * CAR_PAINT.length)]);
		ring.add(drawn.group);
		return { car, mesh: drawn.group, tail: drawn.tail, braking: null };
	});
	lampGeo = null;
	headMat = null;
	return { cars, traffic };
}

function driveTraffic({ cars, traffic }, dt) {
	stepCars(cars, dt);
	for (const t of traffic) {
		const c = t.car;
		t.mesh.position.set(Math.cos(c.angle) * c.r, CAR_Y, Math.sin(c.angle) * c.r);
		t.mesh.rotation.y = c.yaw;
		if (t.braking !== c.braking) {
			t.braking = c.braking;
			t.tail.color.copy(c.braking ? BRAKE_COLOUR : TAIL_COLOUR);
		}
	}
}

const FACE_NEAR = [0x93, 0xa2, 0xb8];
const FACE_FAR = [0x1c, 0x24, 0x33];
const TEXT_DIR = 33 * Math.PI / 180;
const TEXT_DEPTH = 0.170;
const TEXT_STROKE = 0.048;
const TEXT_DROP = 0.56;

function extrudeWordmark(word) {
	const size = parseFloat(getComputedStyle(word).fontSize) || 48;
	const steps = Math.max(3, Math.round(size * TEXT_DEPTH));
	const stroke = Math.max(0, Math.round(size * TEXT_STROKE));
	const dx = Math.cos(TEXT_DIR), dy = Math.sin(TEXT_DIR);
	const text = word.dataset.text || '';
	word.replaceChildren();
	for (let i = steps; i >= 1; i--) {
		const t = i / steps;
		const c = FACE_NEAR.map((n, k) => Math.round(n + (FACE_FAR[k] - n) * t));
		const layer = document.createElement('span');
		layer.className = 'wall';
		layer.textContent = text;
		layer.style.transform = `translate(${(dx * i).toFixed(2)}px, ${(dy * i).toFixed(2)}px)`;
		layer.style.color = `rgb(${c[0]},${c[1]},${c[2]})`;
		layer.style.webkitTextStrokeWidth = `${stroke}px`;
		if (i === steps && TEXT_DROP > 0) {
			const off = 7 * TEXT_DROP;
			layer.style.textShadow = `${(dx * off).toFixed(1)}px ${(dy * off).toFixed(1)}px `
				+ `${(steps * TEXT_DROP).toFixed(1)}px rgba(3,5,10,${(TEXT_DROP * 0.9).toFixed(2)})`;
		}
		word.append(layer);
	}
	const face = document.createElement('span');
	face.className = 'face';
	face.textContent = text;
	face.style.webkitTextStrokeWidth = `${stroke}px`;
	word.append(face);
}
