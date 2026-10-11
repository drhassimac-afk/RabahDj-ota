package com.rabahdj.app.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class MediaStreamingService : Service() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification: Notification = NotificationCompat.Builder(this, "CHANNEL_STREAM_ID")
            .setContentTitle("تطبيق الرقابة الأبوية")
            .setContentText("يتم تشغيل ميزات الحماية المحيطية وبث الشاشة حالياً...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()

        // بدء الخدمة الأمامية لتفادي إغلاق النظام للكاميرا أو بث الشاشة
        startForeground(102, notification)

        // 💡 هنا يتم دمج بروتوكول البث مثل WebRTC للاتصال بالسيرفر ونقل الصوت/الصورة
        
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                "CHANNEL_STREAM_ID",
                "Media Streaming Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }
}
