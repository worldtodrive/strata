Feature: The attribution links still resolve

  The credits in NOTICE and in the page itself are licence obligations. CC BY
  4.0 requires a link to the source of the vehicle model; ODbL requires the map
  data attribution; MIT and Apache-2.0 both require their notices to be
  reachable. A link that has rotted is a compliance defect that looks exactly
  like a working site.

  One of these URLs shipped broken on 2026-09-03. That is the entire reason this
  file exists, and it is why the check reads the URLs out of the shipped files
  rather than from a list somebody maintains by hand — a hand-maintained list
  would have been just as wrong.

  This runs once a day and not on commits. It asks questions of Sketchfab,
  OpenStreetMap and Creative Commons, none of whom have agreed to answer a
  build server promptly, and a rate-limited runner is not a defect in this
  repository.

  Scenario: Every URL credited in NOTICE resolves
    Given the attribution URLs in "NOTICE"
    Then every one of them resolves

  Scenario: Every URL credited on the page itself resolves
    Given the attribution URLs in "docs/index.html"
    Then every one of them resolves

  Scenario: The vehicle model source is still published
    Given the attribution URLs in "NOTICE"
    Then the source link for the vehicle model resolves
