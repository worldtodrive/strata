Feature: The security headers survive to production

  Scenario Outline: The home page carries <header>
    When I request "/"
    Then the response carries the header "<header>"

    Examples:
      | header                      |
      | content-security-policy     |
      | x-content-type-options      |
      | referrer-policy             |
      | permissions-policy          |
      | cross-origin-opener-policy  |

  Scenario: The policy in production still forbids outbound connections
    When I request "/"
    Then the delivered policy limits "connect-src" to this origin and blob URLs
    And the delivered policy limits "default-src" to this origin

  Scenario: The delivered policy is the one in the artefact
    When I request "/"
    Then the delivered policy is identical to the one declared in the artefact
