Feature: No known vulnerability ships with the artefact

  The vendored libraries are pinned, which is good for reproducibility and bad
  for security: a pinned version never picks up a fix on its own. Something that
  was clean when it was vendored can stop being clean without any commit here.

  There is no package manifest describing those three libraries — they are files
  in a directory, not npm dependencies of anything — so a routine dependency
  audit would look at this repository and correctly report nothing at all. That
  is exactly the blind spot worth closing, so the versions recorded in
  vendor-manifest.json are asked about directly.

  OSV is the vulnerability database maintained by the Open Source Security
  Foundation. It aggregates GitHub Security Advisories among other sources, and
  it can be queried by exact package version without an account or a key.

  Scenario: No pinned library has a published advisory against it
    Given the vendor manifest
    When the OSV database is asked about every pinned library
    Then no pinned library has a known vulnerability

  Scenario: The tooling this repository installs is clean too
    Given the shipped artefact
    Then the declared dependencies have no known vulnerabilities at high severity or above
