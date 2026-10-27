package com.rabahdj.app.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Camera
import android.graphics.SurfaceTexture
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
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class MediaStreamingService : Service() {

  @Volatile private var isStreaming = false
  @Volatile private var isCamRunning = false
  private var audioRecord: AudioRecord? = null
  private val sampleRate = 16000
  private val bytesPerSecond = sampleRate * 2   // 16-bit mono
  private val serverUrl = "https://rabahdj-parental-backend.onrender.com"

  // ═══ [v4] منتج/مستهلك: الالتقاط لا يلمس الشبكة أبداً ═══
  private val audioQueue = ConcurrentLinkedQueue<ByteArray>()
  private val senderRunning = AtomicBoolean(false)
  private val QUEUE_MAX = 120        // ≈36 ثانية @300ms/إطار — إسقاط الأقدم بعدها
  private val READ_BYTES = 9600      // 300ms لكل قراءة حاجبة

  @Volatile private var token: String? = null
  @Volatile private var mode: String = "audio"

  override fun onCreate() { super.onCreate(); createNotificationChannel() }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    intent?.getStringExtra("TOKEN")?.let { token = it }
    intent?.getStringExtra("MODE")?.let { mode = it }

    val notification: Notification = NotificationCompat.Builder(this, "CHANNEL_STREAM_ID")
      .setContentTitle("تطبيق الرقابة الأبوية")
      .setContentText(if (mode == "camera") "بث الكاميرا والصوت يعمل..." else "بث الصوت يعمل...")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .build()

    try {
      if (Build.VERSION.SDK_INT >= 29) {
        var t = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        if (mode == "camera" &&
          checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
          t = t or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        }
        startForeground(102, notification, t)
      } else {
        startForeground(102, notification)
      }
    } catch (e: Exception) {
      Log.e("MediaStreaming", "startForeground failed: ${e.message}")
      stopSelf(); return START_NOT_STICKY
    }

    if (intent?.action == "START_STREAM") {
      isStreaming = true
      startAudioCapture()
      if (mode == "camera") startCameraShots()
    }
    return START_STICKY
  }

  private fun hasMic(): Boolean =
    checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

  // ═══ 🎙️ المنتج: يقرأ 300ms ويدفع للطابور — صفر انتظار شبكة هنا ═══
  private fun startAudioCapture() {
    if (!hasMic()) { Log.w("MediaStreaming", "لا يوجد إذن الميكروفون — تخطي الصوت"); return }
    if (audioRecord != null) return   // حارس الازدواج: خيط الالتقاط يعمل أصلاً
    try {
      val safeBuf = maxOf(
        AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT),
        bytesPerSecond * 2        // احتياطي داخلي ≈ ثانيتان — انتهى عصر minBufferSize الهش
      )
      audioRecord = AudioRecord(
        MediaRecorder.AudioSource.MIC, sampleRate,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, safeBuf
      )
      audioRecord?.startRecording()
      thread(start = true) {
        val buf = ByteArray(READ_BYTES)
        try {
          while (isStreaming) {
            val n = audioRecord?.read(buf, 0, buf.size) ?: break
            if (n > 0) {
              audioQueue.add(buf.copyOf(n))
              while (audioQueue.size > QUEUE_MAX) audioQueue.poll()
            }
          }
        } catch (e: Exception) {
          Log.w("MediaStreaming", "التقاط توقف: ${e.message}")
        }
      }
      // المستهلك: ينطلق مرة واحدة ويسحب من الطابور (ويفضّغ المخزون عند التوقف)
      if (senderRunning.compareAndSet(false, true)) {
        thread(start = true) { senderLoop() }
      }
    } catch (e: Exception) {
      Log.e("MediaStreaming", "فشل بدء الصوت", e)
    }
  }

  // ═══ 📤 المستهلك: يسحب ويدمج حتى 3 إطارات (≈0.9ث) لكل POST ═══
  private fun senderLoop() {
    while (senderRunning.get() || audioQueue.isNotEmpty()) {
      var batch = audioQueue.poll()
      if (batch == null) { Thread.sleep(120); continue }
      var merged = 1
      while (merged < 3) {
        val nx = audioQueue.poll() ?: break
        batch += nx
        merged++
      }
      sendFrame("audio", Base64.encodeToString(batch, Base64.NO_WRAP))
    }
  }

  // ═══ 📷 الكاميرا — كما هي ═══
  private fun startCameraShots() {
    if (isCamRunning) return
    if (checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      Log.w("MediaStreaming", "لا يوجد إذن الكاميرا — تخطي الكاميرا"); return
    }
    isCamRunning = true
    thread(start = true) {
      var cam: Camera? = null
      try {
        cam = openAnyCamera()
        val tex = if (Build.VERSION.SDK_INT >= 26) SurfaceTexture(true)
                  else @Suppress("DEPRECATION") SurfaceTexture(0)
        cam.setPreviewTexture(tex)
        cam.startPreview()
        while (isCamRunning) {
          val latch = CountDownLatch(1)
          var shot: ByteArray? = null
          cam.takePicture(null, null, null, Camera.PictureCallback { data, _ ->
            shot = data; latch.countDown()
          })
          latch.await(5, TimeUnit.SECONDS)
          shot?.let { sendFrame("photo", Base64.encodeToString(it, Base64.NO_WRAP)) }
          try { cam.startPreview() } catch (_: Exception) {}
          Thread.sleep(2500)
        }
      } catch (e: Exception) {
        Log.e("MediaStreaming", "كاميرا: ${e.message}")
      } finally {
        try { cam?.stopPreview() } catch (_: Exception) {}
        try { cam?.release() } catch (_: Exception) {}
        isCamRunning = false
      }
    }
  }

  private fun openAnyCamera(): Camera {
    val info = Camera.CameraInfo()
    for (i in 0 until Camera.getNumberOfCameras()) {
      Camera.getCameraInfo(i, info)
      if (info.facing == Camera.CameraInfo.CAMERA_FACING_BACK) return Camera.open(i)
    }
    return Camera.open()
  }

  private fun sendFrame(type: String, data: String) {
    val t = token ?: return
    try {
      val conn = URL("$serverUrl/api/child/stream-frame").openConnection() as HttpURLConnection
      conn.requestMethod = "POST"
      conn.doOutput = true
      conn.connectTimeout = 8000
      conn.readTimeout = 8000
      conn.setRequestProperty("Content-Type", "application/json")
      conn.setRequestProperty("Authorization", "Bearer $t")
      conn.outputStream.use {
        it.write("{\"type\":\"$type\",\"data\":\"$data\"}".toByteArray(Charsets.UTF_8))
      }
      val code = conn.responseCode
      if (code !in 200..299) Log.w("MediaStreaming", "frame $type -> $code")
      conn.disconnect()
    } catch (e: Exception) {
      Log.e("MediaStreaming", "إرسال $type فشل", e)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = NotificationChannel(
        "CHANNEL_STREAM_ID", "Guard Stream", NotificationManager.IMPORTANCE_LOW
      )
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  override fun onDestroy() {
    isStreaming = false
    isCamRunning = false
    senderRunning.set(false)          // المستهلك يفضّغ الطابور المتبقي ثم يخرج
    try { audioRecord?.stop() } catch (_: Exception) {}
    audioRecord?.release()
    audioRecord = null
    audioQueue.clear()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
