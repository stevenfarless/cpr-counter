# CPR Counter

A visual and optional audio counter intended to explore CPR cadence support for dispatchers.

Project: https://github.com/stevenfarless/cpr-counter  
Demo: https://stevenfarless.github.io/cpr-counter/

> [!CAUTION]
> PROTOTYPE — ACTIVE DEVELOPMENT — NOT FOR EMERGENCY USE
>
> CPR Counter is an experimental project. Do not use it during an emergency, an urgent situation, a live dispatch call, or actual patient care. Do not rely on it to guide CPR, count a caller’s compressions, time rescue breaths, or make clinical decisions.
>
> Alpha and beta versions are for nonclinical development, demonstration, and evaluation only. Bugs, inaccurate or missed cues, frozen displays, unexpected stops, failed updates, and other failures may occur. Features and behavior may change without notice.
>
> Do not consider operational use before a full production release. A full-release label alone does not establish clinical safety or suitability: independent validation, clinical review, agency approval, and an appropriate fallback procedure would still be required before operational use.

## Development status

CPR Counter is a prototype in active development. The presence of an install button, offline support, automated tests, or a working demonstration does not establish readiness for emergency use.

Until the project explicitly announces a production release, treat all versions as prerelease software. Passing automated checks does not establish that displayed or audible cues are delivered correctly on a particular device.

No clinical validation or medical-device certification is claimed.

## Intended evaluation

This project explores a low-clutter interface for a dispatcher who needs to follow a compression cadence and track sets while listening and taking notes.

Evaluation must use simulated scenarios without a patient or live emergency caller. Follow your organization’s approved procedures and established resources during actual incidents. Do not delay CPR, emergency contact, or other care to open, install, troubleshoot, or update this project.

## Features under development

The implementation includes or is being developed around:

- A default cadence of 110 cues per minute, adjustable from 100 to 120.
- A large numeric cue counter and round indicator.
- Independently selectable sound and visual pulses, including counter-only operation (shown as "Counter only" in the configuration summary).
- A continuous-cadence mode.
- A 30-cue mode with a dispatcher-controlled breath phase and manual resume.
- A breath timer showing whole seconds since the last scheduled compression cue, with a Settings option to hide it.
- Settings that collapse into a summary line (BPM, mode, outputs) when a session starts.
- Coordinated color themes with teal as the default.
- Installable PWA packaging and cached offline operation.
- Technical information and maintenance controls inside a collapsed App details section.
- Update checking and a pending-update notice, with activation deferred during an active session.

Availability and behavior depend on the deployed version. This list is not a statement that these features have been validated.

## CPR reference content

The app includes a compact, offline-capable adult CPR reference and FAQ. Its clinical scope, source links, and review date are shown in the app. The content is educational and does not establish clinical readiness or replace dispatcher instructions, training, medical direction, or agency protocols. Pediatric and special-circumstance CPR require separate age- and situation-specific guidance.

## What the counter represents

The displayed count follows the application's scheduled cues. In 30:2 mode, the app enters a manual breath phase after 30 scheduled cues and waits for the operator to press Resume compressions. Continuous mode has no automatic 30-cue pause. Stop preserves the current display; the next Start begins a new session at round 1 and cue 1. No session statistics are collected. The application does not detect or confirm:

- Compressions actually performed by a caller or rescuer.
- Compression depth, recoil, placement, or effectiveness.
- Whether rescue breaths were given or were effective.
- The patient’s condition or the appropriate resuscitation protocol.
- Whether a tone reached the intended speaker or a pulse appeared correctly on the display.

In 30-cue mode, Resume compressions is an operator action. It does not establish that the caller completed two breaths or that the displayed count matches the caller’s actions. Mode selection is not clinical guidance.

## Local development

Keep the application’s runtime files together. With Python installed, open a terminal in the project directory and run:

```bash
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000` in your browser. Production-style PWA evaluation should use the project’s HTTPS deployment. Opening the HTML file directly is not a supported way to evaluate service-worker installation or offline behavior.

