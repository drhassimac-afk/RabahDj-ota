import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export type AdminMember = {
  peerId: string;
  userId: string;
  name: string;
};

export type AdminStats = {
  connected: number;
  viewers: number;
  msgs: number;
  notifs: number;
  room: string;
  isHost: boolean;
  members: AdminMember[];
};

type Props = {
  stats: AdminStats | null;
  onRefresh: () => void;
  onKick: (peerId: string) => void;
  onBan: (userId: string, peerId: string) => void;
  onOpenChangePassword: () => void;
  onOpenBroadcast: () => void;
  onLogout: () => void;
};

export default function AdminNative({
  stats,
  onRefresh,
  onKick,
  onBan,
  onOpenChangePassword,
  onOpenBroadcast,
  onLogout,
}: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.backBtn} onPress={onLogout}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>

        <Text style={styles.title}>لوحة الإدارة</Text>

        <TouchableOpacity style={styles.backBtn} onPress={onRefresh}>
          <Text style={styles.backText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <StatCard num={stats?.connected ?? 0} label="متصل الآن" />
          <StatCard num={stats?.viewers ?? 0} label="مشاهدو البث" />
          <StatCard num={stats?.msgs ?? 0} label="رسائل الشات" />
          <StatCard num={stats?.notifs ?? 0} label="الإشعارات" />
        </View>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>الغرفة الحالية</Text>
          <Text style={styles.boxValue}>
            {stats?.room
              ? `غرفة رقم ${stats.room} — ${stats.isHost ? 'أنت المضيف' : 'منضم'}`
              : 'لم تتصل بعد'}
          </Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>الأعضاء المتصلون</Text>

          {(!stats?.members || stats.members.length === 0) && (
            <Text style={styles.emptyText}>
              لا يوجد أعضاء آخرون متصلون حاليًا
            </Text>
          )}

          {stats?.members?.map((m) => (
            <View key={m.peerId} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>👤 {m.name}</Text>
                <Text style={styles.memberId}>
                  ID: {m.userId || 'غير متوفر'}
                </Text>
              </View>

              <View style={styles.memberActions}>
                <TouchableOpacity
                  style={styles.kickBtn}
                  onPress={() => onKick(m.peerId)}
                >
                  <Text style={styles.kickText}>طرد</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.banBtn}
                  disabled={!m.userId}
                  onPress={() => onBan(m.userId, m.peerId)}
                >
                  <Text style={styles.banText}>حظر</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onOpenBroadcast}
        >
          <Text style={styles.actionText}>📢 إرسال إعلان جماعي</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onOpenChangePassword}
        >
          <Text style={styles.actionText}>
            🔑 تغيير بيانات دخول المسؤول
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.logoutBtn]}
          onPress={onLogout}
        >
          <Text style={styles.actionText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function StatCard({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b1220',
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  backBtn: {
    backgroundColor: '#ffffff14',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backText: {
    color: '#fff',
    fontSize: 15,
  },

  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },

  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
  },

  statNum: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },

  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },

  box: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },

  boxLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
  },

  boxValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },

  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },

  memberInfo: {
    flex: 1,
  },

  memberName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  memberId: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 3,
  },

  memberActions: {
    flexDirection: 'row',
    gap: 6,
  },

  kickBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  kickText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  banBtn: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  banText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  actionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },

  logoutBtn: {
    backgroundColor: '#dc2626',
  },

  actionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
