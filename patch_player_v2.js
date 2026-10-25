const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('[player-v2]')) { console.log('مثبت مسبقاً'); process.exit(0); }

// 1) استبدل كتلة الكتابة/التشغيل القديمة كاملة بنسخة نظيفة: مشغّل جديد كل دفعة + تحرير القديم
const old = `                if (!audioPlayer.current && createAudioPlayerFn) {
                  audioPlayer.current = createAudioPlayerFn(fileUri);
                } else if (audioPlayer.current?.replace) {
                  audioPlayer.current.replace(fileUri);
                  audioPlayer.current.seekTo?.(0);
                }
                audioPlayer.current?.play?.();
                setDiagMsg((m) => (m ? m + ' → ▶️ أُمر التشغيل' : '▶️ أُمر التشغيل'));`;
if (!s.includes(old)) { console.error('FAIL: player block anchor — أرسل sed -n "128,155p" src/app/parental.tsx'); process.exit(1); }

const neu = `                // [player-v2] مشغّل جديد لكل دفعة — بلا replace ولا مشغّل قديم عالق
                if (createAudioPlayerFn) {
                  try { audioPlayer.current?.release?.(); } catch {}
                  try {
                    audioPlayer.current = createAudioPlayerFn(fileUri);
                    audioPlayer.current?.play?.();
                    setDiagMsg((m) => (m ? m + ' → ▶️ مشغّل جديد أُطلق' : '▶️ مشغّل جديد أُطلق'));
                  } catch (e2: any) {
                    setDiagMsg('❌ إنشاء/تشغيل المشغّل فشل: ' + String((e2 as any)?.message ?? e2));
                  }
                } else {
                  setDiagMsg('❌ createAudioPlayerFn غير متاح رغم diagAudio=ok — حالة غير متوقعة');
                }`;
s = s.replace(old, neu);

// 2) وأيضاً: صمّم الصوت إلى أقصى حد عند الإنشاء (احتياط لمستوى منخفض افتراضي)
//    (اختياري — بعض الأجهزة تشغّل بصوت منخفض جداً)
fs.writeFileSync(f, s);
console.log('OK: player-v2 installed (fresh player per chunk)');
