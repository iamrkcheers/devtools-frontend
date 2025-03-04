# Triage Guidelines

## Disclaimer

The most important thing: please use common sense. The guidelines below are likely not exhaustive and do not cover every case.

## What should be triaged?

All `Untriaged` DevTools issues, as well as any `Unconfirmed` issues that also have the `TE-NeedsTriageHelp` label need to be triaged.

[[Query]](https://bugs.chromium.org/p/chromium/issues/list?sort=-modified&q=-label%3ADevTools-Triaged%20component%3APlatform%3EDevTools%20status%3AUntriaged%20OR%20component%3APlatform%3EDevTools%20status%3AUnconfirmed%20label%3ATE-NeedsTriageHelp)

## Who is triaging?

Right now there is a Google-internal rotation set-up, with people that do weekly shifts.
As Microsoft is in an opposite timezone they have a similar rotation on the same triage queue, but during a different time.

- Google rotation: GMT+1
- MS rotation: GMT-9

## What are the SLOs?

[[Query]](https://bugs.chromium.org/p/chromium/issues/list?q=component%3APlatform%3EDevTools%20status%3AUntriaged%20modified-before%3Atoday-7%20OR%20component%3APlatform%3EDevTools%20status%3AUnconfirmed%20label%3ATE-NeedsTriageHelp%20modified-before%3Atoday-7)

Issues in the untriaged queue should receive a meaningful response within a business week. This means that the goal is to make the query mentioned above return zero issues.

## How are priorities defined?

- P0: This needs to be urgently done, fire drill alert!
  - Most of the time, this seldom needs to be used.
  - Critical security exploits that affect stable are a good example for a P0
  - DevTools crashing on startup is a good example
- P1: This is important. Let’s aim to get this done next
  - Non-critical security fixes will likely be in this category
  - Regression bugs will be likely in this category
  - Important features that partners are waiting for might be in this category
- P2: We want to do that. The exact time of delivery is not that important though.
  - General feature work will likely be in this category
  - Non-severe bugs
- P3: This is nice, but not important. We unlikely will do work here.
  - Edge-case bugs might fit this category
  - Non-important feature requests too

## How should issues be triaged?

- Close issues as `WontFix` if they don't reproduce (in simple cases) or are requests for features we've already concluded not to pursue.
- Close issues as `Archived` that are valid, but it seems unlikely that we will get there anytime soon.
- Move issues out of `Platform>DevTools` if they are not DevTools issues (but just reported via the menu item in DevTools), put on the `DevTools-Triaged` label and leave the `Untriaged` status as is.
- Assign regression bugs with bisects to individuals directly and set the status to `Assigned`.
- Put proper `Platform>DevTools>XXX` component(s) on the issue and do an initial check-in regarding the priority.
- Put one of the following labels on it and set the status to `Available`:
  - `Hotlist-DevTools-ProductReview` if it's controversial or clear that consensus needs to be built first.
  - `Team-DevTools-BrowserAutomation` if it's an issue related to ChromeDriver or puppeteer.
  - `Team-DevTools-RuntimeDebugging` if it's a JavaScript or WebAssembly debugging issue.
  - `Team-DevTools-WebDebugging` if it's a Web specific debugging issue (i.e. Network or Application panel).
  - `Team-DevTools-DesignAccessibility` if it's a design or accessibility issue.
  - `Team-DevTools-Performance` if the issue is related to our performance tooling (i.e. Performance panel, Lighthouse).
  - `Team-DevTools-RecordReplay` if it's an issue with the recorder or puppeteer.
  - No specific `Team` or `Hotlist` if it doesn't fit any specific team otherwise. Make sure to have the `Platform>DevTools` component (or a subcomponent) on it though.
- Also remember to put the `Needs-UX` label on it, if help from a designer is likely to be required.

### Setting Assigned or Available

Set issues to `Available` if they don’t need immediate action and nobody right now and in the short-term future (an iteration) needs to work on it.

Issues that are handled by Microsoft have the label “Hotlist-DevTools-MS-Backlog” and “Hotlist-DevTools-MS-CurrentSprint” respectively and can be considered triaged.

If you think they are super urgent, please assign them to yangguo@chromium.org and cc bmeurer@chromium.org and hablich@chromium.org.

### Closing issues

Don’t be afraid to close issues with WontFix if:

- Bugs that are not reproducible
- After two weeks you did not get a response back from the reporter on a question
- The requested “bug” is the intended behavior
  Make sure that you bundle the WontFix with a brief comment explaining it e.g. “Setting to WontFix because not reproducible.”

## FAQ

### What if the issue belongs to another team?

If you think the to-triage issue is not a DevTools issue, please simply set it to a component that you think it should belong to and potentially remove the DevTools component. Make sure that the status is set to Untriaged. Please also ensure that you add the label DevTools-Triaged to the bug to ensure that the bug does not come back to the DevTools component. Feel free to CC people that you think might help with triaging this.
This essentially moves the issue out of the DevTools triage queue into another team’s queue.

### What if the issue is best handled by Microsoft?

If you think the to-triage issue or feature request is best handled by Microsoft then add the label "msft-consider" to the issue along with completing the other normal triage steps.

### There is a feature request I am unsure how to handle. What should I do?

Please set the request to Available and add the label “Hotlist-DevTools-ProductReview”.

### How do I indicate that a bug should block a release?

The combination of the label “M-<milestone>” and “Release-Block-<channel>” signals that this very bug is blocking a release. Examples:

- M-80, Release-Block-Stable
  - This blocks the release of 80 to the Stable channel
  - Depends in which release channel 80 is, this might not be an urgent (but still important bug to fix)
- M-81, Release-Block-Beta
  - This blocks the release of 81 to the Beta channel
  - Depends in which release channel 81 is, this might not be an urgent (but still important bug to fix)
- M-81, Release-Block-Dev
  - This blocks the release of 81 to the Dev channel
  - This typically means that the bug is urgent and important, as Dev releases are happening every week and are ok to be a little bit buggy.

## Out of scope

### Managing the backlog

[[Query]](https://bugs.chromium.org/p/chromium/issues/list?q=component%3APlatform%3EDevTools%20status%3AAvailable)

Managing the backlog is out of scope for the triage rotation. The backlog will be groomed continuously by hablich@ for now. The SLA is that there should be a maximum of 50 issues in there.

### Managing the ProductReview queue

[[Query]](https://bugs.chromium.org/p/chromium/issues/list?q=Hotlist%3DDevTools-ProductReview)

Issues in `ProductReview` will continuously be handled by hablich@ to unblock items in there. SLA is max 10 issues.

## References

- [Chromium triage guidelines](https://www.chromium.org/for-testers/bug-reporting-guidelines/triage-best-practices)
