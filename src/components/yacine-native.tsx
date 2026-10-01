import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image,
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  useWindowDimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavBar from 'expo-navigation-bar';
import * as Brightness from 'expo-brightness';
import { VolumeManager } from 'react-native-volume-manager';

import {
  loadIPTVPlaylist,
  parseIPTVPlaylist,
  groupIPTVChannels,
  type IPTVChannel,
  type IPTVGroup,
} from '../lib/iptv-playlist';

import {
  login,
  saveCredentials,
  getSavedCredentials,
  clearCredentials,
  getLiveCategories,
  getLiveStreams,
  getStreamUrl,
  getVodCategories,
  getVodStreams,
  getVodStreamUrl,
  getShortEpg,
  decodeBase64Text,
  getSeriesCategories,
  getSeries,
  getSeriesInfo,
  getSeriesEpisodeUrl,
  getTimeshiftUrl,
} from '../../api/xtream';

interface YacineNativeProps {
  onClose: () => void;
}

type Credentials = {
  server: string;
  username: string;
  password: string;
};

type M3USource = {
  id: string;
  name: string;
  url: string;
};

type CategoryItem = {
  category_id: string | number;
  category_name: string;
};

type Channel = {
  stream_id: string | number;
  name: string;
  stream_icon?: string;
  container_extension?: string;
  tv_archive?: number | string;
  tv_archive_duration?: number | string;
};

type SeriesItem = {
  series_id: string | number;
  name: string;
  cover?: string;
};

type WatchedItem = {
  item: Channel;
  source: 'live' | 'movie' | 'series';
};

type Screen =
  | 'entry'
  | 'login'
  | 'dashboard'
  | 'categories'
  | 'channels'
  | 'movies-categories'
  | 'movies-list'
  | 'series-categories'
  | 'series-list'
  | 'series-detail'
  | 'multiscreen'
  | 'epg-guide'
  | 'local-groups'
  | 'local-channels'
  | 'm3u-sources'
  | 'm3u-add';

const FAVORITES_STORAGE_KEY = 'rabah_iptv_favorites';
const LAST_WATCHED_STORAGE_KEY = 'rabah_iptv_last_watched';
const M3U_SOURCES_STORAGE_KEY = 'rabah_iptv_m3u_sources';

const DRAWER_ITEM_HEIGHT = 58;

// خيارات العودة بالزمن (بالدقائق)
const TIMESHIFT_OPTIONS = [
  { min: 15, label: 'قبل ١٥ د' },
  { min: 30, label: 'قبل ٣٠ د' },
  { min: 60, label: 'قبل ساعة' },
  { min: 120, label: 'قبل ساعتين' },
  { min: 360, label: 'قبل ٦ ساعات' },
  { min: 720, label: 'قبل ١٢ ساعة' },
  { min: 1440, label: 'أمس' },
  { min: 2880, label: 'قبل يومين' },
];

const FIT_MODES = [
  { value: 'contain', label: 'احتواء' },
  { value: 'cover', label: 'ملء' },
  { value: 'fill', label: 'تمديد' },
] as const;

// كاش عام لـ EPG لتجنب إرسال طلب متكرر لنفس القناة
const epgCache = new Map<string, string | null>();

// ============================================================
// عرض اسم البرنامج الحالي لقناة معيّنة (EPG قصير)
// ============================================================
function ChannelEpgLabel({
  channel,
  credentials,
  epgEnabled,
}: {
  channel: Channel;
  credentials: Credentials;
  epgEnabled: boolean;
}) {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!epgEnabled) {
      setTitle(null);
      return;
    }

    let cancelled = false;
    const key = `${credentials.server}_${credentials.username}_${channel.stream_id}`;

    if (epgCache.has(key)) {
      const cachedTitle = epgCache.get(key);
      if (cachedTitle && !cancelled) {
        setTitle(cachedTitle);
      }
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const data = await getShortEpg(credentials, String(channel.stream_id), 1);
        const listing = data?.epg_listings?.[0];
        const epgTitle = listing?.title
          ? decodeBase64Text(listing.title)
          : null;

        epgCache.set(key, epgTitle);

        if (epgTitle && !cancelled) {
          setTitle(epgTitle);
        }
      } catch {
        // بعض السيرفرات ما عندهاش EPG — نتجاهل بصمت
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channel.stream_id, credentials, epgEnabled]);

  if (!title) return null;

  return (
    <Text style={styles.epgText} numberOfLines={1}>
      ● الآن: {title}
    </Text>
  );
}

// ============================================================
// مشغّل الفيديو (ملء شاشة + تحكم بالسحب بالصوت/الإضاءة + play/pause + تالي/سابق)
// ============================================================
function PlayerView({
  streamUrl,
  channelName,
  onMinimize,
  onClose,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  credentials,
  epgStreamId,
  playlist,
  currentIndex,
  onSelectIndex,
  backRef,
  archiveDays,
  isTimeshift,
  onTimeshift,
  onLive,
}: {
  streamUrl: string;
  channelName: string;
  onMinimize: () => void;
  onClose: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  credentials?: Credentials | null;
  epgStreamId?: string;
  playlist?: Channel[];
  currentIndex?: number;
  onSelectIndex?: (index: number) => void;
  backRef?: { current: (() => void) | null };
  archiveDays?: number;
  isTimeshift?: boolean;
  onTimeshift?: (minutesAgo: number, variant?: number) => void;
  onLive?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const dims = useRef({ width, height });

  useEffect(() => {
    dims.current = { width, height };
  }, [width, height]);

  useKeepAwake();
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(true);

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [fitIndex, setFitIndex] = useState(0);
  const [brightnessLevel, setBrightnessLevel] = useState(0.5);
  const [volumeLevel, setVolumeLevel] = useState(0.5);

  const contentFit = FIT_MODES[fitIndex].value;

  const toggleLock = () => {
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
  };

  const cycleFit = () => setFitIndex((i) => (i + 1) % FIT_MODES.length);

  const [showChannelList, setShowChannelList] = useState(false);
  const [showTimeshift, setShowTimeshift] = useState(false);

  const archiveOn = (archiveDays ?? 0) > 0;
  const maxMinutes = (archiveDays ?? 0) * 1440;

  const items = playlist ?? [];
  const activeIndex = typeof currentIndex === 'number' ? currentIndex : -1;
  const safeScrollIndex =
    activeIndex >= 0 && activeIndex < items.length ? activeIndex : 0;

const [showControls, setShowControls] = useState(true);
const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

const showControlsTemporarily = () => {
  setShowControls(true);
  if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  controlsTimeout.current = setTimeout(() => {
    if (fullscreenRef.current && isPlaying) {
      setShowControls(false);
    }
  }, 2500);
};

useEffect(() => {
  if (fullscreenRef.current) {
    showControlsTemporarily();
  } else {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  }
}, [fullscreen, isPlaying, streamUrl]);

useEffect(() => {
  return () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
  };
}, []);
  const [indicator, setIndicator] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);

  const brightnessStart = useRef(0.5);
  const volumeStart = useRef(0.5);
  const initialBrightness = useRef<number | null>(null);


const currentBrightness = useRef(0.5);

  const currentVolume = useRef(0.5);
  const hideIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  const [videoStatus, setVideoStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [videoError, setVideoError] = useState<string | null>(null);
  const retryCount = useRef(0);
  const emptyRef = useRef(false);

  // فحص استباقي: هل الملف فارغ عند المزوّد؟
  useEffect(() => {
    let cancelled = false;
    emptyRef.current = false;

    (async () => {
      try {
        const res = await fetch(streamUrl, {
          headers: { Range: 'bytes=0-1' },
        });

        const buf = await res.arrayBuffer();

        if (cancelled) return;

        if (res.ok && buf.byteLength === 0) {
          emptyRef.current = true;
          setVideoStatus('error');
          setVideoError(
            'المحتوى غير متاح حالياً عند المزوّد (الملف فارغ على السيرفر).'
          );
        }
      } catch {
        // تجاهل — نترك المشغّل يحاول
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [streamUrl]);

  const buildFallbackUrl = (url: string, attempt: number) => {
    const m = url.match(/\.([a-z0-9]+)(\?.*)?$/i);
    if (!m) return null;

    const ext = m[1].toLowerCase();
    const query = m[2] || '';

    const chains: Record<string, string[]> = {
      m3u8: ['ts', 'mp4'],
      ts: ['m3u8'],
      mp4: ['mkv', 'avi', 'm3u8'],
      mkv: ['mp4', 'avi'],
      avi: ['mp4', 'mkv'],
    };

    const list = chains[ext];
    if (!list || attempt >= list.length) return null;

    return url.replace(/\.[a-z0-9]+(\?.*)?$/i, '.' + list[attempt] + query);
  };

  const humanizeError = (raw: string) => {
    if (emptyRef.current) {
      return 'المحتوى غير متاح حالياً عند المزوّد (الملف فارغ).';
    }
    if (/CLEARTEXT/i.test(raw)) {
      return 'تعذر الاتصال بالسيرفر (حظر شبكي).';
    }
    if (/extractors|NoDeclaredBrand|Malformed/i.test(raw)) {
      return 'صيغة الملف غير مدعومة أو الرابط غير صالح لهذه الحلقة.';
    }
    if (/403|Forbidden/i.test(raw)) {
      return 'الوصول مرفوض — قد يكون الاشتراك منتهيًا أو الجهاز محظورًا.';
    }
    if (/404|Not Found/i.test(raw)) {
      return 'المحتوى غير موجود على السيرفر.';
    }
    if (/timeout|timed out|Unable to connect/i.test(raw)) {
      return 'انتهت مهلة الاتصال — تحقق من الإنترنت.';
    }
    return raw || 'تعذر تشغيل المحتوى';
  };

  useEffect(() => {
    retryCount.current = 0;
    emptyRef.current = false;
    setVideoStatus('loading');
    setVideoError(null);

    const subscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setVideoStatus('ready');
        setVideoError(null);
        return;
      }

      if (event.status === 'loading') {
        setVideoStatus('loading');
        return;
      }

      if (event.status === 'error') {
        const raw = event.error?.message || '';
        const fatal = /CLEARTEXT/i.test(raw) || emptyRef.current;
        const next = fatal ? null : buildFallbackUrl(streamUrl, retryCount.current);

        if (next) {
          retryCount.current += 1;
          setVideoStatus('loading');
          setVideoError('الصيغة غير مدعومة، جارٍ تجربة بديل...');

          try {
            player.replace({ uri: next });
            player.play();
          } catch {
            setVideoStatus('error');
            setVideoError(humanizeError(raw));
          }

          return;
        }

        setVideoStatus('error');
        setVideoError(humanizeError(raw));
      }
    });

    return () => subscription.remove();
  }, [player, streamUrl]);

  useEffect(() => {
    setIsPlaying(true);
  }, [streamUrl]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Brightness permission not granted');
        }
      } catch (error) {
        console.warn('Brightness permission request failed:', error);
      }

      try {
        const b = await Brightness.getBrightnessAsync();

        if (initialBrightness.current === null) {
          initialBrightness.current = b;
        }

        currentBrightness.current = b;
        setBrightnessLevel(b);
      } catch {
        // تجاهل لو ما فيه صلاحية
      }
      try {
        const v = await VolumeManager.getVolume();
        const volNum = typeof v === 'number' ? v : (v as any)?.volume ?? 0.5;
        currentVolume.current = volNum;
        setVolumeLevel(volNum);
      } catch {
        // تجاهل
      }
    })();

    VolumeManager.showNativeVolumeUI({ enabled: false });

    return () => {
        VolumeManager.showNativeVolumeUI({ enabled: true });
        if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);

        if (initialBrightness.current !== null) {
          Brightness.setBrightnessAsync(initialBrightness.current).catch(() => {});
        }

        NavBar.setVisibilityAsync('visible').catch(() => {});
        ScreenOrientation.unlockAsync().catch(() => {});
      };
  }, []);
  const backActionRef = useRef<() => void>(() => {});

  backActionRef.current = () => {
    if (lockedRef.current) {
      showControlsTemporarily();
      return;
    }

    if (fullscreenRef.current) {
      void toggleFullscreen();
      return;
    }

    void minimizePlayer();
  };

  useEffect(() => {
    if (!backRef) return;

    backRef.current = () => backActionRef.current();

    return () => {
      backRef.current = null;
    };
  }, [backRef]);



  const toggleFullscreen = async () => {
    const nextFullscreen = !fullscreenRef.current;

    fullscreenRef.current = nextFullscreen;
    setFullscreen(nextFullscreen);

    try {
      if (nextFullscreen) {
        NavBar.setVisibilityAsync('hidden').catch(() => {});

        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } else {
        NavBar.setVisibilityAsync('visible').catch(() => {});

        await ScreenOrientation.unlockAsync();
      }
    } catch (error) {
      console.warn('Fullscreen orientation error:', error);
    }
  };
