# CPR Counter update patch — 2.1.0

This is a patch kit for the originally generated app.js, not a verified copy of your GitHub repository. No GitHub files were retrieved or changed. UNVALIDATED PROTOTYPE: not cleared for operational CPR use.

## Apply
1. Make a local copy/clone of your repository.
2. Extract this kit somewhere outside that repository folder.
3. Open a terminal in the repository folder containing index.html and app.js.
4. Run Python with the full location of the extracted apply-update.py, for example:

   python /path/to/extracted-kit/apply-update.py

On Windows use the applicable quoted path, such as:

   py "C:\Users\YourName\Downloads\cpr-counter-update-kit\apply-update.py"

The script inspects the original update section before making changes. If it does not recognize the app, it stops. It creates backups before writing. It updates index.html, app.js, sw.js, and adds update-manager.js. styles.css remains unchanged; the update module supplies its own compact banner styles. Review changes before committing. Do not commit the backup directory.

## Behavior
- Check for updates lives inside App details, with visible checking/result/error feedback.
- An update notice at the top appears only after the waiting worker reports a newer semantic release and complete cache.
- Update now is disabled during compressions, startup, and breaths. Stop enables it.
- Check on startup, each visible execution minute, return to foreground, and reconnection.
- New releases download automatically; activation/reload requires Update now.
- A same-profile session lock is held through activation, and all in-scope windows must acknowledge being idle. Unresponsive or legacy windows block in-app activation. Close those windows and retry. Other origins/profiles have separate service workers.
- In-app activation is refused without Web Locks. Stop all sessions, close all app windows, and reopen online instead.
- The app never intentionally reloads an active session to apply an update. This does not guarantee browser/OS behavior or fault-free execution.
- Offline cache check results remain visible inside App details.

## First migration from the old worker
The already-installed old code does not include these controls. Its old Apply downloaded update action or a fully closed-and-reopened app is needed to adopt this patch after deployment. Close ALL CPR Counter windows/tabs, then reopen online if necessary. A source commit alone does not change an already cached interface. Old windows lacking the new handshake must close before a new-protocol manual activation can proceed. Once this patch is active, later compatible releases can use the new updater.

## Future releases
Bump RELEASE in update-manager.js, VERSION in sw.js, and the app.js version together (e.g. 2.1.1). Never reuse a release identifier for different files. Deploy the entire release atomically; test the actual host's deployment behavior. The required runtime assets are enumerated in sw.js. No update mechanism makes a non-atomic deployment safe by itself. Keep release approval and testing separate from development commits. Old caches are retained deliberately; clean them only under a reviewed lifecycle policy.

## Tests performed
Node syntax checks on the two new JavaScript files, Python syntax check, and a synthetic installer fixture check. No browser, service-worker lifecycle, multi-window, offline, audio, mobile, or agency workstation testing performed.

## Required integration checks before use
- Patch against a copy of the actual repo; inspect diff; test ordinary Start/Stop/Resume and offline check.
- Install 2.1.0; deploy 2.1.1 with all release constants bumped; confirm a real cached update yields the banner.
- Check while idle/counting/breathing, then press Stop; no active-session reload.
- Two idle windows, active second window, old-version window, unresponsive window, unsupported locks.
- Failed network, incomplete download, unchanged worker, cache eviction, tab restoration, sleeping mobile device.
- Confirm update now activates target worker, reloads once, returns stopped/muted, and can reopen offline.
- Browser scheduling can delay checks. Download or verification failure must not claim freshness. Model state is not proof of physical audio or visual delivery.
