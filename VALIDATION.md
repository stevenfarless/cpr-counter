# Required acceptance work — not completed

Owner, agency protocol, approved users, workstation OS/build, browser/build, display refresh, audio device, app release/hash, reviewer, date, and pass/fail evidence must be recorded. Agency clinical and technical leads must define acceptance limits BEFORE measurement. Do not infer acceptance from an absence of JavaScript errors.

## Workstation load measurement — 2026-11-19 (issue #17)

Measured with `browser-tests/load-measurement.cjs` (headless Chromium, 120 BPM,
rAF-gap probe). The old rule faulted a live session on a SINGLE frame gap
>250 ms or audio/frame drift >150 ms. A one-off 300 ms main-thread stall —
the kind a busy workstation produces — faulted at 390 ms even though no cue
was missed. The rule was changed on that evidence (app.js `tick()`):

- Fault only on a repeated interruption: a second frame gap >250 ms within
  5 s, or a single gap >1000 ms.
- Audio scheduling lookahead 180 ms → 400 ms, so a stall up to ~375 ms
  cannot leave a cue unqueued: the cue was already scheduled and plays on
  time. Longer stalls still fault via the missed-cue check, which is
  unchanged and still immediate.
- The audio/frame drift check was REMOVED: measured drift samples up to
  ~282 ms occur on normal 17 ms frames (the audio clock advances in
  bursts), so instantaneous drift is noise, not a timing failure.
  Audio-clock interruption remains caught by the `statechange` listener.

Results against the new rule (all scenarios as expected):

| Scenario | Faults | rAF gaps |
|---|---|---|
| idle, 60 s | none | max 83 ms, 0 over 250 ms |
| CPU throttled 4x, 60 s | none | max 33 ms, 0 over 250 ms |
| CPU throttled 10x, 60 s | none | max 17 ms, 0 over 250 ms |
| single 300 ms stall after a cue, 30 s | none | 1 gap over 250 ms (283 ms) |
| single 300 ms stall straddling a cue, 30 s | none | 1 gap over 250 ms (283 ms) |
| two 300 ms stalls 50 ms apart, 30 s | yes, 942 ms, "cue timing was interrupted" | 2 gaps over 250 ms |
| single 600 ms stall, 30 s | yes, 684 ms, "a scheduled cue was missed" | 1 gap over 250 ms (583 ms) |
| endurance, CPU throttled 4x, 180 s | none | max 217 ms, 0 over 250 ms |

Covered in CI by four browser tests (single stall, stall straddling a cue,
two stalls, freeze over a second).

## Functional cases
- Test sound is cleaned up after playback, cancellation, rapid repeated activation, and sound being disabled during asynchronous audio preparation.
- Install prompt dismissal, acceptance, unavailable prompt, and rejected prompt do not leave an unhandled rejection.
- Offline verification handles a missing controller, worker message timeout, message-channel failure, and repeated checks without an uncaught rejection.
- Timing-model input rejects non-finite elapsed time, non-finite or non-positive periods, and unknown modes.
- Fresh launch always stopped, 110 BPM, muted, pulse on; persisted theme/gain restored safely.
- Invalid/empty/fractional/out-of-range cadence rejected; input at 100 and 120 accepted.
- Correct cue and round progression at 100/110/120; cue 30 receives a full interval.
- No tones/flashes after breath transition; no timed restart; round increments once per Resume.
- Continuous mode has no breath phase, denominator, or round progression.
- Double click, held Enter/Space, touch double tap, rapid Start/Stop, async start cancellation.
- Toggle only active cue, change theme mid-session, gain extremes, Test sound overlap, permission failures.
- Same-profile simultaneous starts, unsupported Web Locks, other profiles/browsers documented.
- Stop preserves final count; restart resets; breath-time label uses last cue time.

## Physical measurement
- Independently record screen and audio. Measure interval error, variation, missed/duplicate cues, audio/visual offset, pulse duration, first-cue and Stop latency.
- Measure idle and high CAD/map/radio/CPU/GPU load. Include long endurance runs and system clock changes.
- Verify color contrast, peripheral visibility, glare, visual comfort, screen-reader behavior and focus navigation. No flash or color scheme safety certification is implied.

## Fault injection
- Stall page thread for 50/100/200/300/1000/5000 ms, during pulse and between pulses.
- Check queued-audio bound, frozen display behavior, delayed fault indication, no catch-up, explicit restart.
- Hide/minimize/occlude window, change tabs, sleep/wake, lock/unlock, disconnect monitor, remote desktop changes.
- Mute OS, disconnect/reconnect/change default audio device, Bluetooth latency, permission revocation and audio-clock interruption.
- Browser crash/restart, back-forward cache, reload prompt, disk full, storage denial/corruption/eviction.
- Corrupt saved preferences, unavailable Web Audio, denied screen wake lock, render/resource failures.

## PWA lifecycle
- HTTPS/localhost install; first-load caching; failed/partial cache download; service-worker activation timeout; app reports unverified on timeout.
- Close all windows; disconnect network; reopen installed app; exercise all features including sound.
- Repeat after reboot, browser update and storage clearing; ensure offline state is accurately represented.
- Update while stopped and during each session phase; no active-session automatic reload; check multiple clients.
- Confirm atomic deployment and version mismatch handling; service worker registration failure; unsupported install prompt.

## Human factors and clinical review
- Approve continuous vs 30:2 mode selection and any caller-count reconciliation procedure.
- Assess dispatcher workload of Resume each round while typing and listening.
- Caller continues past 30, pauses early, resumes before Resume click, dispatcher misses/presses Resume early.
- Validate fallback independent of browser and workstation. Train users on cue counts vs actual compressions.
- Document residual risks and signed release decision. This checklist is not exhaustive.
