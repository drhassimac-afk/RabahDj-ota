const fs = require('fs');
const f = 'src/lib/guard-sync.ts';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('syncBlockedApps')) { console.log('مثبت مسبقاً'); process.exit(0); }

const fn = `let reportedAppsThisSession = false;
async function syncBlockedApps(): Promise<void> {
  if (!native) return;
  try {
    const r = await api('/api/child/blocked-apps');
    if (r.ok) {
      const d = await r.json().catch(() => null);
      const apps: string[] = Array.isArray(d?.apps) ? d.apps : [];
      if (typeof (native as any).setBlockedApps === 'function') {
        (native as any).setBlockedApps(apps);
      }
      if (typeof (native as any).startAppWatcher === 'function') {
        (native as any).startAppWatcher();
      }
    }
    if (!reportedAppsThisSession && typeof (native as any).getInstalledApps === 'function') {
      const installed = await (native as any).getInstalledApps();
      if (Array.isArray(installed) && installed.length) {
        await api('/api/child/installed-apps', {
          method: 'POST',
          body: JSON.stringify({ apps: installed }),
        });
        reportedAppsThisSession = true;
      }
    }
  } catch (error) {
    console.warn('تعذر مزامنة حظر التطبيقات:', error);
  }
}

`;
const anchor = 'async function runCheck(): Promise<LockState> {';
const call = 'const rule = await fetchRules();';
if (!s.includes(anchor) || !s.includes(call)) { console.error('FAIL: anchors'); process.exit(1); }
s = s.replace(anchor, fn + anchor);
s = s.replace(call, call + '\n  void syncBlockedApps();   // [blockapps]');
fs.writeFileSync(f, s);
console.log('OK: child sync installed');
