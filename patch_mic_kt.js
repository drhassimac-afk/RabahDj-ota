const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/GuardModule.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('"micDiag"')) { console.log('مثبت مسبقاً'); process.exit(0); }

const anchor = '    Function("setChildToken") { token: String ->';
if (!s.includes(anchor)) { console.error('FAIL: setChildToken anchor'); process.exit(1); }
const add = [
  '    Function("micDiag") {',
  '      val ctx = appContext.reactContext ?: return "no-context"',
  '      val granted = ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED',
  '      val recState = if (granted) {',
  '        try {',
  '          val minBuf = android.media.AudioRecord.getMinBufferSize(16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT)',
  '          val rec = android.media.AudioRecord(android.media.MediaRecorder.AudioSource.MIC, 16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT, minBuf)',
  '          rec.startRecording()',
  '          val buf = ByteArray(2048)',
  '          Thread.sleep(150)',
  '          val n = rec.read(buf, 0, buf.size)',
  '          var peak = 0',
  '          for (i in 0 until n - 1 step 2) {',
  '            val v = Math.abs(((buf[i].toInt() and 0xFF) or (buf[i+1].toInt() shl 8)).toShort().toInt())',
  '            if (v > peak) peak = v',
  '          }',
  '          rec.stop(); rec.release()',
  '          "قراءة $n عينة، ذروة $peak"',
  '        } catch (e: Exception) { "AudioRecord فشل: ${e.message}" }',
  '      } else "إذن الميكروفون غير ممنوح!"',
  '      "granted=$granted | $recState"',
  '    }',
  '',
].join('\n');
s = s.replace(anchor, add + anchor);
fs.writeFileSync(f, s);
console.log('OK: micDiag added (reads real mic peak live)');
