

const common = {
	format: ['progress-bar', 'summary'],
	formatOptions: { snippetInterface: 'skip' },
	strict: true,
};

export const artefact = {
	...common,
	paths: ['features/artefact/**/*.feature'],
	import: ['features/support/shared.mjs', 'features/support/artefact.steps.mjs'],
	timeout: 180000,
};

export const live = {
	...common,
	paths: ['features/live/**/*.feature'],
	import: ['features/support/shared.mjs', 'features/support/live.steps.mjs'],
	timeout: 120000,
};

export default artefact;
