Feature: The world actually boots

  Every other live check confirms a server answered. None of them would notice
  if the page loaded to a black screen, which is the most likely way this
  particular site breaks: the levels are large binary meshes decoded by a
  WebAssembly module, and any of that can fail while every file still returns
  200 and every header is perfect.

  So a real browser opens the real page and waits for the loading screen to
  finish. "It is up" and "it works" are different claims and this is the one
  that costs something to make.

  Scenario: A browser reaches a running world
    Given a headless browser
    When it opens the home page
    Then the loading screen goes away within 90 seconds
    And a rendering canvas is present at a non-zero size
    And the display does not report a failure
    And no uncaught error was raised

  # This is the strongest of the four isolation checks, because it is the only
  # one that observes rather than infers. The other three read the artefact and
  # reason about what a browser would do; this watches what a browser actually
  # did, including with code that is not in the artefact at all.
  #
  # That distinction is not hypothetical here. The host injects an analytics
  # beacon from its own CDN into every response — a script that appears in the
  # page's DOM, that nobody in this repository wrote, and that no check reading
  # docs/ could ever see. The policy refuses to load it. So the page does reach
  # for one foreign origin, and gets nothing: the request is blocked before it
  # is sent, and no bytes leave.
  #
  # Asserting "the page contacts nothing" would therefore be false. Asserting
  # "nothing the page reaches for succeeds" is true, is what actually matters,
  # and has the useful property of going red either if the policy is weakened
  # or if something new starts loading successfully.
  Scenario: Nothing loads from another origin, whoever asked for it
    Given a headless browser
    When it opens the home page
    And it waits for the world to finish loading
    Then no response came from an origin other than "https://drivestrata.io"
    And every request to another origin was blocked by the policy