## Tests

```bash
npm test
```

This runs the timing-model checks (`node core-tests.cjs`) and the browser behavior tests (`browser-tests/counter.spec.js`, via Playwright). The browser tests assert behavior in a real Chromium instance: cue progression, the cue 30 boundary, the breath phase with no automatic resume, Stop preservation and new-session reset, counter-only operation, computed panel-text colors and contrast in every theme, layout stability across counts, touch targets, short-landscape/narrow-portrait layouts, and the stall tolerance of the timing check (a single 300 ms stall, including one straddling a cue, does not fault; repeated stalls or a freeze over a second do). They do not verify actual speaker or display delivery, or clinical readiness.

A standalone load-measurement script (`node browser-tests/load-measurement.cjs [scenarios]`) measures the false-fault rate under workstation load: idle, CPU-throttled, and main-thread stalls of 120–600 ms, plus a throttled endurance run. Results are recorded in VALIDATION.md.

A development-only simulation harness lives at `sim.html` for local runs. It is not deployed to the public site, is not linked from the app, is not cached by the service worker, starts no session, plays no audio, and stores nothing. It drives only the pure timing model with synthetic elapsed times (for example, starting at cue 28 or showing the breath phase) so transitions can be inspected repeatedly without starting a session. See the page itself for how to reset a scenario.

This setup is for development and nonclinical evaluation only.

## Offline operation and updates

Offline operation depends on successful caching and continued availability of browser storage. An installed app may have an older version. Network availability, browser scheduling, sleeping devices, storage removal, and deployment failures can delay or prevent updates.

The update interface is intended to check for releases, identify a downloaded update, and apply it while stopped. A Check for updates button and an update banner live in the App details section; a downloaded update is verified against the release version before it can be applied, and activation requires every open app window to confirm it is idle. Do not assume every open device is running the newest release. Record and verify the version used during testing.

Only the app files deploy to GitHub Pages (`index.html`, `styles.css`, `core.js`, `app.js`, `sw.js`, `update-manager.js`, `manifest.webmanifest`, icons). Development files are not served from the public site.

Changing files in the repository does not by itself prove that a deployed or installed copy has received them. Test the complete deployment, update, and offline-relaunch process.

## Release procedure

1. Bump the version in `package.json`, `app.js`, `sw.js`, and `update-manager.js` together; CI fails if they disagree.
2. Run the full test suite (`npm test`) and the browser tests.
3. Merge, then confirm the Pages deploy succeeds and the live site serves the new version.
4. On the live site, verify the update flow: install, offline relaunch, a downloaded update appearing in the banner, activation only while stopped, and no active-session reload.
5. Cut a tagged GitHub release with notes on what landed.

## Known limitations

Browser, operating-system, display, and audio-device behavior can affect delivery. An application running inside a frozen browser cannot immediately process Stop or reliably report its own failure. Mobile suspension, background restrictions, device changes, and workstation load require explicit testing.

The application is not a substitute for training, dispatch protocols, clinical judgment, approved equipment, or an independent fallback procedure.

## Contributing and reporting problems

Bug reports and interface feedback are welcome. Include the app version, browser and operating-system versions, device type, steps to reproduce, expected behavior, and observed behavior.

Use synthetic examples. Do not include patient information, caller recordings, CAD notes, or other sensitive incident data in public issues, screenshots, logs, or pull requests.

Changes affecting cadence, counting, breath phases, interruption handling, offline operation, or updates require particular review and regression testing. Do not present a contribution as clinically safe solely because tests pass.

## Release readiness

Before any operational deployment is considered, the project needs documented requirements, hazard analysis, independent code review, measured audio/visual testing, representative device and workload testing, human-factors evaluation, clinical review, and explicit organizational approval.

Alpha and beta builds must remain excluded from emergency and patient-care use. A future full release must state its supported configurations, validation scope, known limitations, and remaining risks.
