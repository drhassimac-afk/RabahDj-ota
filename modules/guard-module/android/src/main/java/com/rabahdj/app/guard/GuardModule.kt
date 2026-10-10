package com.rabahdj.app.guard

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GuardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GuardModule")
  }
}
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
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")
      hasAccess(context)
    }

    Function("openUsageSettings") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    AsyncFunction("getTodayUsage") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")

      if (!hasAccess(context)) {
        throw IllegalStateException("Usage access is not enabled")
      }

      val calendar = Calendar.getInstance()
      calendar.set(Calendar.HOUR_OF_DAY, 0)
      calendar.set(Calendar.MINUTE, 0)
      calendar.set(Calendar.SECOND, 0)
      calendar.set(Calendar.MILLISECOND, 0)
      val startOfDay = calendar.timeInMillis
      val now = System.currentTimeMillis()

      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE)
        as UsageStatsManager

      manager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startOfDay,
        now
      )
        .orEmpty()
        .filter { it.totalTimeInForeground > 0 }
        .groupBy { it.packageName }
        .map { (packageName, entries) ->
          mapOf(
            "packageName" to packageName,
            "minutes" to (
              entries.sumOf { it.totalTimeInForeground } / 60_000L
            )
          )
        }
        .sortedByDescending { it["minutes"] as Long }
    }
  }
}
