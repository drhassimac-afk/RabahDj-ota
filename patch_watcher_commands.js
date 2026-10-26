const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/AppWatcherService.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('commandPoller')) { console.log('مثبت مسبقاً'); process.exit(0); }

const ADD = [
  '',
  '  // ═══ [commandPoller] استطلاع أوامر الوالدين من داخل الخدمة الدائمة ═══',
  '  private var childToken: String? = null',
  '  private val serverUrl = "https://rabahdj-parental-backend.onrender.com"',
  '',
  '  private val commandPoller = object : Runnable {',
  '    override fun run() {',
  '      try { pollCommandsOnce() } catch (e: Exception) { Log.w("AppWatcher", "poll", e) }',
  '      handler.postDelayed(this, 5000)',
  '    }',
  '  }',
  '',
  '  fun setChildToken(t: String?) {',
  '    childToken = t',
  '    if (!t.isNullOrNullOrBlankSafe()) handler.removeCallbacks(commandPoller)',
  '    if (!t.isNullOrNullOrBlankSafe()) handler.postDelayed(commandPoller, 1000)',
  '  }',
  '',
  '  private fun String?.isNullOrNullOrBlankSafe() = this.isNullOrBlank()',
  '',
  '  private fun pollCommandsOnce() {',
  '    val t = childToken ?: return',
  '    val conn = URL("$serverUrl/api/commands").openConnection() as HttpURLConnection',
  '    try {',
  '      conn.requestMethod = "GET"',
  '      conn.connectTimeout = 6000; conn.readTimeout = 6000',
  '      conn.setRequestProperty("Authorization", "Bearer $t")',
  '      if (conn.responseCode !in 200..299) return',
  '      val body = conn.inputStream.bufferedReader().readText()',
  '      val arr = org.json.JSONObject(body).optJSONArray("commands") ?: return',
  '      for (i in 0 until arr.length()) {',
  '        val c = arr.getJSONObject(i)',
  '        val id = c.optString("id")',
  "        when (c.optString(\"command\")) {",
  '          "lock" -> { savePref("forced_lock", "true"); ack(id, t) }',
  '          "unlock" -> { savePref("forced_lock", "false"); ack(id, t) }',
  '          "add_minutes" -> {',
  '            val extra = c.optJSONObject("payload")?.optInt("minutes", 0) ?: 0',
  '            val cur = prefs.getInt("bonus_minutes", 0)',
  '            prefs.edit().putInt("bonus_minutes", cur + extra).apply()',
  '            ack(id, t)',
  '          }',
  '          "start_stream" -> {',
  '            val mode = c.optJSONObject("payload")?.optString("mode", "audio") ?: "audio"',
  '            val i2 = Intent(this, MediaStreamingService::class.java).apply {',
  '              action = "START_STREAM"; putExtra("TOKEN", t); putExtra("MODE", mode)',
  '            }',
  '            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i2) else startService(i2)',
  '            ack(id, t)',
  '          }',
  '          "stop_stream" -> {',
  '            stopService(Intent(this, MediaStreamingService::class.java))',
  '            ack(id, t)',
  '          }',
  '        }',
  '      }',
  '    } catch (e: Exception) { Log.w("AppWatcher", "pollOnce", e) }',
  '    finally { conn.disconnect() }',
  '  }',
  '',
  '  private fun ack(id: String, t: String) {',
  '    try {',
  '      val conn = URL("$serverUrl/api/commands/$id/acknowledge").openConnection() as HttpURLConnection',
  '      conn.requestMethod = "POST"',
  '      conn.connectTimeout = 6000; conn.readTimeout = 6000',
  '      conn.setRequestProperty("Authorization", "Bearer $t")',
  '      conn.responseCode',
  '      conn.disconnect()',
  '      Log.d("AppWatcher", "acked $id")',
  '    } catch (e: Exception) { Log.w("AppWatcher", "ack", e) }',
  '  }',
  '',
  '  private fun savePref(k: String, v: String) {',
  '    prefs.edit().putString(k, v).apply()',
  '  }',
].join('\n');

// الحقن: بعد إنشاء prefs مباشرة
const anchor = 'private val prefs by lazy { getSharedPreferences("guard_prefs", Context.MODE_PRIVATE) }';
if (!s.includes(anchor)) { console.error('FAIL: prefs anchor'); process.exit(1); }
s = s.replace(anchor, anchor + '\n' + ADD);

// تفعيل الاستطلاع عند بدء الخدمة:
const st = 'if (!running) { running = true; handler.post(tick) }';
if (!s.includes(st)) { console.error('FAIL: start anchor'); process.exit(1); }
s = s.replace(st, st + '\n    if (!childToken.isNullOrBlank()) { handler.removeCallbacks(commandPoller); handler.postDelayed(commandPoller, 1000) }');

fs.writeFileSync(f, s);
console.log('OK: watcher command poller installed');
