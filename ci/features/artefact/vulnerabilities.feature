Feature: No known vulnerability ships with the artefact

  Scenario: No pinned library has a published advisory against it
    Given the vendor manifest
    When the OSV database is asked about every pinned library
    Then no pinned library has a known vulnerability

  Scenario: The tooling this repository installs is clean too
    Given the shipped artefact
    Then the declared dependencies have no known vulnerabilities at high severity or above
