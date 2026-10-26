const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('[player-v3]')) { console.log('مثبت مسبقاً'); process.exit(0); }

const old = "                const fileUri = dir + 'live_stream.wav';";
if (!s.includes(old)) { console.error('FAIL: fileUri anchor'); process.exit(1); }
// ملف فريد لكل دفعة — لا سباق كتابة/تشغيل + مستوى صوت صريح:
const neu = `                const fileUri = dir + 'live_' + Date.now() + '.wav';   // [player-v3] ملف فريد
`;
s = s.replace(old, neu);

// مستوى صوت صريح عند الإنشاء:
const pA = "                    audioPlayer.current = createAudioPlayerFn(fileUri);";
if (!s.includes(pA)) { console.error('FAIL: create anchor'); process.exit(1); }
s = s.replace(pA, pA +
  "\n                    try { audioPlayer.current?.setVolume?.(1.0); } catch {}");

// تنظيف الملفات القديمة (احتفاظ بآخر 3 فقط):
const relA = "                    try { audioPlayer.current?.release?.(); } catch {}";
if (!s.includes(relA)) { console.error('FAIL: release anchor'); process.exit(1); }
s = s.replace(relA, relA +
  "\n                    try { FSmod?.readDirectoryAsync?.(dir)?.then?.((files: any[]) => {\n" +
  "                      const olds = (files||[]).filter((x:any)=>x.name?.startsWith('live_')).slice(0,-3);\n" +
  "                      olds.forEach((x:any)=>FSmod.deleteAsync?.(dir+x.name,{}));\n" +
  "                    }); } catch {}");

fs.writeFileSync(f, s);
console.log('OK: player-v3 (unique file per chunk + explicit volume + cleanup)');
