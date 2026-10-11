import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { openUsageAccess, useGuard } from '@/lib/guard-sync';

export default function GuardGate({ children }: { children: React.ReactNode }) {
  const g = useGuard();

  return (
    <>
      {children}

      {g.needsAccess && !g.locked ? (
        <Pressable style={styles.banner} onPress={openUsageAccess}>
          <Text style={styles.bannerText}>
            فعّل إذن الوصول إلى بيانات الاستخدام ليعمل الحد اليومي. اضغط هنا.
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={g.locked}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.lock}>
          <Text style={styles.emoji}>
            {g.reason === 'bedtime' ? '🌙' : g.reason === 'manual' ? '🔒' : '⏳'}
          </Text>
          <Text style={styles.title}>
            {g.reason === 'bedtime'
              ? 'حان وقت النوم'
              : g.reason === 'manual'
              ? 'قفل وليّ الأمر التطبيق'
              : 'انتهى وقت الاستخدام اليوم'}
          </Text>
          <Text style={styles.sub}>
            {g.reason === 'limit'
              ? `استخدمت ${g.usedMinutes} دقيقة اليوم.`
              : g.reason === 'manual'
              ? 'تواصل مع وليّ أمرك لفتح التطبيق.'
              : 'سيُفتح التطبيق عند انتهاء وقت النوم.'}
          </Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  emoji: { fontSize: 64 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#94a3b8', fontSize: 15, textAlign: 'center' },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#78350f',
    padding: 10,
  },
  bannerText: { color: '#fbbf24', fontSize: 12, textAlign: 'center' },
});
