package com.rabahdj.app.guard

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class GuardModule : Module() {
  private fun hasAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  override fun definition() = ModuleDefinition {
    Name("GuardModule")

    Function("hasUsageAccess") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      hasAccess(context)
    }

    Function("openUsageSettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    Function("setChildToken") { token: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, AppWatcherService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
      else context.startService(intent)
      // التوكن يصل للخدمة عبر Intent extra في النداء التالي — نجبره الآن:
      val i2 = Intent(context, AppWatcherService::class.java).apply { action = "SET_TOKEN"; putExtra("TOKEN", token) }
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i2) else context.startService(i2)
      "token sent"
    }
    Function("startRemoteStream") { token: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, MediaStreamingService::class.java).apply {
        action = "START_STREAM"
        putExtra("TOKEN", token)
        putExtra("MODE", "audio")
      }
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
      else context.startService(intent)
      "Streaming Started"
    }

    Function("startRemoteStreamMode") { token: String, mode: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, MediaStreamingService::class.java).apply {
        action = "START_STREAM"
        putExtra("TOKEN", token)
        putExtra("MODE", mode)
      }
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
      else context.startService(intent)
      "Streaming Started ($mode)"
    }

    Function("stopRemoteStream") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, MediaStreamingService::class.java)
      context.stopService(intent)
      "Streaming Stopped"
    }

    Function("mediaPermissionsGranted") {
      val ctx = appContext.reactContext ?: return@Function false
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("requestMediaPermissions") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve("no-activity")
        return@AsyncFunction
      }
      val needed = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA).filter {
        ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
      }
      if (needed.isEmpty()) {
        promise.resolve("granted")
        return@AsyncFunction
      }
      ActivityCompat.requestPermissions(activity, needed.toTypedArray(), 77001)
      promise.resolve("requested")
    }

    Function("openAppSettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    Function("setBlockedApps") { apps: List<String> ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      context.getSharedPreferences("guard_prefs", Context.MODE_PRIVATE)
        .edit().putStringSet("blocked_apps", apps.toSet()).apply()
      "ok"
    }

    Function("startAppWatcher") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, AppWatcherService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
      else context.startService(intent)
      "watcher started"
    }

    Function("stopAppWatcher") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      context.stopService(Intent(context, AppWatcherService::class.java))
      "watcher stopped"
    }

    Function("hasOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      Settings.canDrawOverlays(context)
    }

    Function("openOverlaySettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      context.startActivity(
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }
    AsyncFunction("getInstalledApps") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val pm = context.packageManager
      pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
        .filter { (it.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0 }
        .map { it.packageName }
        .sorted()
    }

    AsyncFunction("getTodayUsage") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      if (!hasAccess(context)) {
        throw IllegalStateException("Usage access is not enabled")
      }
      val calendar = Calendar.getInstance()
      calendar.set(Calendar.HOUR_OF_DAY, 0)
      calendar.set(Calendar.MINUTE, 0)
      calendar.set(Calendar.SECOND, 0)
      calendar.set(Calendar.MILLISECOND, 0)

      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = manager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        calendar.timeInMillis,
        System.currentTimeMillis()
      )

      if (stats.isNullOrEmpty()) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      stats.filter { it.totalTimeInForeground > 0L }
        .groupBy { it.packageName }
        .map { (packageName, entries) ->
          val totalMs = entries.map { it.totalTimeInForeground }.sum()
          mapOf(
            "packageName" to packageName,
            "minutes" to (totalMs / 60000L).toInt()
          )
        }
        .sortedByDescending { it["minutes"] as Int }
    }
  }
}
