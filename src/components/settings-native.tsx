import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch, ScrollView, Alert } from 'react-native';

export type SettingsState = {
  name: string;
  notif: boolean;
  vibrate: boolean;
  sound: boolean;
  localEnabled: boolean;
  localIp: string;
  localPort: string;
  lastRoom: string;
};

type Props = {
  settings: SettingsState | null;
  onSaveName: (name: string) => void;
  onToggleOption: (key: 'notif' | 'vibrate' | 'sound', value: boolean) => void;
  onSaveConnection: (enabled: boolean, ip: string, port: string) => void;
  onClearData: () => void;
  onBack: () => void;
};

export default function SettingsNative({ settings, onSaveName, onToggleOption, onSaveConnection, onClearData, onBack }: Props) {
  const [name, setName] = useState(settings?.name ?? '');
  const [localEnabled, setLocalEnabled] = useState(settings?.localEnabled ?? false);
  const [ip, setIp] = useState(settings?.localIp ?? '');
  const [port, setPort] = useState(settings?.localPort ?? '9000');

  useEffect(() => {
    if (settings) {
      setName(settings.name);
      setLocalEnabled(settings.localEnabled);
      setIp(settings.localIp);
      setPort(settings.localPort);
    }
  }, [settings]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>الإعدادات</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.box}>
        <Text style={styles.label}>اسم المستخدم المحفوظ</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="اسمك" placeholderTextColor="#64748b" />
        <TouchableOpacity style={styles.saveBtn} onPress={() => onSaveName(name.trim())}>
          <Text style={styles.saveBtnText}>حفظ الاسم</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.box}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>🔔 إشعارات الرسائل</Text>
          <Switch value={settings?.notif ?? true} onValueChange={(v) => onToggleOption('notif', v)} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>📳 الاهتزاز عند الرسائل</Text>
          <Switch value={settings?.vibrate ?? true} onValueChange={(v) => onToggleOption('vibrate', v)} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>🔊 صوت الإشعارات</Text>
          <Switch value={settings?.sound ?? true} onValueChange={(v) => onToggleOption('sound', v)} />
        </View>
      </View>

      <View style={styles.box}>
        <Text style={styles.label}>وضع الاتصال</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>📡 استخدام سيرفر محلي (بدون إنترنت)</Text>
          <Switch value={localEnabled} onValueChange={setLocalEnabled} />
        </View>
        {localEnabled && (
          <>
            <TextInput style={styles.input} value={ip} onChangeText={setIp} placeholder="عنوان IP للسيرفر المحلي" placeholderTextColor="#64748b" />
            <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder="المنفذ (افتراضي 9000)" placeholderTextColor="#64748b" />
          </>
        )}
        <TouchableOpacity style={styles.saveBtn} onPress={() => onSaveConnection(localEnabled, ip.trim(), port.trim() || '9000')}>
          <Text style={styles.saveBtnText}>حفظ إعدادات الاتصال</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.box}>
        <Text style={styles.label}>آخر غرفة متصل بها</Text>
        <Text style={styles.value}>{settings?.lastRoom ? `غرفة رقم ${settings.lastRoom}` : 'لا يوجد'}</Text>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() =>
            Alert.alert('تأكيد المسح', 'سيتم مسح اسمك وإعدادات الاتصال وآخر غرفة بشكل نهائي. متابعة؟', [
              { text: 'إلغاء', style: 'cancel' },
              { text: 'مسح', style: 'destructive', onPress: onClearData },
            ])
          }
        >
          <Text style={styles.saveBtnText}>مسح البيانات المحفوظة</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingHorizontal: 16, paddingTop: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { backgroundColor: '#ffffff14', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  box: { backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: '#ffffff14', borderRadius: 18, padding: 16, marginBottom: 14 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  value: { color: '#fff', marginBottom: 10 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#ffffff22', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10 },
  saveBtn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  clearBtn: { backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  switchLabel: { color: '#fff', flex: 1, marginRight: 10 },
});
