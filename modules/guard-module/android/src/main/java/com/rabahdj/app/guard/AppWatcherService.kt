package com.rabahdj.app.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat

class AppWatcherService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var running = false
  private var overlayView: TextView? = null
  private var lastLaunchAt = 0L

  private val prefs by lazy { getSharedPreferences("guard_prefs", Context.MODE_PRIVATE) }

  private val tick = object : Runnable {
    override fun run() {
      if (!running) return
      try { checkOnce() } catch (e: Exception) { Log.e("AppWatcher", "tick", e) }
      handler.postDelayed(this, 2000)
    }
  }

  override fun onCreate() { super.onCreate(); createChannel() }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification: Notification = NotificationCompat.Builder(this, "CHANNEL_WATCHER_ID")
      .setContentTitle("تطبيق الرقابة الأبوية")
      .setContentText("مراقبة التطبيقات المحظورة تعمل")
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setOngoing(true)
      .build()
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(103, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(103, notification)
      }
    } catch (e: Exception) {
      Log.e("AppWatcher", "startForeground failed: ${e.message}")
      stopSelf(); return START_NOT_STICKY
    }
    if (!running) { running = true; handler.post(tick) }
    return START_STICKY
  }

  private fun blockedApps(): Set<String> =
    prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()

  private fun foregroundPackage(): String? {
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val events = usm.queryEvents(end - 15000, end)
    val ev = UsageEvents.Event()
    var last: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(ev)
      if (ev.eventType == 1) last = ev.packageName
    }
    return last
  }

  private fun checkOnce() {
    val blocked = blockedApps()
    val fg = foregroundPackage()
    if (fg != null && blocked.contains(fg) && fg != packageName) {
      showOverlay()
      val now = System.currentTimeMillis()
      if (now - lastLaunchAt > 5000) {
        lastLaunchAt = now
        launchOurApp()
      }
    } else {
      hideOverlay()
    }
  }

  private fun launchOurApp() {
    try {
      val i = packageManager.getLaunchIntentForPackage(packageName)
      i?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      startActivity(i)
    } catch (e: Exception) { Log.w("AppWatcher", "launch: ${e.message}") }
  }

  private fun showOverlay() {
    if (overlayView != null) return
    if (!Settings.canDrawOverlays(this)) return
    val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val tv = TextView(this).apply {
      text = "⛔ هذا التطبيق محظور بواسطة ولي الأمر\n\nعُد للخلف أو اضغط الرئيسية"
      setTextColor(Color.WHITE)
      textSize = 20f
      gravity = Gravity.CENTER
      setBackgroundColor(Color.argb(245, 11, 18, 32))
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    )
    params.gravity = Gravity.CENTER
    try { wm.addView(tv, params); overlayView = tv } catch (e: Exception) { Log.w("AppWatcher", "overlay: ${e.message}") }
  }

  private fun hideOverlay() {
    val v = overlayView ?: return
    try { (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(v) } catch (_: Exception) {}
    overlayView = null
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = NotificationChannel("CHANNEL_WATCHER_ID", "App Watcher", NotificationManager.IMPORTANCE_LOW)
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  override fun onDestroy() {
    running = false
    handler.removeCallbacksAndMessages(null)
    hideOverlay()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
