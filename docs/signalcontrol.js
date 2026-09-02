

export function stateChar(state, link) {
	if (!Number.isInteger(link) || link < 0 || link >= state.length) return null;
	return state[link];
}

export function lampOf(lamps, ch) {
	if (ch === null) return -1;
	const mask = lamps[ch];
	if (!mask) return -1;
	for (let i = 0; i < 3; i++) if (mask[i]) return i;
	return -1;
}

export function stateAt(c, timeS) {
	if (!c.phases.length) return 'r';
	let cycle = c.cycle_s > 0 ? c.cycle_s : 0;
	if (!(cycle > 0)) cycle = c.phases.reduce((n, p) => n + p[0], 0);
	if (!(cycle > 0)) return c.phases[0][1];

	let t = (((timeS + c.offset) % cycle) + cycle) % cycle;
	for (const [dur, state] of c.phases) {
		if (t < dur) return state;
		t -= dur;
	}
	return c.phases[c.phases.length - 1][1];
}

export function isGo(ch) {
	return ch === 'G' || ch === 'g';
}

export function isStop(ch) {
	return ch === 'r' || ch === 's' || ch === 'y' || ch === 'Y' || ch === 'u';
}

export function classifyPhase(state) {
	if (/[yY]/.test(state)) return 'amber';
	if (/[Gg]/.test(state)) return 'green';
	return 'allRed';
}

export function clearanceState(state) {
	return state.replace(/[yYu]/g, 'r');
}

export function dominantBearing(yaws) {
	if (!yaws.length) return 0;
	let sx = 0;
	let sy = 0;
	for (const y of yaws) {
		sx += Math.cos(2 * y);
		sy += Math.sin(2 * y);
	}
	if (sx === 0 && sy === 0) return 0;
	return 0.5 * Math.atan2(sy, sx);
}

export const DEFAULT_TIMING = {

	targetCycleS: 48,

	minGreenS: 8,

	maxGreenS: 40,

	amberS: 4,

	allRedS: 2,

	progressionMS: 13.4,

	bearingRad: 0,
};

export function retime(controllers, timing = DEFAULT_TIMING, sites = []) {
	const cos = Math.cos(timing.bearingRad);
	const sin = Math.sin(timing.bearingRad);

	return controllers.map((c, i) => {

		const kinds = c.phases.map((p) => classifyPhase(p[1]));
		const nGreen = kinds.filter((k) => k === 'green').length;
		const nAmber = kinds.filter((k) => k === 'amber').length;
		const nAllRed = kinds.filter((k) => k === 'allRed').length;
		const transitions = nAmber * (timing.amberS + timing.allRedS) + nAllRed * timing.allRedS;
		const greenEach = Math.min(
			timing.maxGreenS,
			Math.max(timing.minGreenS,
				(timing.targetCycleS - transitions) / Math.max(nGreen, 1)));

		const phases = [];
		for (const [, state] of c.phases) {
			const kind = classifyPhase(state);
			if (kind === 'green') {
				phases.push([greenEach, state]);
			} else if (kind === 'amber') {
				phases.push([timing.amberS, state]);

				if (timing.allRedS > 0) phases.push([timing.allRedS, clearanceState(state)]);
			} else {
				phases.push([timing.allRedS > 0 ? timing.allRedS : 1, state]);
			}
		}
		const cycle = phases.reduce((n, p) => n + p[0], 0);

		let offset = 0;
		const site = sites[i];
		if (timing.progressionMS > 0 && site && cycle > 0) {
			const along = site.x * cos + site.z * sin;
			offset = (((-along / timing.progressionMS) % cycle) + cycle) % cycle;
		}

		return { id: c.id, offset, cycle_s: cycle, phases };
	});
}
