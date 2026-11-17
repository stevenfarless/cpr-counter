# Required acceptance work — not completed

Owner, agency protocol, approved users, workstation OS/build, browser/build, display refresh, audio device, app release/hash, reviewer, date, and pass/fail evidence must be recorded. Agency clinical and technical leads must define acceptance limits BEFORE measurement. Do not infer acceptance from an absence of JavaScript errors.

## Functional cases
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
- HTTPS/localhost install; first-load caching; failed/partial cache download; app reports unverified on timeout.
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
