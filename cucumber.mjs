// Two profiles, because the two suites answer different questions and fail for
// different reasons.
//
//   artefact — reads the files in docs/ that are about to ship. Runs on every
//              commit. Its only outbound calls are to the npm registry and the
//              OSV vulnerability database, both addressed by exact version, so
//              a run is reproducible.
//
//   live     — asks the public internet about https://drivestrata.io. Runs on a
//              daily schedule rather than per commit, because it depends on
//              Cloudflare, on third-party attribution hosts, and on whether a
//              GitHub runner is being rate limited today. None of those are
//              facts about this repository, and none of them should be able to
//              redden a commit.
//
// The profiles load different step definitions, so the artefact suite never
// needs a browser installed.

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
