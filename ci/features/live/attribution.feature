Feature: The attribution links still resolve

  Scenario: Every URL credited in NOTICE resolves
    Given the attribution URLs in "NOTICE"
    Then every one of them resolves

  Scenario: Every URL credited on the page itself resolves
    Given the attribution URLs in "docs/index.html"
    Then every one of them resolves

  Scenario: The vehicle model source is still published
    Given the attribution URLs in "NOTICE"
    Then the source link for the vehicle model resolves
