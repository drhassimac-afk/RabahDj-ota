const fs = require('fs');
const f = 'src/lib/guard-sync.ts';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('[child-token]')) { console.log('مثبت مسبقاً'); process.exit(0); }

// توسيع النوع
const tA = /openAppSettings\?\(\): void;/;
if (!tA.test(s)) { console.error('FAIL: type anchor'); process.exit(1); }
s = s.replace(tA, "openAppSettings?(): void;\n  setChildToken?(token: string): void;");

// الاستدعاء في runCheck بعد الرفع — التوكن الحي دائماً للخدمة الدائمة
const hA = 'void listenToRemoteStreamCommands(String(credentials.familyId));   // [listener-auto]';
if (!s.includes(hA)) { console.error('FAIL: hook anchor'); process.exit(1); }
s = s.replace(hA, hA + `
  // [child-token] تمرير التوكن الحي للخدمة الأمامية (تستطلع الأوامر حتى الشاشة مقفلة)
  void (async () => {
    try {
      if (native && typeof (native as any).setChildToken === 'function') {
        const tk = await login();
        (native as any).setChildToken(tk);
      }
    } catch {}
  })();`);

fs.writeFileSync(f, s);
console.log('OK: child token → foreground service');
