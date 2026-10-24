const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');

// 1) استخرج كتلة الـ polling من موضعها الخاطئ
const startMark = '  // تحديث دوري كل 30 ثانية';
const endMark = '  }, [isConfigured, refreshDashboard]);';
const st = s.indexOf(startMark);
const en = s.indexOf(endMark, st);
if (st === -1 || en === -1) { console.error('FAIL: polling block not found'); process.exit(1); }
const block = s.slice(st, en + endMark.length);
s = s.slice(0, st) + s.slice(en + endMark.length);

// 2) أعد إدراجها مباشرة بعد إغلاق refreshDashboard
const rdClose = '  }, [fetchLivePairingCode, fetchLiveDevices, fetchLiveUsageRules, fetchLivePlaces]);';
const ri = s.indexOf(rdClose);
if (ri === -1) { console.error('FAIL: refreshDashboard close not found'); process.exit(1); }
const at = ri + rdClose.length;
s = s.slice(0, at) + '\n\n' + block + s.slice(at);

fs.writeFileSync(f, s);
console.log('✅ الـ polling انتقل لما بعد تعريف refreshDashboard — TDZ مُصفّى');
