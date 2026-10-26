const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('player-v3]')) { console.log('مثبت مسبقاً'); process.exit(0); }
let n = 0;

// 1) ملف فريد لكل دفعة (مرساة حرفية من السطر 137 — 16 مسافة):
const A_OLD = "                const fileUri = dir + 'live_stream.wav';";
if (!s.includes(A_OLD)) { console.error('FAIL A'); process.exit(1); }
s = s.replace(A_OLD,
"                const fileUri = dir + 'live_' + Date.now() + '.wav';   // [player-v3]");
n++;

// 2) مستوى صوت صريح (مرساة حرفية من السطر 144):
const B_OLD = "                    audioPlayer.current = createAudioPlayerFn(fileUri);";
if (!s.includes(B_OLD)) { console.error('FAIL B'); process.exit(1); }
s = s.replace(B_OLD, B_OLD +
"\n                    try { audioPlayer.current?.setVolume?.(1.0); } catch {}");
n++;

fs.writeFileSync(f, s);
console.log('OK: ' + n + ' edits (unique file + explicit volume) — cleanup omitted by design');
