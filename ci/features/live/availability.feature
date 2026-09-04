Feature: The site answers

  The cheapest possible question, asked first so that when something more
  interesting fails it is clear whether the site was even up.

  Scenario Outline: <path> is served
    When I request "<path>"
    Then the response status is 200

    Examples:
      | path         |
      | /            |
      | /robots.txt  |
      | /sitemap.xml |
      | /og.png      |

  Scenario: The home page is HTML and the social image is a PNG
    When I request "/"
    Then the response content type is "text/html"
    When I request "/og.png"
    Then the response content type is "image/png"

  # A host that serves the home page for every path will pass every check above
  # while being thoroughly broken, and search engines will index the wreckage.
  Scenario: An unknown path is not quietly served the home page
    When I request "/this-path-does-not-exist"
    Then the response status is 404
