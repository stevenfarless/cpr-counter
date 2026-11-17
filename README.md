# CPR Cadence PWA — prototype v2.0.0

UNVALIDATED PROTOTYPE. Do not rely on this package for operational CPR dispatch without agency clinical approval, independent engineering review, and measured workstation validation. No medical-device certification is claimed.

## Installation

Extract the ZIP. Keep all files in the same directory. Have IT serve that directory over HTTPS. For local evaluation with Python installed, open a terminal in the extracted directory and run:

    python -m http.server 8000 --bind 127.0.0.1

Then open http://localhost:8000 in a current desktop Chrome or Edge browser. Do not double-click index.html for PWA installation: file:// does not provide the service-worker environment needed here.

Wait for “Offline files verified”. Install using the app button when offered or the browser's install menu. Check the installed app can reopen offline after all its windows are closed. Cache readiness is checked at that moment, not a guarantee against later storage removal. Request persistent storage through managed browser policy if appropriate; still test actual offline relaunch. Keep a single approved browser profile and instance.

## Controls

Fresh load: 110 BPM, sound off, visual pulse on, 30:2 manual-resume mode. Only theme and gain persist. Teal, slate blue, sage, lavender, and amber are available. Gain percentage is a software setting, not measured loudness. Test sound while stopped and confirm the intended device. Avoid routing cues into caller audio inadvertently.

30:2 mode: first cue displays 1; cue 30 lasts a complete interval; steady amber breath phase follows. The dispatcher clicks Resume compressions when the caller reports returning to compressions. The next round begins at 1. No timed restart. Displayed count tracks scheduled cues; hardware delivery and performed compressions are unverified. Audio output latency may offset tones relative to displayed count: measure on the actual workstation. Continuous mode counts upward without rounds or breath phases. Stop preserves the last display; new Start resets the session.

BPM and mode changes require stopping. No global keyboard shortcuts. Focused controls still accept normal browser keyboard activation. Keep this window visible; a loss of page visibility stops the session. Do not change full-screen/window configuration mid-session without testing the resulting visibility behavior.

## Timing architecture and limitations

Web Audio schedules short buffer-source tones on its audio clock with a 180 ms look-ahead, checked each animation frame. The first cue is scheduled 100 ms after a round begins. Visual pulse and cue count follow the audio-context timeline, not a separate interval timer. Pulse is 130 ms. Device buffering and display refresh cause output latency; this is not a synchronization guarantee. Visual-only operation still uses an audio context as its clock.

No perpetual audio loop is used. If the page thread stalls, at most the already queued 180 ms of future tone onsets can continue, plus device buffering. A missed scheduling deadline over 25 ms, frame gap over 250 ms, or clock discrepancy over 150 ms causes a detected fault and explicit restart. These thresholds are provisional and require validation. The frozen display may remain illuminated. Stop and fault messages cannot execute while the page or OS is frozen. No automatic catch-up beats.

Web Locks prevents concurrent sessions only where supported within the same origin and browser profile. It does not coordinate other browsers, profiles, origins, devices, or older implementations. A screen wake lock is requested where available; failures do not prevent use. The operator must keep the display awake. No app can detect all device or power failures from this execution environment.

If a session is interrupted, restarting resets round and count. The dispatcher must reconcile with the caller under agency procedure. If the caller resumes before the dispatcher clicks Resume, displayed counts will be behind. The app cannot detect this.

## Offline and updates

All runtime assets are local. No analytics or remote services. First service-worker activation claims the page after precaching. Later versions wait for an explicit stopped-state update click. No automatic reload on controller change. Browser cache clearing, storage eviction, and software updates can remove/change this environment. A closed app may adopt a waiting worker on next launch, which always begins stopped. Close other windows before applying updates. Active windows from different versions are unsupported.

Deploy atomically. Change both version constants and record a new validation report for each release. Old caches are intentionally retained to avoid deleting files needed by old open clients; managed deployments should remove old versions only after all old clients close. Do not serve different releases under the same version identifier. Serve sw.js with Cache-Control: no-cache. This is a proposed release mechanism, not a validated deployment system.

## Tests included and remaining

core-tests.cjs runs pure timing-model tests with Node.js:

    node core-tests.cjs

Automated results shipped with this package cover model boundaries and static consistency only. No browser integration, audio delivery, clinical validation, accessibility audit, or real-workstation performance measurement has been completed. Use VALIDATION.md for acceptance work.

References:
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-life-support