const minimizePlayer = async () => {
    try {
      if (fullscreenRef.current) {
        fullscreenRef.current = false;
        setFullscreen(false);
        NavBar.setVisibilityAsync('visible').catch(() => {});
        await ScreenOrientation.unlockAsync();
      }
    } catch (error) {
      console.warn('Minimize orientation error:', error);
    }

    onMinimize();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const showIndicator = (type: 'brightness' | 'volume', value: number) => {
    if (type === 'brightness') {
      setBrightnessLevel(value);
    } else {
      setVolumeLevel(value);
    }

    setIndicator({ type, value });

    if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
    hideIndicatorTimeout.current = setTimeout(() => setIndicator(null), 700);
  };

  // نصف الشاشة الأيسر: إضاءة — نصف الشاشة الأيمن: صوت
  const touchStartX = useRef(0);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      showControlsTemporarily();
      touchStartX.current = e.x;
      brightnessStart.current = currentBrightness.current;
      volumeStart.current = currentVolume.current;
    })
    .onUpdate((e) => {
      if (lockedRef.current || !fullscreenRef.current) return;

      const { width, height } = dims.current;
      const delta = -e.translationY / height;

      if (touchStartX.current < width / 2) {
        let next = brightnessStart.current + delta;
        next = Math.max(0, Math.min(1, next));
        currentBrightness.current = next;
        Brightness.setBrightnessAsync(next).catch(() => {});
        showIndicator('brightness', next);
      } else {
        let next = volumeStart.current + delta;
        next = Math.max(0, Math.min(1, next));
        currentVolume.current = next;
        VolumeManager.setVolume(next);
        showIndicator('volume', next);
      }
    })
    .minDistance(8);

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (lockedRef.current) {
        showControlsTemporarily();
        return;
      }

      if (fullscreenRef.current) {
        if (showControls) {
          if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
          setShowControls(false);
        } else {
          showControlsTemporarily();
        }
      }
    });

  const videoGestures = Gesture.Exclusive(tapGesture, panGesture);


  return (
    <View style={styles.playerContainer}>
      {fullscreen && <StatusBar hidden />}

      {!fullscreen && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={minimizePlayer} style={styles.backButton}>
            <Ionicons name="chevron-down" size={18} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {channelName}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.videoContainer,
          fullscreen && styles.videoContainerFullscreen,
        ]}
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit={contentFit}
          nativeControls={false}
          pointerEvents="none"
          surfaceType="textureView"
        />

        {videoStatus === 'loading' && (
          <View style={styles.videoMessageOverlay} pointerEvents="none">
            <ActivityIndicator size="large" />
            <Text style={styles.videoMessageText}>
              {videoError || 'جارٍ تحميل البث...'}
            </Text>
          </View>
        )}

        {videoStatus === 'error' && (
          <View style={styles.videoMessageOverlay}>
            <Text style={styles.videoErrorIcon}>⚠️</Text>
            <Text style={styles.videoMessageText}>
              {videoError || 'تعذر تشغيل البث'}
            </Text>

            <TouchableOpacity
              style={styles.videoRetryButton}
              onPress={() => {
                retryCount.current = 0;
                setVideoStatus('loading');
                setVideoError(null);
                player.replace({ uri: streamUrl });
                player.play();
              }}
            >
              <Text style={styles.videoRetryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* طبقة السحب شفافة منفصلة فوق الفيديو — gesture-handler يلتقط اللمسة قبل أي native surface */}
        <GestureDetector gesture={videoGestures}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>

        {indicator && !fullscreen && (
          <View
            style={[
              styles.gestureIndicator,
              indicator.type === 'brightness'
                ? styles.gestureIndicatorLeft
                : styles.gestureIndicatorRight,
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name={indicator.type === 'brightness' ? 'sunny' : 'volume-high'}
              size={26}
              color="#fff"
              style={styles.gestureIndicatorIcon}
            />
            <Text style={styles.gestureIndicatorText}>
              {Math.round(indicator.value * 100)}%
            </Text>
          </View>
        )}

        {fullscreen && showControls && !locked && (
          <View
            style={[
              styles.fsTopBar,
              {
                paddingTop: insets.top + 8,
                paddingLeft: 12 + insets.left,
                paddingRight: 12 + insets.right,
              },
            ]}
          >
            <TouchableOpacity style={styles.fsTopButton} onPress={minimizePlayer}>
              <Ionicons name="chevron-down" size={18} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.fsTitle} numberOfLines={1}>
              {channelName}
            </Text>

            <HeaderClock />

            <TouchableOpacity style={styles.fsTopButton} onPress={cycleFit}>
              <Text style={styles.fsTopButtonText}>
                {FIT_MODES[fitIndex].label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fsTopButton}
              onPress={toggleFullscreen}
            >
              <Ionicons name="contract" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.fsTopButton} onPress={toggleLock}>
              <Ionicons name="lock-open-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {fullscreen && locked && showControls && (
          <TouchableOpacity
            style={[styles.lockBadge, { top: insets.top + 12 }]}
            onPress={toggleLock}
          >
            <Ionicons name="lock-closed" size={14} color="#fff" />
            <Text style={styles.lockBadgeText}> اضغط لفتح القفل</Text>
          </TouchableOpacity>
        )}

        {showControls && !locked && !fullscreen && (
          <TouchableOpacity
            style={[
              styles.fullscreenButton,
              {
                right: 12 + insets.right,
                bottom: 108 + insets.bottom,
              },
            ]}
            onPress={toggleFullscreen}
          >
            <Ionicons
              name={fullscreen ? 'contract' : 'expand'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {fullscreen && showControls && !locked && (
          <>
            <View
              style={[styles.sideSlider, { left: 20 + insets.left }]}
              pointerEvents="none"
            >
              <Ionicons name="sunny" size={18} color="#fff" style={styles.sideIcon} />
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { height: `${Math.round(brightnessLevel * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <View
              style={[styles.sideSlider, { right: 20 + insets.right }]}
              pointerEvents="none"
            >
              <Ionicons name="volume-high" size={18} color="#fff" style={styles.sideIcon} />
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { height: `${Math.round(volumeLevel * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </>
        )}

        {isTimeshift && showControls && !locked && (
          <TouchableOpacity
            style={[styles.tsBadge, { top: insets.top + 56 }]}
            onPress={() => onLive?.()}
          >
            <Ionicons name="play-back" size={13} color="#fff" />
            <Text style={styles.tsBadgeText}> تسجيل · العودة للمباشر</Text>
          </TouchableOpacity>
        )}

        {showTimeshift && (
          <View style={styles.tsOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowTimeshift(false)}
            />

            <View
              style={[
                styles.tsPanel,
                { paddingBottom: insets.bottom + 14 },
              ]}
            >
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>
                  الرتراباج · متاح {archiveDays} يوم
                </Text>

                <TouchableOpacity onPress={() => setShowTimeshift(false)}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.tsChipRow}>
                {TIMESHIFT_OPTIONS.filter((o) => o.min <= maxMinutes).map(
                  (o) => (
                    <TouchableOpacity
                      key={o.min}
                      style={styles.tsChip}
                      onPress={() => {
                        onTimeshift?.(o.min);
                        setShowTimeshift(false);
                      }}
                    >
                      <Text style={styles.tsChipText}>{o.label}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              {isTimeshift && (
                <TouchableOpacity
                  style={styles.tsLiveButton}
                  onPress={() => {
                    onLive?.();
                    setShowTimeshift(false);
                  }}
                >
                  <Ionicons name="radio" size={15} color="#fff" />
                  <Text style={styles.tsLiveText}> العودة للبث المباشر</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.tsHint}>
                إن لم يعمل التسجيل، جرّب الصيغة البديلة:
              </Text>

              <View style={styles.tsChipRow}>
                <TouchableOpacity
                  style={styles.tsAltButton}
                  onPress={() => {
                    onTimeshift?.(60, 0);
                    setShowTimeshift(false);
                  }}
                >
                  <Text style={styles.tsAltText}>صيغة ١ · /timeshift/</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tsAltButton}
                  onPress={() => {
                    onTimeshift?.(60, 1);
                    setShowTimeshift(false);
                  }}
                >
                  <Text style={styles.tsAltText}>صيغة ٢ · timeshift.php</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showChannelList && (
          <View style={styles.drawerOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowChannelList(false)}
            />

            <View
              style={[
                styles.channelDrawer,
                {
                  right: insets.right,
                  paddingTop: insets.top + 12,
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>
                  القنوات ({items.length})
                </Text>

                <TouchableOpacity onPress={() => setShowChannelList(false)}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={items}
                keyExtractor={(item, index) => String(item.stream_id ?? index)}
                initialScrollIndex={safeScrollIndex}
                getItemLayout={(_data, index) => ({
                  length: DRAWER_ITEM_HEIGHT,
                  offset: DRAWER_ITEM_HEIGHT * index,
                  index,
                })}
                initialNumToRender={14}
                maxToRenderPerBatch={10}
                windowSize={7}
                renderItem={({ item, index }) => {
                  const isActive = index === activeIndex;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.drawerItem,
                        isActive && styles.drawerItemActive,
                      ]}
                      onPress={() => {
                        onSelectIndex?.(index);
                        setShowChannelList(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.drawerNumber,
                          isActive && styles.drawerTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.stream_id}
                      </Text>

                      {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.drawerLogo}
                        />
                      ) : (
                        <View style={styles.drawerLogo} />
                      )}

                      <Text
                        style={[
                          styles.drawerName,
                          isActive && styles.drawerTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>

                      {isActive && (
                        <Ionicons name="volume-high" size={14} color="#ff1e27" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        )}

        {showControls && !locked && credentials && epgStreamId ? (
          <PlayerEpgBar
            credentials={credentials}
            streamId={epgStreamId}
            bottomOffset={92 + insets.bottom}
          />
        ) : null}

        {/* أزرار التحكم السفلية: سابق / تشغيل-إيقاف / تالي */}
        {showControls && !locked && (
          <View
            style={[
              styles.controlsBar,
              { bottom: 32 + insets.bottom },
            ]}
          >
          {items.length > 0 && (
            <TouchableOpacity
              style={[styles.controlButton, styles.drawerToggle]}
              onPress={() => setShowChannelList(true)}
            >
              <Ionicons name="list" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {archiveOn && (
            <TouchableOpacity
              style={[
                styles.controlButton,
                isTimeshift ? styles.tsButtonActive : styles.drawerToggle,
              ]}
              onPress={() => setShowTimeshift(true)}
            >
              <Ionicons name="time-outline" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlButton, !hasPrevious && styles.controlButtonDisabled]}
            onPress={onPrevious}
            disabled={!hasPrevious}
          >
            <Ionicons name="play-skip-back" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButtonPlay} onPress={togglePlayPause}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !hasNext && styles.controlButtonDisabled]}
            onPress={onNext}
            disabled={!hasNext}
          >
            <Ionicons name="play-skip-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        )}
      </View>
    </View>
  );
}

// ============================================================
// الفيديو المصغّر (يظهر عائمًا فوق شاشة القنوات)
// ============================================================
function MiniPlayer({
  streamUrl,
  channelName,
  onExpand,
  onClose,
}: {
  streamUrl: string;
  channelName: string;
  onExpand: () => void;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  useKeepAwake();
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  const pan = useRef(new Animated.ValueXY({ x: -16, y: -24 })).current;
  const current = useRef({ x: -16, y: -24 });
  const start = useRef({ x: -16, y: -24 });
  const screen = useRef({ width, height });
  const onExpandRef = useRef(onExpand);

  useEffect(() => {
    screen.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        start.current = { ...current.current };
      },

      onPanResponderMove: (_evt, g) => {
        const { width: w, height: h } = screen.current;

        const x = Math.max(
          -(w - 180),
          Math.min(4, start.current.x + g.dx)
        );

        const y = Math.max(
          -(h - 180),
          Math.min(24, start.current.y + g.dy)
        );

        current.current = { x, y };
        pan.setValue({ x, y });
      },

      onPanResponderRelease: (_evt, g) => {
        // لمسة قصيرة بدون سحب = تكبير المشغل
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          onExpandRef.current();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.miniPlayerWrapper,
        {
          bottom: 32 + insets.bottom,
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      <View
        style={styles.miniPlayerTouchable}
        {...panResponder.panHandlers}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VideoView
            player={player}
            style={styles.miniPlayerVideo}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
        </View>

        <Text style={styles.miniPlayerLabel} numberOfLines={1}>
          {channelName}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.miniPlayerClose}
        onPress={onClose}
      >
        <Ionicons name="close" size={12} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================
// ترويسات تحترم المنطقة الآمنة
// ============================================================
function HeaderClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.clockBox}>
      <Text style={styles.clockTime}>
        {now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      <Text style={styles.clockDate}>
        {now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </Text>
    </View>
  );
}

function PlayerEpgBar({
  credentials,
  streamId,
  bottomOffset,
}: {
  credentials: Credentials;
  streamId: string;
  bottomOffset: number;
}) {
  const [items, setItems] = useState<
    { title: string; start: number; end: number }[]
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getShortEpg(credentials, streamId, 4);
        const list = (data?.epg_listings || [])
          .map((l: any) => ({
            title: decodeBase64Text(l.title),
            start: Number(l.start_timestamp) * 1000,
            end: Number(l.stop_timestamp ?? l.end_timestamp) * 1000,
          }))
          .filter(
            (x: { title: string; start: number; end: number }) =>
              x.title && Number.isFinite(x.start) && Number.isFinite(x.end)
          )
          .sort((a: { start: number }, b: { start: number }) => a.start - b.start);

        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    };

    setItems([]);
    load();
    const id = setInterval(load, 60000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [streamId, credentials]);

  const current = items.find((x) => x.start <= nowMs && nowMs < x.end);
  const next = items.find((x) => x.start > nowMs);

  if (!current && !next) return null;

  const progress =
    current && current.end > current.start
      ? Math.min(1, Math.max(0, (nowMs - current.start) / (current.end - current.start)))
      : 0;

  return (
    <View style={[styles.epgBar, { bottom: bottomOffset }]} pointerEvents="none">
      {current && (
        <Text style={styles.epgNow} numberOfLines={1}>
          ● الآن: {current.title}
        </Text>
      )}

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>

      {next && (
        <Text style={styles.epgNext} numberOfLines={1}>
          › التالي: {next.title}
        </Text>
      )}
    </View>
  );
}

function TinyCard({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  colors: [string, string];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dashboardCardTiny}
      >
        {icon}
        <Text style={styles.dashboardCardTinyText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ScreenHeader({
  title,
  onBack,
  onLogout,
}: {
  title: string;
  onBack: () => void;
  onLogout?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>رجوع</Text>
      </TouchableOpacity>

      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      {onLogout ? (
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 60 }} />
      )}
    </View>
  );
}

function DashboardHeader({ onLogout }: { onLogout: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dashboardHeader, { paddingTop: insets.top + 10 }]}>
      <View style={styles.brandRow}>
        <Ionicons name="tv" size={22} color="#ff1e27" />
        <Text style={styles.dashboardBrand}>RABAH TV</Text>
      </View>

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>خروج</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// المكوّن الرئيسي
// ============================================================
// ============================================================
// لوحة دليل البرامج (العمود الأيمن)
// ============================================================
function EpgListPanel({
  credentials,
  streamId,
}: {
  credentials: Credentials;
  streamId: string;
}) {
  const [items, setItems] = useState<
    { title: string; start: number; end: number }[]
  >([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);

    (async () => {
      try {
        const data = await getShortEpg(credentials, streamId, 12);
        const list = (data?.epg_listings || []).map((l: any) => ({
          title: decodeBase64Text(l.title),
          start: Number(l.start_timestamp) * 1000,
          end: Number(l.stop_timestamp) * 1000,
        }));

        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [credentials, streamId]);

  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  if (busy) {
    return (
      <View style={styles.splitCenterBox}>
        <ActivityIndicator color="#ff1e27" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.splitCenterBox}>
        <Text style={styles.splitEmptyText}>لا يوجد دليل برامج</Text>
      </View>
    );
  }

  const now = Date.now();

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(item.start) + index}
      renderItem={({ item }) => {
        const live = now >= item.start && now < item.end;

        return (
          <View style={[styles.epgRow, live && styles.epgRowActive]}>
            <Text style={[styles.epgRowTime, live && styles.epgRowLiveText]}>
              {fmt(item.start)} - {fmt(item.end)}
            </Text>
            <Text
              style={[styles.epgRowTitle, live && styles.epgRowLiveText]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </View>
        );
      }}
    />
  );
}

// ============================================================
// معاينة الفيديو (العمود الأوسط)
// ============================================================
function PreviewPlayer({
  url,
  onExpand,
}: {
  url: string;
  onExpand: () => void;
}) {
  useKeepAwake();

  const player = useVideoPlayer(url, (pl) => {
    pl.play();
  });

  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    try {
      player.replace({ uri: url });
      player.play();
    } catch {
      // تجاهل
    }
  }, [url]);

  return (
    <View style={styles.previewBox}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
        surfaceType="textureView"
      />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onExpand}
      />

      <View style={styles.previewHint} pointerEvents="none">
        <Ionicons name="expand" size={12} color="#fff" />
        <Text style={styles.previewHintText}> اضغط للتكبير</Text>
      </View>
    </View>
  );
}

// ============================================================
// التخطيط المقسوم: قائمة | معاينة | دليل البرامج
// ============================================================
function ChannelsSplitView({
  title,
  channels,
  credentials,
  onBack,
  onPlay,
  isFavorite,
  onToggleFavorite,
}: {
  title: string;
  channels: Channel[];
  credentials: Credentials | null;
  onBack: () => void;
  onPlay: (channel: Channel) => void;
  isFavorite: (channel: Channel) => boolean;
  onToggleFavorite: (channel: Channel) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Channel | null>(
    channels[0] ?? null
  );

  useEffect(() => {
    setSelected(channels[0] ?? null);
  }, [channels]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [channels, query]);

  const previewUrl =
    selected && credentials
      ? getStreamUrl(credentials, String(selected.stream_id), 'm3u8')
      : '';

  return (
    <View
      style={[
        styles.splitRoot,
        {
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 6,
          paddingLeft: insets.left + 8,
          paddingRight: insets.right + 8,
        },
      ]}
    >
      <View style={styles.splitTopBar}>
        <TouchableOpacity onPress={onBack} style={styles.splitBackButton}>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.splitTitle} numberOfLines={1}>
          {title}
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="🔍 بحث..."
          placeholderTextColor="#7f8da3"
          style={styles.splitSearch}
        />

        <HeaderClock />
      </View>

      <View style={styles.splitBody}>
        <View style={styles.splitLeft}>
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => String(item.stream_id ?? index)}
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={
              <Text style={styles.splitEmptyText}>لا توجد نتائج</Text>
            }
            renderItem={({ item }) => {
              const active =
                selected != null &&
                String(selected.stream_id) === String(item.stream_id);

              return (
                <TouchableOpacity
                  style={[styles.splitRow, active && styles.splitRowActive]}
                  onPress={() => setSelected(item)}
                >
                  <TouchableOpacity
                    onPress={() => onToggleFavorite(item)}
                    style={styles.splitStar}
                  >
                    <Ionicons
                      name={isFavorite(item) ? 'star' : 'star-outline'}
                      size={16}
                      color={isFavorite(item) ? '#fbbf24' : '#6b7a92'}
                    />
                  </TouchableOpacity>

                  <Text style={styles.splitRowNum} numberOfLines={1}>
                    {item.stream_id}
                  </Text>

                  {item.stream_icon ? (
                    <Image
                      source={{ uri: item.stream_icon }}
                      style={styles.splitRowLogo}
                    />
                  ) : (
                    <View style={styles.splitRowLogo} />
                  )}

                  <Text style={styles.splitRowName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <TouchableOpacity
                    onPress={() => onPlay(item)}
                    style={styles.splitPlay}
                  >
                    <Ionicons name="play" size={14} color="#ff1e27" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View style={styles.splitCenter}>
          {previewUrl ? (
            <PreviewPlayer
              url={previewUrl}
              onExpand={() => selected && onPlay(selected)}
            />
          ) : (
            <View style={styles.previewBox} />
          )}

          <Text style={styles.splitNowTitle} numberOfLines={1}>
            {selected?.name || '—'}
          </Text>
        </View>

        <View style={styles.splitRight}>
          <Text style={styles.splitRightTitle}>دليل البرامج</Text>

          {selected && credentials ? (
            <EpgListPanel
              credentials={credentials}
              streamId={String(selected.stream_id)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ============================================================
// خلية واحدة في شبكة الشاشات المتعددة
// ============================================================
function MultiCell({
  channel,
  credentials,
  muted,
  focused,
  onFocus,
  onClear,
  onPick,
}: {
  channel: Channel | null;
  credentials: Credentials;
  muted: boolean;
  focused: boolean;
  onFocus: () => void;
  onClear: () => void;
  onPick: () => void;
}) {
  const url = channel
    ? getStreamUrl(credentials, String(channel.stream_id), 'm3u8')
    : '';

  const player = useVideoPlayer(url || null, (pl) => {
    if (url) {
      pl.muted = true;
      pl.play();
    }
  });

  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    try {
      if (url) {
        player.replace({ uri: url });
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // تجاهل
    }
  }, [url]);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // تجاهل
    }
  }, [muted, url]);

  if (!channel) {
    return (
      <TouchableOpacity style={styles.multiEmpty} onPress={onPick}>
        <Ionicons name="add-circle-outline" size={32} color="#4d6285" />
        <Text style={styles.multiEmptyText}>اختر قناة</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.multiCell, focused && styles.multiCellFocused]}
      activeOpacity={0.9}
      onPress={onFocus}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
        surfaceType="textureView"
      />

      <View style={styles.multiBar}>
        <Ionicons
          name={muted ? 'volume-mute' : 'volume-high'}
          size={12}
          color={muted ? '#8fa0bb' : '#ff1e27'}
        />

        <Text style={styles.multiName} numberOfLines={1}>
          {' '}{channel.name}
        </Text>

        <TouchableOpacity onPress={onClear} style={styles.multiClose}>
          <Ionicons name="close" size={12} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// شبكة 2×2 للقنوات المباشرة
// ============================================================
function MultiScreenView({
  credentials,
  channels,
  categories,
  onBack,
  onLoadCategory,
}: {
  credentials: Credentials;
  channels: Channel[];
  categories: CategoryItem[];
  onBack: () => void;
  onLoadCategory: (c: CategoryItem) => Promise<Channel[]>;
}) {
  const insets = useSafeAreaInsets();

  const [slots, setSlots] = useState<(Channel | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [audioSlot, setAudioSlot] = useState(0);
  const [picking, setPicking] = useState<number | null>(null);
  const [pool, setPool] = useState<Channel[]>(channels);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (channels.length) setPool(channels);
  }, [channels]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [pool, query]);

  const assign = (channel: Channel) => {
    if (picking === null) return;

    setSlots((prev) => {
      const next = [...prev];
      next[picking] = channel;
      return next;
    });

    setPicking(null);
    setQuery('');
  };

  const clearSlot = (i: number) =>
    setSlots((prev) => {
      const next = [...prev];
      next[i] = null;
      return next;
    });

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.multiHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          شاشات متعددة
        </Text>

        <TouchableOpacity
          onPress={() => setSlots([null, null, null, null])}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>تفريغ</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.multiHint}>
        اضغط شاشة لتفعيل صوتها · الصوت الآن: شاشة {audioSlot + 1}
      </Text>

      <View style={styles.multiGrid}>
        <View style={styles.multiRow}>
          {[0, 1].map((i) => (
            <MultiCell
              key={i}
              channel={slots[i]}
              credentials={credentials}
              muted={audioSlot !== i}
              focused={audioSlot === i}
              onFocus={() => setAudioSlot(i)}
              onClear={() => clearSlot(i)}
              onPick={() => setPicking(i)}
            />
          ))}
        </View>

        <View style={styles.multiRow}>
          {[2, 3].map((i) => (
            <MultiCell
              key={i}
              channel={slots[i]}
              credentials={credentials}
              muted={audioSlot !== i}
              focused={audioSlot === i}
              onFocus={() => setAudioSlot(i)}
              onClear={() => clearSlot(i)}
              onPick={() => setPicking(i)}
            />
          ))}
        </View>
      </View>

      {picking !== null && (
        <View style={styles.multiPickerOverlay}>
          <View
            style={[
              styles.multiPicker,
              { paddingBottom: insets.bottom + 10 },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>
                اختر قناة للشاشة {picking + 1}
              </Text>

              <TouchableOpacity onPress={() => setPicking(null)}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#7f8da3" style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث..."
                placeholderTextColor="#7f8da3"
                style={styles.searchInput}
              />
            </View>

            {categories.length > 0 && (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categories}
                keyExtractor={(c, i) => String(c.category_id ?? i)}
                style={{ maxHeight: 48 }}
                contentContainerStyle={{ paddingHorizontal: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.seasonChip}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        const data = await onLoadCategory(item);
                        setPool(data);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Text style={styles.seasonChipText} numberOfLines={1}>
                      {item.category_name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}

            {busy ? (
              <View style={styles.center}>
                <ActivityIndicator color="#ff1e27" />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(c, i) => String(c.stream_id ?? i)}
                initialNumToRender={12}
                removeClippedSubviews={Platform.OS === 'android'}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>لا توجد قنوات</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => assign(item)}
                  >
                    {item.stream_icon ? (
                      <Image
                        source={{ uri: item.stream_icon }}
                        style={styles.drawerLogo}
                      />
                    ) : (
                      <View style={styles.drawerLogo} />
                    )}

                    <Text style={styles.drawerName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================
// دليل البرامج الكامل (قنوات + EPG)
// ============================================================
function EpgGuideView({
  credentials,
  categories,
  channels,
  onBack,
  onPlay,
  onLoadCategory,
}: {
  credentials: Credentials;
  categories: CategoryItem[];
  channels: Channel[];
  onBack: () => void;
  onPlay: (channel: Channel) => void;
  onLoadCategory: (c: CategoryItem) => Promise<Channel[]>;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [pool, setPool] = useState<Channel[]>(channels);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeCat, setActiveCat] = useState<string>('');
  const [selected, setSelected] = useState<Channel | null>(
    channels[0] ?? null
  );

  useEffect(() => {
    if (channels.length) {
      setPool(channels);
      setSelected((prev) => prev ?? channels[0]);
    }
  }, [channels]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [pool, query]);

  const pickCategory = async (c: CategoryItem) => {
    setBusy(true);
    setActiveCat(String(c.category_id));

    try {
      const data = await onLoadCategory(c);
      setPool(data);
      setSelected(data[0] ?? null);
      setQuery('');
    } finally {
      setBusy(false);
    }
  };

  const listPane = (
    <View style={landscape ? styles.guideLeft : styles.guideTop}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#7f8da3" style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن قناة..."
          placeholderTextColor="#7f8da3"
          style={styles.searchInput}
        />
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff1e27" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => String(item.stream_id ?? i)}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <Text style={styles.splitEmptyText}>
              اختر فئة من الأعلى لعرض قنواتها
            </Text>
          }
          renderItem={({ item }) => {
            const active =
              selected != null &&
              String(selected.stream_id) === String(item.stream_id);

            return (
              <TouchableOpacity
                style={[styles.splitRow, active && styles.splitRowActive]}
                onPress={() => setSelected(item)}
              >
                {item.stream_icon ? (
                  <Image
                    source={{ uri: item.stream_icon }}
                    style={styles.splitRowLogo}
                  />
                ) : (
                  <View style={styles.splitRowLogo} />
                )}

                <Text style={styles.splitRowName} numberOfLines={1}>
                  {item.name}
                </Text>

                <TouchableOpacity
                  onPress={() => onPlay(item)}
                  style={styles.splitPlay}
                >
                  <Text style={styles.splitPlayText}>▶</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  const epgPane = (
    <View style={landscape ? styles.guideRight : styles.guideBottom}>
      <View style={styles.guideEpgHeader}>
        <Text style={styles.guideEpgTitle} numberOfLines={1}>
          📖 {selected?.name || 'اختر قناة'}
        </Text>

        {selected && (
          <TouchableOpacity
            style={styles.guidePlayButton}
            onPress={() => onPlay(selected)}
          >
            <Text style={styles.guidePlayText}>▶ تشغيل</Text>
          </TouchableOpacity>
        )}
      </View>

      {selected ? (
        <EpgListPanel
          credentials={credentials}
          streamId={String(selected.stream_id)}
        />
      ) : (
        <View style={styles.splitCenterBox}>
          <Text style={styles.splitEmptyText}>لم تُحدَّد قناة</Text>
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.flex,
        {
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 6,
          paddingLeft: insets.left + 8,
          paddingRight: insets.right + 8,
        },
      ]}
    >
      <View style={styles.splitTopBar}>
        <TouchableOpacity onPress={onBack} style={styles.splitBackButton}>
          <Text style={styles.splitBackText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.splitTitle} numberOfLines={1}>
          📖 مباشر مع EPG
        </Text>

        <View style={{ flex: 1 }} />

        <HeaderClock />
      </View>

      {categories.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c, i) => String(c.category_id ?? i)}
          style={styles.guideCatBar}
          contentContainerStyle={{ paddingHorizontal: 4 }}
          renderItem={({ item }) => {
            const on = activeCat === String(item.category_id);

            return (
              <TouchableOpacity
                style={[styles.seasonChip, on && styles.seasonChipActive]}
                onPress={() => pickCategory(item)}
              >
                <Text
                  style={[
                    styles.seasonChipText,
                    on && styles.seasonChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.category_name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <View style={landscape ? styles.guideBodyRow : styles.guideBodyCol}>
        {listPane}
        {epgPane}
      </View>
    </View>
  );
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [screen, setScreen] = useState<Screen>('entry');
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryIndex, setCategoryIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [lastWatched, setLastWatched] = useState<WatchedItem | null>(null);
  const [movieCategories, setMovieCategories] = useState<CategoryItem[]>([]);
  const [movies, setMovies] = useState<Channel[]>([]);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [selectedMovieCategory, setSelectedMovieCategory] = useState('');

  const [localGroups, setLocalGroups] = useState<IPTVGroup[]>([]);
  const [localChannels, setLocalChannels] = useState<IPTVChannel[]>([]);
  const [selectedLocalGroup, setSelectedLocalGroup] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('IPTV المحلي');
  const [m3uSources, setM3USources] = useState<M3USource[]>([]);
  const [m3uName, setM3UName] = useState('');
  const [m3uUrl, setM3UUrl] = useState('');

  const [activeChannel, setActiveChannel] = useState<{
    url: string;
    name: string;
    index: number;
    source: 'live' | 'movie' | 'series' | 'local';
    streamId: string;
    archiveDays?: number;
    timeshift?: boolean;
  } | null>(null);
  const [playerMinimized, setPlayerMinimized] = useState(false);

  const [seriesCategories, setSeriesCategories] = useState<CategoryItem[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [seriesSearch, setSeriesSearch] = useState('');
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [episodesBySeason, setEpisodesBySeason] = useState<
    Record<string, Channel[]>
  >({});
  const [selectedSeason, setSelectedSeason] = useState('');
  const [episodes, setEpisodes] = useState<Channel[]>([]);

  const [loading, setLoading] = useState(false);

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isLandscape = winWidth > winHeight;

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});

    loadFavorites();
    loadLastWatched();
return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  async function loadFavorites() {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        setFavorites(JSON.parse(raw));
      }
    } catch {
      // تجاهل
    }
  }

  const toggleFavorite = useCallback(async (channel: Channel) => {
    setFavorites((prev) => {
      const exists = prev.some((c) => String(c.stream_id) === String(channel.stream_id));
      const next = exists
        ? prev.filter((c) => String(c.stream_id) !== String(channel.stream_id))
        : [...prev, channel];
      AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const favoriteIds = React.useMemo(
    () => new Set(favorites.map((c) => String(c.stream_id))),
    [favorites]
  );

  function isFavorite(channel: Channel) {
    return favoriteIds.has(String(channel.stream_id));
  }

  function openFavorites() {
    setChannels(favorites);
    setSelectedCategory('⭐ المفضلة');
    setCategoryIndex(-1);
    setSearchQuery('');
    setScreen('channels');
  }

  async function loadLastWatched() {
    try {
      const raw = await AsyncStorage.getItem(LAST_WATCHED_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      // ترقية الصيغة القديمة (كانت تخزّن القناة مباشرة)
      if (parsed && parsed.item) {
        setLastWatched(parsed as WatchedItem);
      } else if (parsed && parsed.stream_id != null) {
        setLastWatched({ item: parsed as Channel, source: 'live' });
      }
    } catch {
      // تجاهل
    }
  }

  function rememberWatched(
    item: Channel,
    source: 'live' | 'movie' | 'series'
  ) {
    const entry: WatchedItem = { item, source };
    setLastWatched(entry);
    AsyncStorage.setItem(
      LAST_WATCHED_STORAGE_KEY,
      JSON.stringify(entry)
    ).catch(() => {});
  }

  function resumeLastWatched() {
    if (!credentials || !lastWatched) return;

    const { item, source } = lastWatched;
    const id = String(item.stream_id);

    let url = '';
    let list: Channel[] = [];

    if (source === 'movie') {
      url = getVodStreamUrl(
        credentials,
        item.stream_id,
        item.container_extension || 'mkv'
      );
      list = movies;
    } else if (source === 'series') {
      url = getSeriesEpisodeUrl(
        credentials,
        item.stream_id,
        item.container_extension || 'mkv'
      );
      list = episodes;
    } else {
      url = getStreamUrl(credentials, id, 'm3u8');
      list = channels;
    }

    const index = list.findIndex((c) => String(c.stream_id) === id);

    setActiveChannel({
      url,
      name: item.name || 'مشاهدة',
      index: index >= 0 ? index : -1,
      source,
      streamId: id,
    });

    setPlayerMinimized(false);
  }

  async function loadSavedCredentials() {
    try {
      const saved = await getSavedCredentials();
      if (!saved) return;

      setServer(saved.server || '');
      setUsername(saved.username || '');
      setPassword(saved.password || '');

      await handleLogin(saved, true);
    } catch {
      // تجاهل
    }
  }

  async function handleLogin(creds?: Credentials, silent = false) {
    const current: Credentials = creds || {
      server: server.trim(),
      username: username.trim(),
      password,
    };

    if (!current.server || !current.username || !current.password) {
      if (!silent) {
        Alert.alert('تنبيه', 'أدخل السيرفر واسم المستخدم وكلمة المرور');
      }
      return;
    }

    try {
      setLoading(true);
      const result = await login(current);

      if (result?.user_info?.auth !== 1) {
        throw new Error('بيانات الدخول غير صحيحة');
      }

      await saveCredentials(current);
      setCredentials(current);
      await loadCategories(current);
    } catch (error: any) {
      if (!silent) {
        Alert.alert('فشل تسجيل الدخول', error?.message || 'تعذر الاتصال بالسيرفر');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories(creds: Credentials) {
    try {
      setLoading(true);
      const data = await getLiveCategories(creds);
      setCategories(Array.isArray(data) ? data : []);
      setScreen('dashboard');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب الفئات');
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedM3USources() {
    try {
      const raw = await AsyncStorage.getItem(M3U_SOURCES_STORAGE_KEY);
      if (!raw) {
        setM3USources([]);
        return [];
      }

      const parsed = JSON.parse(raw);
      const sources = Array.isArray(parsed) ? parsed : [];
      setM3USources(sources);
      return sources;
    } catch {
      setM3USources([]);
      return [];
    }
  }

  async function saveM3USources(sources: M3USource[]) {
    setM3USources(sources);
    await AsyncStorage.setItem(
      M3U_SOURCES_STORAGE_KEY,
      JSON.stringify(sources)
    );
  }

  async function openLocalIPTV() {
    try {
      setLocalLoading(true);

      const data = await loadIPTVPlaylist();

      setLocalChannels(data);
      setLocalGroups(groupIPTVChannels(data));
      setSelectedLocalGroup('');
      setPlaylistTitle('IPTV المحلي');
      setScreen('local-groups');
    } catch (error: any) {
      Alert.alert(
        'IPTV المحلي',
        error?.message || 'تعذر تحميل قائمة IPTV المحلية'
      );
    } finally {
      setLocalLoading(false);
    }
  }

  async function openM3USources() {
    await loadSavedM3USources();
    setScreen('m3u-sources');
  }

  async function addM3USource() {
    const name = m3uName.trim();
    const url = m3uUrl.trim();

    if (!name) {
      Alert.alert('M3U', 'اكتب اسمًا للقائمة');
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      Alert.alert('M3U', 'رابط M3U يجب أن يبدأ بـ http:// أو https://');
      return;
    }

    try {
      const sources = await loadSavedM3USources();

      const source: M3USource = {
        id: Date.now().toString(),
        name,
        url,
      };

      await saveM3USources([...sources, source]);

      setM3UName('');
      setM3UUrl('');
      setScreen('m3u-sources');

      Alert.alert('تم', 'تم حفظ قائمة M3U');
    } catch (error: any) {
      Alert.alert(
        'خطأ',
        error?.message || 'تعذر حفظ قائمة M3U'
      );
    }
  }

  async function deleteM3USource(source: M3USource) {
    Alert.alert(
      'حذف القائمة',
      `هل تريد حذف "${source.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const sources = await loadSavedM3USources();
            await saveM3USources(
              sources.filter((item: M3USource) => item.id !== source.id)
            );
          },
        },
      ]
    );
  }

  async function loadM3USource(source: M3USource) {
    try {
      setLocalLoading(true);

      const response = await fetch(source.url);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const content = await response.text();

      if (!content.trim()) {
        throw new Error('ملف M3U فارغ');
      }

      const data = parseIPTVPlaylist(content);

      if (!data.length) {
        throw new Error('لم يتم العثور على قنوات داخل ملف M3U');
      }

      setLocalChannels(data);
      setLocalGroups(groupIPTVChannels(data));
      setSelectedLocalGroup('');
      setPlaylistTitle(source.name);
      setScreen('local-groups');
    } catch (error: any) {
      Alert.alert(
        'تعذر تحميل M3U',
        error?.message || 'تأكد من الرابط وأن ملف M3U صالح'
      );
    } finally {
      setLocalLoading(false);
    }
  }

  const openCategory = useCallback(async (category: CategoryItem) => {
    if (!credentials) return;

    try {
      setLoading(true);
      setSelectedCategory(String(category.category_name));
      setCategoryIndex(
        categories.findIndex(
          (c) => String(c.category_id) === String(category.category_id)
        )
      );

      const data = await getLiveStreams(credentials, String(category.category_id));
      setChannels(Array.isArray(data) ? data : []);
      setSearchQuery('');
      setScreen('channels');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب القنوات');
    } finally {
      setLoading(false);
    }
  }, [credentials, categories]);

  const [tsVariant, setTsVariant] = useState(0);

  function playTimeshift(minutesAgo: number, variant = tsVariant) {
    if (!credentials || !activeChannel) return;
    if (activeChannel.source !== 'live') return;

    const start = new Date(Date.now() - minutesAgo * 60000);
    const duration = Math.min(minutesAgo, 240);

    const url = getTimeshiftUrl(
      credentials,
      activeChannel.streamId,
      start,
      duration,
      'ts',
      variant
    );

    setTsVariant(variant);

    setActiveChannel({
      ...activeChannel,
      url,
      timeshift: true,
    });
  }

  function backToLive() {
    if (!credentials || !activeChannel) return;

    const url = getStreamUrl(credentials, activeChannel.streamId, 'm3u8');

    setActiveChannel({
      ...activeChannel,
      url,
      timeshift: false,
    });
  }

  function shiftCategory(delta: number) {
    if (categoryIndex < 0) return;

    const next = categoryIndex + delta;
    if (next < 0 || next >= categories.length) return;

    openCategory(categories[next]);
  }

  function archiveDaysOf(channel: Channel) {
    const on = String(channel.tv_archive ?? '0') === '1';
    if (!on) return 0;

    const d = Number(channel.tv_archive_duration ?? 0);
    return Number.isFinite(d) && d > 0 ? d : 7;
  }

  function playChannelAtIndex(index: number) {
    if (!credentials) return;
    const channel = channels[index];
    if (!channel) return;

    const url = getStreamUrl(credentials, String(channel.stream_id), 'm3u8');
    setActiveChannel({
      url,
      name: channel.name || 'قناة',
      index,
      source: 'live',
      streamId: String(channel.stream_id),
      archiveDays: archiveDaysOf(channel),
      timeshift: false,
    });

    rememberWatched(channel, 'live');
  }

  const openChannel = useCallback((channel: Channel) => {
    if (!credentials) return;

    const index = channels.findIndex((c) => String(c.stream_id) === String(channel.stream_id));
    const url = getStreamUrl(credentials, String(channel.stream_id), 'm3u8');

    // تجنب إعادة تشغيل نفس القناة إذا كانت مفتوحة بالفعل
    if (activeChannel?.url === url && !playerMinimized) return;

    setActiveChannel({
      url,
      name: channel.name || 'قناة',
      index,
      source: 'live',
      streamId: String(channel.stream_id),
      archiveDays: archiveDaysOf(channel),
      timeshift: false,
    });
    setPlayerMinimized(false);

    rememberWatched(channel, 'live');
  }, [credentials, channels, activeChannel, playerMinimized]);

  async function openMovieCategories() {
    if (!credentials) return;
    try {
      setLoading(true);
      const data = await getVodCategories(credentials);
      setMovieCategories(Array.isArray(data) ? data : []);
      setScreen('movies-categories');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب فئات الأفلام');
    } finally {
      setLoading(false);
    }
  }

  async function openMovieCategory(category: CategoryItem) {
    if (!credentials) return;
    try {
      setLoading(true);
      setSelectedMovieCategory(String(category.category_name));
      const data = await getVodStreams(credentials, String(category.category_id));
      setMovies(Array.isArray(data) ? data : []);
      setScreen('movies-list');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب الأفلام');
    } finally {
      setLoading(false);
    }
  }

  function playMovieAtIndex(index: number) {
    if (!credentials) return;
    const movie = movies[index];
    if (!movie) return;

    const url = getVodStreamUrl(credentials, movie.stream_id, movie.container_extension || 'mp4');
    setActiveChannel({
      url,
      name: movie.name || 'فيلم',
      index,
      source: 'movie',
      streamId: String(movie.stream_id),
    });

    rememberWatched(movie, 'movie');
  }

  function openMovie(movie: Channel) {
    if (!credentials) return;
    const index = movies.findIndex((m) => String(m.stream_id) === String(movie.stream_id));
    const url = getVodStreamUrl(credentials, movie.stream_id, movie.container_extension || 'mp4');
    setActiveChannel({
      url,
      name: movie.name || 'فيلم',
      index,
      source: 'movie',
      streamId: String(movie.stream_id),
    });

    rememberWatched(movie, 'movie');
    setPlayerMinimized(false);
  }

  async function openSeriesCategories() {
    if (!credentials) return;

    try {
      setLoading(true);
      const data = await getSeriesCategories(credentials);
      setSeriesCategories(Array.isArray(data) ? data : []);
      setScreen('series-categories');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب فئات المسلسلات');
    } finally {
      setLoading(false);
    }
  }

  async function openSeriesCategory(category: CategoryItem) {
    if (!credentials) return;

    try {
      setLoading(true);
      const data = await getSeries(credentials, String(category.category_id));
      setSeriesList(Array.isArray(data) ? data : []);
      setSeriesSearch('');
      setScreen('series-list');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب المسلسلات');
    } finally {
      setLoading(false);
    }
  }

  async function openSeriesDetail(item: SeriesItem) {
    if (!credentials) return;

    try {
      setLoading(true);
      const data = await getSeriesInfo(credentials, String(item.series_id));
      const rawAny = data?.episodes;

      // بعض السيرفرات ترجع مصفوفة بدل كائن مواسم
      const raw: Record<string, any[]> = Array.isArray(rawAny)
        ? { '1': rawAny }
        : rawAny && typeof rawAny === 'object'
        ? rawAny
        : {};

      const keys = Object.keys(raw).sort((a, b) => Number(a) - Number(b));
      const map: Record<string, Channel[]> = {};

      keys.forEach((key) => {
        map[key] = (raw[key] || []).map((ep: any) => ({
          stream_id: ep.id,
          name:
            String(ep.title || '').trim() ||
            `الحلقة ${ep.episode_num}`,
          stream_icon: ep.info?.movie_image,
          container_extension:
            ep.container_extension || ep.info?.container_extension || 'mkv',
        }));
      });

      const first = keys[0] || '';

      setSeasons(keys);
      setEpisodesBySeason(map);
      setSelectedSeason(first);
      setEpisodes(map[first] || []);
      setSeriesTitle(item.name || 'مسلسل');
      setScreen('series-detail');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب حلقات المسلسل');
    } finally {
      setLoading(false);
    }
  }

  function selectSeason(key: string) {
    setSelectedSeason(key);
    setEpisodes(episodesBySeason[key] || []);
  }

  function playEpisodeAtIndex(index: number) {
    if (!credentials) return;

    const ep = episodes[index];
    if (!ep) return;

    const url = getSeriesEpisodeUrl(
      credentials,
      ep.stream_id,
      ep.container_extension || 'mp4'
    );

    setActiveChannel({
      url,
      name: ep.name || 'حلقة',
      index,
      source: 'series',
      streamId: String(ep.stream_id),
    });

    rememberWatched(ep, 'series');
  }

  function openEpisode(ep: Channel) {
    const index = episodes.findIndex(
      (e) => String(e.stream_id) === String(ep.stream_id)
    );

    playEpisodeAtIndex(index >= 0 ? index : 0);
    setPlayerMinimized(false);
  }

  function playLocalChannelAtIndex(index: number) {
    const channel = localChannels[index];
    if (!channel || !channel.url) return;

    setActiveChannel({
      url: channel.url,
      name: channel.name || 'قناة',
      index,
      source: 'local',
      streamId: '',
      archiveDays: 0,
      timeshift: false,
    });

    setPlayerMinimized(false);
  }

  function playAtIndex(
    index: number,
    source: 'live' | 'movie' | 'series' | 'local'
  ) {
    if (source === 'movie') {
      playMovieAtIndex(index);
    } else if (source === 'series') {
      playEpisodeAtIndex(index);
    } else if (source === 'local') {
      playLocalChannelAtIndex(index);
    } else {
      playChannelAtIndex(index);
    }
  }

  function currentPlaylist(
    source: 'live' | 'movie' | 'series' | 'local'
  ): Channel[] {
    if (source === 'movie') return movies;
    if (source === 'series') return episodes;
    if (source === 'local') {
      return localChannels.map((channel, index) => ({
        stream_id: 'local-' + index,
        name: channel.name || 'قناة',
        stream_icon: channel.logo || '',
      }));
    }
    return channels;
  }

  function goToNextChannel() {
    if (!activeChannel) return;

    const list = currentPlaylist(activeChannel.source);

    if (activeChannel.index >= 0 && activeChannel.index < list.length - 1) {
      playAtIndex(activeChannel.index + 1, activeChannel.source);
    }
  }

  function goToPreviousChannel() {
    if (!activeChannel) return;

    if (activeChannel.index > 0) {
      playAtIndex(activeChannel.index - 1, activeChannel.source);
    }
  }

  async function logout() {
    await clearCredentials();

    setCredentials(null);
    setCategories([]);
    setChannels([]);
    setSelectedCategory('');
    setActiveChannel(null);
    setPlayerMinimized(false);
    setServer('');
    setUsername('');
    setPassword('');
    setScreen('login');
  }

  function goBack() {
      if (activeChannel) {
        closePlayer();
        return;
      }
    if (screen === 'local-channels') {
      setScreen('local-groups');
      return;
    }

    if (screen === 'local-groups') {
      setScreen('dashboard');
      return;
    }

    if (screen === 'm3u-add') {
      setScreen('m3u-sources');
      return;
    }

    if (screen === 'm3u-sources') {
      setScreen('dashboard');
      return;
    }

    if (screen === 'channels') {
      setScreen('categories');
      return;
    }
      if (screen === 'epg-guide') {
        setScreen('dashboard');
        return;
      }

      if (screen === 'multiscreen') {
        setScreen('dashboard');
        return;
      }

      if (screen === 'series-detail') {
        setScreen('series-list');
        return;
      }

      if (screen === 'series-list') {
        setScreen('series-categories');
        return;
      }

      if (screen === 'series-categories') {
        setScreen('dashboard');
        return;
      }

      if (screen === 'movies-list') {
      setScreen('movies-categories');
      return;
    }
    if (screen === 'categories' || screen === 'movies-categories') {
      setScreen('dashboard');
      return;
    }
    onClose();
  }

  const lastBackAt = useRef(0);
  const playerBackRef = useRef<(() => void) | null>(null);

  function handleHardwareBack() {
    const now = Date.now();

    if (now - lastBackAt.current < 250) return;
    lastBackAt.current = now;

    if (activeChannel && !playerMinimized) {
      if (playerBackRef.current) {
        playerBackRef.current();
      } else {
        setPlayerMinimized(true);
      }
      return;
    }

    goBack();
  }

  const hardwareBackRef = useRef(handleHardwareBack);
  hardwareBackRef.current = handleHardwareBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        hardwareBackRef.current?.();
        return true;
      }
    );

    return () => sub.remove();
  }, []);


  function closePlayer() {
    setActiveChannel(null);
    setPlayerMinimized(false);
      NavBar.setVisibilityAsync('visible').catch(() => {});
    ScreenOrientation.unlockAsync().catch(() => {});
  }

  function renderHeader(title: string) {
    return (
      <ScreenHeader
        title={title}
        onBack={goBack}
        onLogout={screen === 'categories' ? logout : undefined}
      />
    );
  }

  const [visibleEpgIds, setVisibleEpgIds] = useState<Set<string>>(
    () => new Set()
  );

  const onChannelsViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: Channel }> }) => {
      const next = new Set<string>();

      for (const viewable of viewableItems) {
        if (viewable?.item?.stream_id != null) {
          next.add(String(viewable.item.stream_id));
        }
      }

      // حذف EPG للقنوات التي خرجت من النطاق المرئي
      if (credentials) {
        const prefix = `${credentials.server}_${credentials.username}_`;

        for (const key of epgCache.keys()) {
          if (!key.startsWith(prefix)) continue;

          const streamId = key.slice(prefix.length);
          if (!next.has(streamId)) {
            epgCache.delete(key);
          }
        }
      }

      setVisibleEpgIds(next);
    },
    [credentials]
  );

  const channelsViewabilityConfig = React.useMemo(
    () => ({
      itemVisiblePercentThreshold: 20,
    }),
    []
  );

  const filteredChannels = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return channels;

    return channels.filter((c) =>
      (c.name || '').toLowerCase().includes(q)
    );
  }, [channels, searchQuery]);

  const showExpandedPlayer = activeChannel && !playerMinimized;
  const showMiniPlayer = activeChannel && playerMinimized;

  const filteredMovies = movies.filter((movie: Channel) =>
    (movie.name || '').toLowerCase().includes(movieSearchQuery.toLowerCase())
  );


  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible
      onRequestClose={() => hardwareBackRef.current?.()}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>

      {showExpandedPlayer ? (
        <View style={styles.container}>
          <PlayerView
            streamUrl={activeChannel!.url}
            channelName={activeChannel!.name}
            onMinimize={() => setPlayerMinimized(true)}
            backRef={playerBackRef}
            onClose={closePlayer}
            hasNext={
              activeChannel!.index >= 0 &&
              activeChannel!.index <
                currentPlaylist(activeChannel!.source).length - 1
            }
            hasPrevious={activeChannel!.index > 0}
            onNext={goToNextChannel}
            onPrevious={goToPreviousChannel}
            credentials={credentials}
            epgStreamId={
              activeChannel!.source === 'live' ? activeChannel!.streamId : ''
            }
            playlist={currentPlaylist(activeChannel!.source)}
            currentIndex={activeChannel!.index}
            onSelectIndex={(i) => playAtIndex(i, activeChannel!.source)}
            archiveDays={
              activeChannel!.source === 'live'
                ? activeChannel!.archiveDays ?? 0
                : 0
            }
            isTimeshift={!!activeChannel!.timeshift}
            onTimeshift={(min, variant) => playTimeshift(min, variant)}
            onLive={() => {
            if (activeChannel!.source === 'live') {
              backToLive();
            }
          }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {screen === 'entry' && (
        <View style={styles.entryScreen}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryTitle}>Rabah مباشر</Text>
            <Text style={styles.entrySubtitle}>
              اختر مصدر المشاهدة
            </Text>
          </View>

          <View style={styles.entryCards}>
            <TouchableOpacity
              style={styles.entryCard}
              activeOpacity={0.82}
              onPress={async () => {
                try {
                  const saved = await getSavedCredentials();

                  if (saved) {
                    setServer(saved.server || '');
                    setUsername(saved.username || '');
                    setPassword(saved.password || '');
                    await handleLogin(saved, true);
                  } else {
                    setScreen('login');
                  }
                } catch {
                  setScreen('login');
                }
              }}
            >
              <View style={styles.entryIconCircle}>
                <Ionicons
                  name="tv-outline"
                  size={42}
                  color="#fff"
                />
              </View>

              <Text style={styles.entryCardTitle}>Xtream</Text>
              <Text style={styles.entryCardSubtitle}>
                القنوات والأفلام والمسلسلات
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.entryCard}
              activeOpacity={0.82}
              onPress={() => setScreen('m3u-sources')}
            >
              <View style={styles.entryIconCircle}>
                <MaterialCommunityIcons
                  name="web"
                  size={42}
                  color="#fff"
                />
              </View>

              <Text style={styles.entryCardTitle}>M3U</Text>
              <Text style={styles.entryCardSubtitle}>
                قوائم IPTV من الروابط
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.entryCard}
              activeOpacity={0.82}
              onPress={() => {
                setPlaylistTitle('IPTV المحلي');
                setScreen('local-groups');
              }}
            >
              <View style={styles.entryIconCircle}>
                <MaterialCommunityIcons
                  name="access-point"
                  size={42}
                  color="#fff"
                />
              </View>

              <Text style={styles.entryCardTitle}>IPTV المحلي</Text>
              <Text style={styles.entryCardSubtitle}>
                القائمة الموجودة داخل التطبيق
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.entryCloseButton}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color="#fff" />
            <Text style={styles.entryCloseText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'login' && (
            <View style={styles.flex}>
              {renderHeader('📺 قنوات المباشرة Rabah')}

              <View style={styles.content}>
                <Text style={styles.logo}>📺</Text>
                <Text style={styles.title}>تسجيل الدخول إلى IPTV</Text>
                <Text style={styles.subtitle}>أدخل بيانات Xtream الخاصة بك</Text>

                <TextInput
                  value={server}
                  onChangeText={setServer}
                  placeholder="رابط السيرفر"
                  placeholderTextColor="#7f8da3"
                  autoCapitalize="none"
                  keyboardType="url"
                  style={styles.input}
                />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="اسم المستخدم"
                  placeholderTextColor="#7f8da3"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="كلمة المرور"
                  placeholderTextColor="#7f8da3"
                  autoCapitalize="none"
                  secureTextEntry
                  style={styles.input}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleLogin()}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>دخول</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {screen === 'dashboard' && (
            <View style={styles.flex}>
              <DashboardHeader onLogout={logout} />

              <View style={styles.dashboardGrid}>
                {lastWatched && (
                  <TouchableOpacity style={styles.resumeCard} onPress={resumeLastWatched}>
                    <Ionicons name="play-circle" size={30} color="#ff1e27" style={styles.resumeIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resumeLabel}>
                        متابعة المشاهدة ·{' '}
                        {lastWatched.source === 'movie'
                          ? '🎬 فيلم'
                          : lastWatched.source === 'series'
                          ? '🎞️ مسلسل'
                          : '📡 مباشر'}
                      </Text>
                      <Text style={styles.resumeChannelName} numberOfLines={1}>
                        {lastWatched.item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setScreen('categories')}
                >
                  <LinearGradient
                    colors={['#16a34a', '#0f766e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dashboardCardLarge}
                  >
                    <MaterialCommunityIcons
                      name="satellite-variant"
                      size={40}
                      color="#fff"
                      style={styles.dashboardCardIcon}
                    />
                    <Text style={styles.dashboardCardTitle}>TV مباشر</Text>
                  </LinearGradient>
                </TouchableOpacity>



                <View style={styles.dashboardRow}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.85}
                    onPress={openMovieCategories}
                  >
                    <LinearGradient
                      colors={['#dc2626', '#991b1b']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dashboardCardSmall}
                    >
                      <MaterialCommunityIcons
                        name="movie-open"
                        size={34}
                        color="#fff"
                        style={styles.dashboardCardIcon}
                      />
                      <Text style={styles.dashboardCardTitle}>أفلام</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.85}
                    onPress={openSeriesCategories}
                  >
                    <LinearGradient
                      colors={['#7c3aed', '#4c1d95']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dashboardCardSmall}
                    >
                      <MaterialCommunityIcons
                        name="television-classic"
                        size={34}
                        color="#fff"
                        style={styles.dashboardCardIcon}
                      />
                      <Text style={styles.dashboardCardTitle}>مسلسلات</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <TinyCard
                  colors={['#0f766e', '#115e59']}
                  label="مباشر مع EPG"
                  onPress={() => setScreen('epg-guide')}
                  icon={
                    <Ionicons
                      name="calendar"
                      size={20}
                      color="#fff"
                      style={styles.dashboardCardTinyIcon}
                    />
                  }
                />

                <TinyCard
                  colors={['#0e7490', '#155e75']}
                  label="شاشات متعددة"
                  onPress={() => setScreen('multiscreen')}
                  icon={
                    <MaterialCommunityIcons
                      name="view-grid"
                      size={20}
                      color="#fff"
                      style={styles.dashboardCardTinyIcon}
                    />
                  }
                />

                <TinyCard
                  colors={['#b45309', '#78350f']}
                  label="رتراباج"
                  onPress={() => {
                    const has = channels.some(
                      (c) => String(c.tv_archive ?? '0') === '1'
                    );

                    Alert.alert(
                      has ? 'الرتراباج' : 'غير مدعوم',
                      has
                        ? 'افتح أي قناة تدعم التسجيل، ثم اضغط زر الساعة داخل المشغّل.'
                        : 'مزوّد الخدمة الحالي لا يوفّر خاصية التسجيل على أي قناة.'
                    );
                  }}
                  icon={
                    <Ionicons
                      name="time"
                      size={20}
                      color="#fff"
                      style={styles.dashboardCardTinyIcon}
                    />
                  }
                />
              </View>

              <Text style={styles.dashboardFooter}>متصل: {username}</Text>
            </View>
          )}

          {screen === 'm3u-add' && (
            <View style={styles.flex}>
              {renderHeader('➕ إضافة قائمة M3U')}

              <View
                style={{
                  padding: 16,
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: '700',
                  }}
                >
                  اسم القائمة
                </Text>

                <TextInput
                  value={m3uName}
                  onChangeText={setM3UName}
                  placeholder="مثال: قائمتي الرياضية"
                  placeholderTextColor="#718096"
                  style={{
                    backgroundColor: '#172033',
                    color: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderWidth: 1,
                    borderColor: '#263550',
                    textAlign: 'right',
                  }}
                />

                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: '700',
                    marginTop: 4,
                  }}
                >
                  رابط M3U
                </Text>

                <TextInput
                  value={m3uUrl}
                  onChangeText={setM3UUrl}
                  placeholder="https://example.com/playlist.m3u"
                  placeholderTextColor="#718096"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={{
                    backgroundColor: '#172033',
                    color: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderWidth: 1,
                    borderColor: '#263550',
                    textAlign: 'left',
                  }}
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={addM3USource}
                  style={{
                    marginTop: 8,
                    backgroundColor: '#7c3aed',
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '800',
                    }}
                  >
                    حفظ القائمة
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {screen === 'm3u-sources' && (
            <View style={styles.flex}>
              {renderHeader('🌐 قوائم M3U')}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setScreen('m3u-add')}
                style={{
                  marginHorizontal: 12,
                  marginTop: 10,
                  marginBottom: 8,
                  padding: 15,
                  borderRadius: 12,
                  backgroundColor: '#172033',
                  borderWidth: 1,
                  borderColor: '#7c3aed',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name="add-circle"
                  size={24}
                  color="#a78bfa"
                />
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: '800',
                    marginHorizontal: 10,
                  }}
                >
                  إضافة رابط M3U
                </Text>
              </TouchableOpacity>

              <FlatList
                data={m3uSources}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    لا توجد قوائم M3U محفوظة
                  </Text>
                }
                renderItem={({ item }) => (
                  <View
                    style={{
                      backgroundColor: '#172033',
                      marginHorizontal: 12,
                      marginVertical: 5,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#263550',
                      overflow: 'hidden',
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => loadM3USource(item)}
                      style={{
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons
                        name="list"
                        size={24}
                        color="#a78bfa"
                      />

                      <View
                        style={{
                          flex: 1,
                          marginHorizontal: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: '800',
                            textAlign: 'right',
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>

                        <Text
                          style={{
                            color: '#718096',
                            fontSize: 11,
                            marginTop: 4,
                            textAlign: 'right',
                          }}
                          numberOfLines={1}
                        >
                          {item.url}
                        </Text>
                      </View>

                      <Ionicons
                        name="play-circle"
                        size={24}
                        color="#22c55e"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteM3USource(item)}
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: '#263550',
                        paddingVertical: 9,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: '#ef4444',
                          fontSize: 13,
                          fontWeight: '700',
                        }}
                      >
                        حذف
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}

          {screen === 'local-groups' && (
            <View style={styles.flex}>
              {renderHeader(playlistTitle)}

              <TouchableOpacity
                activeOpacity={0.85}
                style={{
                  marginHorizontal: 12,
                  marginTop: 8,
                  marginBottom: 4,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: '#172033',
                  borderWidth: 1,
                  borderColor: '#263550',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={openM3USources}
              >
                <Ionicons
                  name="link"
                  size={22}
                  color="#a78bfa"
                />
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: '700',
                    marginHorizontal: 10,
                  }}
                >
                  إدارة قوائم M3U
                </Text>
              </TouchableOpacity>

              {localLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>
                    جارٍ تحميل قائمة IPTV...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={localGroups}
                  keyExtractor={(item, index) => item.name + '-' + index}
                  contentContainerStyle={styles.list}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={20}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      لا توجد مجموعات في قائمة IPTV
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => {
                        setSelectedLocalGroup(item.name);
                        setScreen('local-channels');
                      }}
                    >
                      <Ionicons
                        name="folder"
                        size={24}
                        color="#60a5fa"
                        style={styles.itemIconV}
                      />
                      <Text style={styles.itemText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: '#7f8da3',
                          marginHorizontal: 8,
                        }}
                      >
                        {item.channels.length}
                      </Text>
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color="#9aa8bd"
                      />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'local-channels' && (
            <View style={styles.flex}>
              {renderHeader(selectedLocalGroup || '📡 القنوات المحلية')}

              <FlatList
                data={
                  localGroups.find(
                    (group) => group.name === selectedLocalGroup
                  )?.channels || []
                }
                keyExtractor={(item, index) => item.url + '-' + index}
                contentContainerStyle={styles.list}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={20}
                maxToRenderPerBatch={15}
                windowSize={5}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    لا توجد قنوات في هذه المجموعة
                  </Text>
                }
                renderItem={({ item }) => {
                  const localIndex = localChannels.findIndex(
                    (channel) => channel.url === item.url
                  );

                  return (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => {
                        if (!item.url) {
                          Alert.alert('خطأ', 'رابط القناة غير صالح');
                          return;
                        }

                        setActiveChannel({
                          url: item.url,
                          name: item.name || 'قناة',
                          index: localIndex,
                          source: 'local',
                          streamId: '',
                          archiveDays: 0,
                          timeshift: false,
                        });

                        setPlayerMinimized(false);
                      }}
                    >
                      {item.logo ? (
                        <Image
                          source={{ uri: item.logo }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <Ionicons
                          name="tv-outline"
                          size={24}
                          color="#60a5fa"
                          style={styles.itemIconV}
                        />
                      )}

                      <Text style={styles.itemText} numberOfLines={2}>
                        {item.name || 'قناة بدون اسم'}
                      </Text>

                      <Ionicons
                        name="play"
                        size={16}
                        color="#ff1e27"
                        style={styles.playIconV}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {screen === 'categories' && (
            <View style={styles.flex}>
              {renderHeader('📂 فئات القنوات')}

              <TouchableOpacity style={styles.favoritesRow} onPress={openFavorites}>
                <Ionicons name="star" size={24} color="#fbbf24" style={styles.itemIconV} />
                <Text style={styles.itemText}>المفضلة ({favorites.length})</Text>
                <Ionicons name="chevron-back" size={20} color="#9aa8bd" />
              </TouchableOpacity>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الفئات...</Text>
                </View>
              ) : (
        

        <FlatList<CategoryItem>
                  data={categories}
                  keyExtractor={(item, index) => String(item.category_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد فئات قنوات</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openCategory(item)}
                    >
                      <Ionicons name="folder" size={24} color="#f0b429" style={styles.itemIconV} />
                      <Text style={styles.itemText}>{item.category_name}</Text>
                      <Ionicons name="chevron-back" size={20} color="#9aa8bd" />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'movies-categories' && (
            <View style={styles.flex}>
              {renderHeader('🎬 فئات الأفلام')}

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الفئات...</Text>
                </View>
              ) : (
                <FlatList
                  data={movieCategories}
                  keyExtractor={(item, index) => String(item.category_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد فئات أفلام</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openMovieCategory(item)}
                    >
                      <Ionicons name="folder" size={24} color="#f0b429" style={styles.itemIconV} />
                      <Text style={styles.itemText}>{item.category_name}</Text>
                      <Ionicons name="chevron-back" size={20} color="#9aa8bd" />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'movies-list' && (
            <View style={styles.flex}>
              {renderHeader(selectedMovieCategory || '🎬 أفلام')}
                  
                  <TextInput
                    value={movieSearchQuery}
                    onChangeText={setMovieSearchQuery}
                    placeholder="ابحث عن فيلم..."
                    placeholderTextColor="#888"
                    style={{
                      backgroundColor: '#222',
                      color: '#fff',
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      marginHorizontal: 12,
                      marginBottom: 10,
                    }}
                  />

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الأفلام...</Text>
                </View>
              ) : (




                <FlatList
                  data={filteredMovies}
                  keyExtractor={(item, index) => String(item.stream_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد أفلام فـ هذه الفئة</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openMovie(item)}
                    >
                      {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <MaterialCommunityIcons name="movie-open-outline" size={24} color="#e07a5f" style={styles.itemIconV} />
                      )}
                      <Text style={styles.itemText} numberOfLines={2}>
                        {item.name || 'فيلم بدون اسم'}
                      </Text>
                      <Ionicons name="play" size={16} color="#ff1e27" style={styles.playIconV} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'epg-guide' && credentials && (
            <EpgGuideView
              credentials={credentials}
              categories={categories}
              channels={channels}
              onBack={() => setScreen('dashboard')}
              onPlay={openChannel}
              onLoadCategory={async (c) => {
                const data = await getLiveStreams(
                  credentials,
                  String(c.category_id)
                );
                return Array.isArray(data) ? data : [];
              }}
            />
          )}

          {screen === 'multiscreen' && credentials && (
            <MultiScreenView
              credentials={credentials}
              channels={channels}
              categories={categories}
              onBack={() => setScreen('dashboard')}
              onLoadCategory={async (c) => {
                const data = await getLiveStreams(
                  credentials,
                  String(c.category_id)
                );
                return Array.isArray(data) ? data : [];
              }}
            />
          )}

          {screen === 'series-categories' && (
            <View style={styles.flex}>
              {renderHeader('🎞️ فئات المسلسلات')}

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ التحميل...</Text>
                </View>
              ) : (
                <FlatList
                  data={seriesCategories}
                  keyExtractor={(item, index) =>
                    String(item.category_id ?? index)
                  }
                  contentContainerStyle={styles.list}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد فئات مسلسلات</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openSeriesCategory(item)}
                    >
                      <Ionicons name="folder" size={24} color="#f0b429" style={styles.itemIconV} />
                      <Text style={styles.itemText}>{item.category_name}</Text>
                      <Ionicons name="chevron-back" size={20} color="#9aa8bd" />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'series-list' && (
            <View style={styles.flex}>
              {renderHeader('🎞️ المسلسلات')}

              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#7f8da3" style={styles.searchIcon} />
                <TextInput
                  value={seriesSearch}
                  onChangeText={setSeriesSearch}
                  placeholder="ابحث عن مسلسل..."
                  placeholderTextColor="#7f8da3"
                  style={styles.searchInput}
                />
              </View>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ التحميل...</Text>
                </View>
              ) : (
                <FlatList
                  data={seriesList.filter((item) =>
                    (item.name || '')
                      .toLowerCase()
                      .includes(seriesSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item, index) =>
                    String(item.series_id ?? index)
                  }
                  contentContainerStyle={styles.list}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={12}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد نتائج</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openSeriesDetail(item)}
                    >
                      {item.cover ? (
                        <Image
                          source={{ uri: item.cover }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <MaterialCommunityIcons name="television-classic" size={24} color="#a78bfa" style={styles.itemIconV} />
                      )}

                      <Text style={styles.itemText} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <Ionicons name="chevron-back" size={20} color="#9aa8bd" />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'series-detail' && (
            <View style={styles.flex}>
              {renderHeader(seriesTitle || '🎞️ المسلسل')}

              {seasons.length > 0 && (
                <View style={styles.seasonBar}>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={seasons}
                    keyExtractor={(key) => key}
                    contentContainerStyle={{ paddingHorizontal: 12 }}
                    renderItem={({ item }) => {
                      const active = item === selectedSeason;

                      return (
                        <TouchableOpacity
                          style={[
                            styles.seasonChip,
                            active && styles.seasonChipActive,
                          ]}
                          onPress={() => selectSeason(item)}
                        >
                          <Text
                            style={[
                              styles.seasonChipText,
                              active && styles.seasonChipTextActive,
                            ]}
                          >
                            الموسم {item}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              )}

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ التحميل...</Text>
                </View>
              ) : (
                <FlatList
                  data={episodes}
                  keyExtractor={(item, index) =>
                    String(item.stream_id ?? index)
                  }
                  contentContainerStyle={styles.list}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={12}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد حلقات</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openEpisode(item)}
                    >
                      {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <Ionicons name="play-circle-outline" size={24} color="#8fd3a8" style={styles.itemIconV} />
                      )}

                      <Text style={styles.itemText} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <Ionicons name="play" size={16} color="#ff1e27" style={styles.playIconV} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'channels' && isLandscape && (
            <ChannelsSplitView
              title={selectedCategory || 'القنوات'}
              channels={channels}
              credentials={credentials}
              onBack={goBack}
              onPlay={openChannel}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
            />
            )}

          {screen === 'channels' && !isLandscape && (
            <View style={styles.flex}>
              {renderHeader(selectedCategory || ' 📺 القنوات')}

              {categoryIndex >= 0 && categories.length > 1 && (
                <View style={styles.categoryNavBar}>
                  <TouchableOpacity
                    style={[
                      styles.categoryNavButton,
                      categoryIndex <= 0 && styles.categoryNavDisabled,
                    ]}
                    onPress={() => shiftCategory(-1)}
                    disabled={categoryIndex <= 0}
                  >
                    <Ionicons name="chevron-forward" size={22} color="#fff" />
                  </TouchableOpacity>

                  <Text style={styles.categoryNavLabel} numberOfLines={1}>
                    {categoryIndex + 1} / {categories.length}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.categoryNavButton,
                      categoryIndex >= categories.length - 1 &&
                        styles.categoryNavDisabled,
                    ]}
                    onPress={() => shiftCategory(1)}
                    disabled={categoryIndex >= categories.length - 1}
                  >
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#7f8da3" style={styles.searchIcon} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="ابحث عن قناة..."
                  placeholderTextColor="#7f8da3"
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل القنوات...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredChannels}
                  keyExtractor={(item, index) => String(item.stream_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  onViewableItemsChanged={onChannelsViewableItemsChanged}
                  viewabilityConfig={channelsViewabilityConfig}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد قنوات في هذه الفئة'}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(item)}
                        style={styles.favoriteStarButton}
                      >
                        <Ionicons
                          name={isFavorite(item) ? 'star' : 'star-outline'}
                          size={20}
                          color={isFavorite(item) ? '#fbbf24' : '#6b7a92'}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.listItemContent}
                        onPress={() => openChannel(item)}
                      >
                        {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <Ionicons name="tv-outline" size={24} color="#5fb3d4" style={styles.itemIconV} />
                      )}
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.itemText} numberOfLines={1}>
                            {item.name || 'قناة بدون اسم'}
                          </Text>
                          {credentials && (
                            <ChannelEpgLabel
                              channel={item}
                              credentials={credentials}
                              epgEnabled={visibleEpgIds.has(String(item.stream_id))}
                            />
                          )}
                        </View>
                        <Ionicons name="play" size={16} color="#ff1e27" style={styles.playIconV} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {showMiniPlayer && (
            <MiniPlayer
              streamUrl={activeChannel!.url}
              channelName={activeChannel!.name}
              onExpand={() => setPlayerMinimized(false)}
              onClose={closePlayer}
            />
          )}
        </KeyboardAvoidingView>
      )}
          </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  entryScreen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 34,
    paddingBottom: 24,
    justifyContent: 'center',
  },

  entryHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },

  entryTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },

  entrySubtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },

  entryCards: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },

  entryCard: {
    flex: 1,
    minHeight: 190,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#303030',
  },

  entryIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d71920',
    marginBottom: 14,
  },

  entryCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 7,
  },

  entryCardSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: '#aaa',
    textAlign: 'center',
  },

  entryCloseButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#292929',
  },

  entryCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  container: { flex: 1, backgroundColor: '#0b1220' },
  flex: { flex: 1 },

  header: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#161f30',
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 8,
  },

  backButton: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#26344d',
    alignItems: 'center',
  },

  backText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  closeButton: {
    minWidth: 40,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#7f1d1d',
    alignItems: 'center',
  },

  closeButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  headerSpacer: { width: 60 },

  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#7f1d1d',
  },

  logoutText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  content: { flex: 1, padding: 20, justifyContent: 'center' },

  logo: { textAlign: 'center', fontSize: 52, marginBottom: 10 },

  title: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  subtitle: {
    color: '#9aa8bd',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 24,
  },

  input: {
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#2b3850',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'left',
  },

  primaryButton: {
    backgroundColor: '#ff1e27',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },

  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#2b3850',
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 44,
  },

  searchIcon: { marginEnd: 8 },

  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    textAlign: 'left',
  },

  searchClear: { color: '#9aa8bd', fontSize: 16, paddingHorizontal: 4 },

  list: { padding: 12, paddingBottom: 56 },
  favoritesRow: {
    minHeight: 56,
    backgroundColor: '#26344d',
    borderWidth: 1,
    borderColor: '#3a4a68',
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  listItem: {
    minHeight: 64,
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#273247',
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },

  favoriteStarButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  favoriteStarText: { fontSize: 20 },

  channelLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#26344d',
  },
  itemIcon: { fontSize: 24, width: 40, textAlign: 'center' },

  itemIconV: { width: 40, textAlign: 'center' },

  playIconV: { paddingHorizontal: 10 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  itemText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginHorizontal: 10,
    textAlign: 'left',
  },

  arrow: { color: '#9aa8bd', fontSize: 28 },

  playIcon: { color: '#ff1e27', fontSize: 18, paddingHorizontal: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  loadingText: { color: '#9aa8bd', marginTop: 12 },

  emptyText: {
    color: '#9aa8bd',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },

  dashboardHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#161f30',
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dashboardBrand: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  dashboardGrid: { padding: 16 },

  dashboardCardLarge: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 140,
  },

  dashboardRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },

  dashboardCardSmall: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },

  dashboardCardTiny: {
    backgroundColor: '#2c8a6d',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  dashboardCardTinyIcon: { marginEnd: 12 },

  dashboardCardTinyText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  dashboardCardIcon: { marginBottom: 10 },

  dashboardCardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  dashboardFooter: {
    color: '#9aa8bd',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },

  epgText: {
    color: '#8fd3a8',
    fontSize: 11,
    marginTop: 2,
  },

  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26344d',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#3a4a68',
  },

  resumeIcon: { marginEnd: 12 },

  resumeLabel: { color: '#9aa8bd', fontSize: 12 },

  resumeChannelName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  playerContainer: { flex: 1, backgroundColor: '#000' },

  videoContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },

  videoContainerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  fullscreenButton: {
    position: 'absolute',
    right: 12,
    bottom: 108,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  miniBackInFullscreen: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  fullscreenText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  controlsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlButtonPlay: {
    backgroundColor: 'rgba(255,30,39,0.85)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlButtonDisabled: {
    opacity: 0.35,
  },

  controlButtonText: { color: '#fff', fontSize: 20 },

  videoMessageOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
  },
  videoMessageText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },
  videoErrorIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  videoRetryButton: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  videoRetryText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
  },
  video: { flex: 1, backgroundColor: '#000' },

  gestureIndicator: {
    position: 'absolute',
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },

  gestureIndicatorLeft: { left: '15%' },
  gestureIndicatorRight: { right: '15%' },

  gestureIndicatorIcon: { fontSize: 26, marginBottom: 4 },

  gestureIndicatorText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  miniPlayerWrapper: {
    position: 'absolute',
    right: 12,
    bottom: 32,
    zIndex: 50,
  },

  miniPlayerTouchable: {
    width: 160,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#273247',
    justifyContent: 'flex-end',
  },

  miniPlayerVideo: {
    ...StyleSheet.absoluteFill,
  },

  miniPlayerLabel: {
    color: '#fff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },

  miniPlayerClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },

  miniPlayerCloseText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  clockBox: { alignItems: 'center', marginHorizontal: 10 },
  clockTime: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  clockDate: { color: '#b9c6da', fontSize: 10 },

  fsTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 35,
    elevation: 35,
  },

  fsTopButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },

  fsTopButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  fsTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },

  lockBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 40,
    elevation: 40,
  },

  lockBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sideSlider: {
    position: 'absolute',
    top: '28%',
    height: '44%',
    alignItems: 'center',
    zIndex: 25,
  },

  sideIcon: { fontSize: 18, marginBottom: 8 },

  sliderTrack: {
    flex: 1,
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  sliderFill: { width: 6, backgroundColor: '#fff', borderRadius: 3 },

  epgBar: { position: 'absolute', left: 18, right: 18, zIndex: 25 },

  epgNow: { color: '#fff', fontSize: 13, fontWeight: '700' },
  epgNext: { color: '#b9c6da', fontSize: 12, marginTop: 6 },

  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    marginTop: 6,
  },

  progressFill: { height: 3, backgroundColor: '#ff1e27', borderRadius: 2 },

  drawerToggle: { backgroundColor: 'rgba(255,255,255,0.18)' },

  drawerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 45,
    elevation: 45,
  },

  channelDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 320,
    maxWidth: '85%',
    backgroundColor: 'rgba(11,18,32,0.97)',
    borderLeftWidth: 1,
    borderLeftColor: '#273247',
    paddingHorizontal: 10,
  },

  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    marginBottom: 6,
  },

  drawerTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  drawerCloseText: {
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  drawerItem: {
    height: DRAWER_ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },

  drawerItemActive: { backgroundColor: '#1f6f8b' },

  drawerNumber: {
    color: '#7f8da3',
    fontSize: 11,
    width: 52,
    textAlign: 'left',
  },

  drawerLogo: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#26344d',
    marginHorizontal: 8,
  },

  drawerName: { flex: 1, color: '#e6ecf5', fontSize: 14 },

  drawerTextActive: { color: '#fff', fontWeight: 'bold' },

  drawerPlaying: { color: '#ff1e27', fontSize: 13, paddingHorizontal: 6 },

  splitRoot: { flex: 1, backgroundColor: '#0b1220' },

  splitTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },

  splitBackButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#26344d',
  },

  splitBackText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  splitTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginHorizontal: 12,
    maxWidth: 220,
  },

  splitSearch: {
    flex: 1,
    height: 36,
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#2b3850',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    marginHorizontal: 10,
  },

  splitBody: { flex: 1, flexDirection: 'row' },

  splitLeft: {
    width: '34%',
    backgroundColor: '#111a2b',
    borderRadius: 12,
    padding: 6,
  },

  splitCenter: { flex: 1, paddingHorizontal: 10 },

  splitRight: {
    width: '27%',
    backgroundColor: '#111a2b',
    borderRadius: 12,
    padding: 8,
  },

  splitCenterBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  splitEmptyText: {
    color: '#7f8da3',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },

  splitRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
  },

  splitRowActive: { backgroundColor: '#1f6f8b' },

  splitStar: { paddingHorizontal: 4 },
  splitStarText: { fontSize: 15 },

  splitRowNum: {
    color: '#7f8da3',
    fontSize: 10,
    width: 46,
  },

  splitRowLogo: {
    width: 30,
    height: 30,
    borderRadius: 5,
    backgroundColor: '#26344d',
    marginHorizontal: 6,
  },

  splitRowName: { flex: 1, color: '#e6ecf5', fontSize: 13 },

  splitPlay: { paddingHorizontal: 8 },
  splitPlayText: { color: '#ff1e27', fontSize: 14 },

  previewBox: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },

  previewHint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },

  previewHintText: { color: '#fff', fontSize: 11 },

  splitNowTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },

  splitRightTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  epgRow: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 4,
  },

  epgRowActive: { backgroundColor: 'rgba(31,111,139,0.35)' },

  epgRowTime: { color: '#5fb3d4', fontSize: 11, fontWeight: 'bold' },

  epgRowTitle: { color: '#c7d3e3', fontSize: 12, marginTop: 2 },

  epgRowLiveText: { color: '#fff' },

  guideCatBar: { maxHeight: 46, marginBottom: 6 },

  guideBodyRow: { flex: 1, flexDirection: 'row' },
  guideBodyCol: { flex: 1 },

  guideLeft: {
    width: '42%',
    backgroundColor: '#111a2b',
    borderRadius: 12,
    padding: 6,
    marginEnd: 8,
  },

  guideRight: {
    flex: 1,
    backgroundColor: '#111a2b',
    borderRadius: 12,
    padding: 8,
  },

  guideTop: {
    flex: 1,
    backgroundColor: '#111a2b',
    borderRadius: 12,
    padding: 6,
    marginBottom: 8,
  },

  guideBottom: {
    flex: 1,
    backgroundColor: '#111a2b',
    borderRadius: 12,
    padding: 8,
  },

  guideEpgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    marginBottom: 6,
  },

  guideEpgTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  guidePlayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ff1e27',
  },

  guidePlayText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  tsButtonActive: { backgroundColor: 'rgba(255,30,39,0.85)' },

  tsBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,30,39,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    zIndex: 38,
    elevation: 38,
  },

  tsBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  tsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 46,
    elevation: 46,
  },

  tsPanel: {
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
  },

  tsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  tsChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#1b2639',
    borderWidth: 1,
    borderColor: '#2b3850',
  },

  tsChipText: { color: '#e6ecf5', fontSize: 13, fontWeight: '600' },

  tsLiveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ff1e27',
    alignItems: 'center',
  },

  tsLiveText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  tsHint: { color: '#7f8da3', fontSize: 11, marginTop: 16 },

  tsAltButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#26344d',
  },

  tsAltText: { color: '#c7d3e3', fontSize: 11 },

  multiHeader: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161f30',
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  multiHint: {
    color: '#9aa8bd',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 6,
  },

  multiGrid: { flex: 1, padding: 6 },

  multiRow: { flex: 1, flexDirection: 'row' },

  multiCell: {
    flex: 1,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'flex-end',
  },

  multiCellFocused: { borderColor: '#ff1e27' },

  multiEmpty: {
    flex: 1,
    margin: 4,
    borderRadius: 10,
    backgroundColor: '#111a2b',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2b3850',
    alignItems: 'center',
    justifyContent: 'center',
  },

  multiPlus: { color: '#4d6285', fontSize: 30, fontWeight: 'bold' },

  multiEmptyText: { color: '#4d6285', fontSize: 12, marginTop: 4 },

  multiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  multiName: { flex: 1, color: '#fff', fontSize: 10 },

  multiClose: { paddingHorizontal: 6 },

  multiCloseText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  multiPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },

  multiPicker: {
    maxHeight: '72%',
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 12,
  },

  categoryNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 6,
  },

  categoryNavButton: {
    width: 44,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#26344d',
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryNavDisabled: { opacity: 0.3 },

  categoryNavText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },

  categoryNavLabel: { color: '#9aa8bd', fontSize: 12, fontWeight: '600' },

  seasonBar: { paddingVertical: 10 },

  seasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#1b2639',
    borderWidth: 1,
    borderColor: '#2b3850',
    marginEnd: 8,
  },

  seasonChipActive: { backgroundColor: '#6c3fa8', borderColor: '#8a5fd0' },

  seasonChipText: { color: '#9aa8bd', fontSize: 13, fontWeight: '600' },

  seasonChipTextActive: { color: '#fff' },
});
