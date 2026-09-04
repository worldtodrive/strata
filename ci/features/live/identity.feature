Feature: The site names itself consistently

  The site is indexable and is meant to be found. A canonical link or an og:url
  that names the wrong origin splits the site in two as far as a search engine
  is concerned, and the symptom is invisible from a browser: the page looks
  perfect while ranking for nothing.

  Scenario: The canonical link and og:url agree on the production origin
    When I request "/"
    Then the canonical link is "https://drivestrata.io/"
    And the og:url is "https://drivestrata.io/"
    And the og:image is served from "https://drivestrata.io"

  Scenario: The site is not accidentally hidden from search engines
    When I request "/"
    Then the page declares no "noindex"
    And the response carries no "x-robots-tag" forbidding indexing

  Scenario: robots.txt points at a sitemap that exists
    When I request "/robots.txt"
    Then it names a sitemap
    And that sitemap is served
