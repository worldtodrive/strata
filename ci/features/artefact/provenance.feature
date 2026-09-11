Feature: The vendored libraries are unmodified upstream code

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
