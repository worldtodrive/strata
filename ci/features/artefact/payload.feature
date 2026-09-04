Feature: The artefact fits inside its hosting limits

  Cloudflare Pages refuses to serve any single file over 25 MiB. A file that
  crosses the line does not degrade gracefully: the deploy fails, or the file is
  simply absent and the level will not load.

  Levels get denser over time and the meshes get bigger with them, so this is
  the check most likely to be the one that eventually fires. It exists to fire
  here, on a commit, rather than in production.

  Scenario: No shipped file exceeds the hosting limit
    Given the shipped artefact
    Then no file is larger than 25 MiB
    And the ten largest files are listed for the record
