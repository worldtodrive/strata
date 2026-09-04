Feature: The page cannot send anything anywhere

  A visitor drives around a city in a browser tab. Nothing about that requires
  the page to contact any server other than the one it came from, and this
  feature is how that claim is made checkable rather than merely asserted.

  It is proved three ways, because any one of them alone would be weak:

    1. The Content-Security-Policy tells the browser to refuse outbound
       connections to anywhere but this origin. This is the enforcement: it
       holds even against code nobody in this repository wrote.
    2. Our own scripts name no external origin at all. This is the intent.
    3. The third-party libraries are byte-identical to their published upstream
       versions, which is proved separately in provenance.feature. This is the
       provenance, and it is what stops the argument "but you did not read all
       3.5 MB of vendored code".

  The live suite adds a fourth: a real browser loads the real page and every
  request it makes is recorded. See features/live/boot.feature.

  Scenario: The policy permits no outbound origin but this one
    Given the shipped artefact
    Then the header file declares a Content-Security-Policy
    And the policy limits "connect-src" to this origin and blob URLs
    And the policy limits "default-src" to this origin
    And the policy sets "object-src" to none
    And the policy sets "frame-ancestors" to none
    And the policy sets "form-action" to none
    And the policy sets "base-uri" to none

  Scenario: The security headers are declared alongside the policy
    Given the shipped artefact
    Then the header file declares "X-Content-Type-Options"
    And the header file declares "Referrer-Policy"
    And the header file declares "Permissions-Policy"
    And the header file declares "Cross-Origin-Opener-Policy"

  Scenario: Our own scripts name no external origin
    Given the shipped artefact
    Then no first-party script contains an absolute http or https URL
    And no first-party script opens a WebSocket
    And no first-party script constructs an XMLHttpRequest

  # The page does link out, in its visible credits, to the licences it is
  # obliged to link to. Those are anchors a reader clicks, not requests the page
  # makes, and features/live/attribution.feature checks they still resolve.
  Scenario: The only external URLs in the page are required attribution
    Given the shipped artefact
    Then every external URL in the home page is an attribution link
