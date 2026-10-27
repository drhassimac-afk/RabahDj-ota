const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');

const MARK = 'أسماء صحيحة (remove/volume)';
if (s.includes(MARK)) { console.log('مثبت مسبقاً'); process.exit(0); }

const OLD = `                // [player-v2] مشغّل جديد لكل دفعة — بلا replace ولا مشغّل قديم عالق
                if (createAudioPlayerFn) {
                  try { audioPlayer.current?.release?.(); } catch {}
                  try {
                    audioPlayer.current = createAudioPlayerFn(fileUri);
                    try { audioPlayer.current?.setVolume?.(1.0); } catch {}
                    audioPlayer.current?.play?.();
                    setDiagMsg((m) => (m ? m + ' → ▶️ مشغّل جديد أُطلق' : '▶️ مشغّل جديد أُطلق'));
                  } catch (e2: any) {
                    setDiagMsg('❌ إنشاء/تشغيل المشغّل فشل: ' + String((e2 as any)?.message ?? e2));
                  }
                } else {
                  setDiagMsg('❌ createAudioPlayerFn غير متاح رغم diagAudio=ok — حالة غير متوقعة');
                }`;

if (!s.includes(OLD)) { console.error('FAIL: anchor — أرسل sed -n "135,160p" src/app/parental.tsx'); process.exit(1); }

const NEW = `                // أسماء صحيحة (remove/volume) + تشخيص حالة التشغيل الفعلية
                if (createAudioPlayerFn) {
                  try { audioPlayer.current?.remove?.(); } catch {}
                  try {
                    const p = createAudioPlayerFn(fileUri);
                    audioPlayer.current = p;
                    try { p.volume = 1.0; } catch {}
                    p.play?.();
                    setDiagMsg((m) => (m ? m + ' → ▶️ أُطلق' : '▶️ أُطلق'));
                    setTimeout(() => {
                      try {
                        setDiagMsg((m) => (m || '') + \` | ⏱ playing=\${p.playing} dur=\${p.duration ?? '?'} cur=\${p.currentTime ?? '?'}\`);
                      } catch {}
                    }, 600);
                  } catch (e2: any) {
                    setDiagMsg('❌ إنشاء/تشغيل المشغّل فشل: ' + String((e2 as any)?.message ?? e2));
                  }
                } else {
                  setDiagMsg('❌ createAudioPlayerFn غير متاح رغم diagAudio=ok — حالة غير متوقعة');
                }`;

s = s.replace(OLD, NEW);
fs.writeFileSync(f, s);
console.log('OK: player fix installed (correct method names + playback diagnostics)');
