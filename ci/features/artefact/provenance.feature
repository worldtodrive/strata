Feature: The vendored libraries are unmodified upstream code

  Three libraries ship inside docs/vendor/: three.js, Rapier and the
  meshoptimizer decoder. Together they are around 3.5 MB of code nobody here
  wrote, served from the same origin as everything else and running with the
  same privileges. "We vendored these, they are fine" is not something a reader
  should have to take on trust.

  So on every run the pinned packages are downloaded from the npm registry and
  compared byte for byte. Passing means: the code running in a visitor's browser
  is exactly the code the upstream authors published, and the licence and
  attribution in NOTICE describe what is actually there.

  The comparison is by content, never by filename. One file was renamed on the
  way in: the meshopt decoder ships under a three.js addons path but is
  meshoptimizer's own file, not three.js's bundled copy. vendor-manifest.json
  records where each file really came from.

  The recorded fingerprints are checked too, but they are the fast half, not the
  proof. A hash committed to this repository only shows a file has not changed
  since someone wrote the hash down. The download is what makes it evidence.

  Scenario: Every vendored file matches the package it claims to come from
    Given the shipped artefact
    And the vendor manifest
    Then every vendored file matches its recorded fingerprint
    When the pinned packages are downloaded from the npm registry
    Then every vendored file is byte-identical to its upstream original

  Scenario: The manifest accounts for everything that ships
    Given the shipped artefact
    And the vendor manifest
    Then every file in the vendor directory is listed in the manifest

  Scenario: NOTICE agrees with what actually ships
    Given the shipped artefact
    And the vendor manifest
    Then NOTICE names the version of every vendored library
