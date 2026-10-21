package com.rabahdj.app.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MediaStreamingService : Service() {

    @Volatile private var isStreaming = false
    private var audioRecord: AudioRecord? = null
    private val bufferSize = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    private val serverUrl = "https://rabahdj-parental-backend.onrender.com"
    @Volatile private var token: String? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.getStringExtra("TOKEN")?.let { token = it }

        val notification: Notification = NotificationCompat.Builder(this, "CHANNEL_STREAM_ID")
            .setContentTitle("تطبيق الرقابة الأبوية")
            .setContentText("يتم تشغيل ميزات الحماية المحيطية وبث الصوت حالياً...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(102, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(102, notification)
        }

        if (intent?.action == "START_STREAM" && !isStreaming) {
            startAudioCapture()
        }
        return START_STICKY
    }

    private fun startAudioCapture() {
        isStreaming = true
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                16000,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )
            audioRecord?.startRecording()

            thread(start = true) {
                val audioBuffer = ByteArray(bufferSize)
                while (isStreaming) {
                    val readBytes = audioRecord?.read(audioBuffer, 0, bufferSize) ?: 0
                    if (readBytes > 0) {
                        sendAudioToServer(audioBuffer.copyOf(readBytes))
                    }
                    Thread.sleep(300)
                }
            }
        } catch (e: Exception) {
            Log.e("MediaStreaming", "فشل بدء التقاط الصوت", e)
            isStreaming = false
        }
    }

    private fun sendAudioToServer(audioData: ByteArray) {
        val t = token ?: return
        thread {
            try {
                val base64Audio = Base64.encodeToString(audioData, Base64.NO_WRAP)
                val conn = URL("$serverUrl/api/child/audio").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $t")

                val jsonPayload = "{\"audio\":\"$base64Audio\"}"
                conn.outputStream.use { it.write(jsonPayload.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                Log.d("MediaStreaming", "حالة الإرسال: $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e("MediaStreaming", "فشل إرسال الصوت", e)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel("CHANNEL_STREAM_ID", "Guard Stream", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        isStreaming = false
        try { audioRecord?.stop() } catch (_: Exception) {}
        audioRecord?.release()
        audioRecord = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
