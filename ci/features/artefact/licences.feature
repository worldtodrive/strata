Feature: The licence texts travel with the code

  Both licences here have a shipping obligation, not just a crediting one. MIT
  requires the permission notice to travel with the code. Apache-2.0 section 4(a)
  requires the full licence text to accompany any distribution. Publishing the
  site is a distribution, so these files are not decoration: leaving one out is
  the licence breach itself.

  This is an existence check only, and deliberately so. Whether a URL still
  resolves is a question about the internet, not about this commit, and it is
  asked once a day in features/live/attribution.feature instead.

  Scenario Outline: <file> ships
    Given the shipped artefact
    Then "<file>" exists and is not empty

    Examples:
      | file                                |
      | NOTICE                              |
      | LICENSE.md                          |
      | docs/vendor/NOTICE                  |
      | docs/vendor/LICENSE-MIT.txt         |
      | docs/vendor/LICENSE-Apache-2.0.txt  |

  Scenario: The MIT permission notice is present in full
    Given the shipped artefact
    Then "docs/vendor/LICENSE-MIT.txt" contains "WITHOUT WARRANTY OF ANY KIND"
    And "docs/vendor/LICENSE-MIT.txt" contains "shall be included in all copies"

  Scenario: The Apache licence is present in full
    Given the shipped artefact
    Then "docs/vendor/LICENSE-Apache-2.0.txt" contains "Apache License"
    And "docs/vendor/LICENSE-Apache-2.0.txt" contains "Version 2.0, January 2004"

  # The car model is CC BY 4.0, which requires a modification to be stated and
  # the source to be linked. Both were nearly lost once already.
  Scenario: The attribution obligations for the vehicle model are stated
    Given the shipped artefact
    Then "NOTICE" contains "CC BY 4.0"
    And "NOTICE" contains "MODIFIED"

  Scenario: The map data licence is named
    Given the shipped artefact
    Then "NOTICE" contains "OpenStreetMap"
    And "NOTICE" contains "ODbL"
