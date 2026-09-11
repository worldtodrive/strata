Feature: The licence texts travel with the code

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

  Scenario: The attribution obligations for the vehicle model are stated
    Given the shipped artefact
    Then "NOTICE" contains "CC BY 4.0"
    And "NOTICE" contains "MODIFIED"

  Scenario: The map data licence is named
    Given the shipped artefact
    Then "NOTICE" contains "OpenStreetMap"
    And "NOTICE" contains "ODbL"
