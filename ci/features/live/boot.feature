Feature: The world actually boots

  Scenario: A browser reaches a running world
    Given a headless browser
    When it opens the home page
    Then the loading screen goes away within 90 seconds
    And a rendering canvas is present at a non-zero size
    And the display does not report a failure
    And no uncaught error was raised

  Scenario: Nothing loads from another origin, whoever asked for it
    Given a headless browser
    When it opens the home page
    And it waits for the world to finish loading
    Then no response came from an origin other than "https://drivestrata.io"
    And every request to another origin was blocked by the policy
