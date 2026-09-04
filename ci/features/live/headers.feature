Feature: The security headers survive to production

  isolation.feature checks that the right headers are declared in the artefact.
  This checks the host is actually sending them. Those are different claims, and
  the gap between them is a real failure mode: header configuration is
  interpreted by the host, not by this repository, so a syntax change or a
  configuration reset can silently drop the lot while the site keeps serving
  pages perfectly.

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
