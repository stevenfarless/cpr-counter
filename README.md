# CPR Counter

A visual and optional audio counter intended to explore CPR cadence support for dispatchers.

Project: https://github.com/stevenfarless/cprcounter  
Demo: https://stevenfarless.github.io/cprcounter/

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
- Independently selectable sound and visual pulses, including counter-only operation.
- A continuous-cadence mode.
- A 30-cue mode with a dispatcher-controlled breath phase and manual resume.
- Coordinated color themes with teal as the default.
- Installable PWA packaging and cached offline operation.
- Technical information and maintenance controls inside a collapsed App details section.
- Update checking and a pending-update notice, with activation deferred during an active session.

Availability and behavior depend on the deployed version. This list is not a statement that these features have been validated.

## What the counter represents

The displayed count follows the application’s scheduled cues. The application does not detect or confirm:

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

This setup is for development and nonclinical evaluation only.

## Offline operation and updates

Offline operation depends on successful caching and continued availability of browser storage. An installed app may have an older version. Network availability, browser scheduling, sleeping devices, storage removal, and deployment failures can delay or prevent updates.

The update interface is intended to check for releases, identify a downloaded update, and apply it while stopped. Do not assume every open device is running the newest release. Record and verify the version used during testing.

Changing files in the repository does not by itself prove that a deployed or installed copy has received them. Test the complete deployment, update, and offline-relaunch process.

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
