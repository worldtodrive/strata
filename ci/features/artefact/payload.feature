Feature: The artefact fits inside its hosting limits

  Scenario: No shipped file exceeds the hosting limit
    Given the shipped artefact
    Then no file is larger than 25 MiB
    And the ten largest files are listed for the record
