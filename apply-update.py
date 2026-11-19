"""Apply the CPR Counter updater to the original generated app. Run beside index.html."""
from pathlib import Path
import re, shutil, datetime
base=Path.cwd()
kit=Path(__file__).resolve().parent
required=['index.html','app.js','sw.js','styles.css','core.js','manifest.webmanifest','icon-192.png','icon-512.png']
missing=[name for name in required if not (base/name).is_file()]
if missing: raise SystemExit('STOP: run this script in the app folder. Missing: '+', '.join(missing))
html=(base/'index.html').read_text()
app=(base/'app.js').read_text()
if 'update-manager.js' in html: raise SystemExit('STOP: updater is already referenced. Review manually; nothing changed.')
start=re.search(r'async\s+function\s+checkOffline\s*\(\s*\)\s*\{',app)
# The tail may carry init statements between render() and the legacy
# setupWorker() call (e.g. the short-landscape Settings collapse); keep them.
end=re.search(r'validate\(\);\s*render\(\);\s*(.*?)\s*if\(!externalUpdater\)setupWorker\(\);\s*$',app,re.S)
if not start or not end or start.start()>=end.start():
 raise SystemExit('STOP: app.js does not match the original generated update section. Nothing changed. Paste app.js for adaptation.')
tail_init=end.group(1).strip()
for token in ["function active()", "function render()", "cpr-cadence-session", "function stop("]:
 if token not in app: raise SystemExit('STOP: expected app structure missing: '+token+'. Nothing changed.')
if not re.search(r'<script\b[^>]*src=[\'\"]app\.js[\'\"][^>]*>\s*</script>',html):
 raise SystemExit('STOP: app.js script tag not found. Nothing changed.')
newapp=app[:start.start()]+'\nvalidate();render();\n'+(tail_init+'\n' if tail_init else '')
newapp,n=re.subn(r"VERSION\s*=\s*(['\"])[^'\"]+\1", "VERSION='2.2.0'",newapp,count=1)
if not n: raise SystemExit('STOP: app VERSION constant not found. Nothing changed.')
newhtml=re.sub(r'(<script\b[^>]*src=[\'\"]app\.js[\'\"][^>]*>\s*</script>)',r'\1\n  <script src="update-manager.js" defer></script>',html,count=1)
# Confirm the old static handler section is absent before writing.
if 'async function setupWorker' in newapp or 'setupWorker();' in newapp:
 raise SystemExit('STOP: legacy updater was not completely removed. Nothing changed.')
backup=base/('backup-before-updater-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir()
for name in ['index.html','app.js','sw.js']:shutil.copy2(base/name,backup/name)
(base/'index.html').write_text(newhtml)
(base/'app.js').write_text(newapp)
shutil.copy2(kit/'release-sw.js',base/'sw.js')
if (kit/'update-manager.js').resolve()!=(base/'update-manager.js').resolve():shutil.copy2(kit/'update-manager.js',base/'update-manager.js')
print('Applied release 2.2.0 updater. Backup: '+str(backup))
print('Review and test locally before committing index.html, app.js, sw.js and update-manager.js.')
