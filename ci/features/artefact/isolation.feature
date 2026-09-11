Feature: The page cannot send anything anywhere

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

  Scenario: The only external URLs in the page are required attribution
    Given the shipped artefact
    Then every external URL in the home page is an attribution link
