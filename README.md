# Strata

[![artefact](https://github.com/worldtodrive/strata/actions/workflows/artefact.yml/badge.svg)](https://github.com/worldtodrive/strata/actions/workflows/artefact.yml)
[![live](https://github.com/worldtodrive/strata/actions/workflows/live.yml/badge.svg)](https://github.com/worldtodrive/strata/actions/workflows/live.yml)

This project sits on the boundary between cozy driving game and geospatial simulation with an ambitious goal: drive anywhere in the world at 1:1 scale using open data and procedural generation.

Starting with familiar locations in Dallas, TX that I knew from my time living there in undergrad, I plan to highlight various drivable levels of cities that I personally know as POCs of the system before scaling more globally.

For the first release, there are two demo levels (both in Dallas):
1. High Five overpass system (US-75 x I-635)
2. The Village (my old neighborhood)

# Playable Demo here:

* https://drivestrata.io


## What is checked

This repository is a build output: the files served at drivestrata.io, and
nothing else. Two workflows run against it. Both are meant to be read — the
checks are plain-English `.feature` files under `features/`, so what is asserted
can be seen without reading the code that asserts it.

**On every commit** — [`artefact.yml`](.github/workflows/artefact.yml)

* No file exceeds the 25 MiB hosting limit. The largest today is 23.03 MiB, and
  going over it breaks the deploy rather than degrading it.
* The Content-Security-Policy permits the page to contact its own origin and
  nothing else, and no first-party script names an external URL.
* The three vendored libraries — three.js 0.160.0, Rapier 0.19.3, and the
  meshoptimizer 1.0.1 decoder — are downloaded from npm and compared byte for
  byte. Recorded fingerprints are checked first, but the download is the proof:
  a hash committed here would only show a file has not changed since someone
  wrote the hash down.
* The licence texts that MIT and Apache-2.0 require to travel with the code are
  present, and NOTICE names the version of every library that actually ships.
* No secrets, in the working tree or in history.
* No published vulnerability against any pinned library.

**Once a day** — [`live.yml`](.github/workflows/live.yml)

* The site answers, its security headers survived to production, and it still
  names itself consistently for search engines.
* A headless browser loads the page and waits for the world to finish loading.
  "It is up" and "it works" are different claims, and this is the second one.
* Every attribution link still resolves. One of them shipped broken once, which
  is why the check exists.

### What is not checked

The pipeline that generates `docs/` is a separate, private repository with its
own test suite. None of it runs here. These workflows read the output and know
nothing about how it was produced, so a defect that generates a plausible but
wrong city would pass every check above.

That limit is stated rather than glossed because a CI that implies more than it
tests is worth less than one that says where it stops.

### One thing worth knowing

The host injects an analytics beacon from its own CDN into every response. It is
not part of this repository and cannot be removed from it. The
Content-Security-Policy refuses to load it, and the browser check confirms that
on every run: the page reaches for the beacon, the request is blocked before it
is sent, and nothing leaves. It is the only foreign origin the page touches.

### Running the checks yourself

```sh
npm ci
npm run test:artefact              # reads docs/, no browser needed
npx playwright install chromium
npm run test:live                  # asks the live site
```

## Licence

The code in this repository is licensed under the PolyForm Noncommercial
License 1.0.0. See LICENSE.md.

Not all of this repository is covered by that licence. The libraries in
docs/vendor/ are three.js and meshoptimizer (MIT) and Rapier (Apache-2.0), each
under its own terms. The level data in docs/chunks/ is derived from
OpenStreetMap and remains under the Open Database License v1.0. The vehicle
model is CC BY 4.0. All are credited in NOTICE.
