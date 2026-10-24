const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('blockapps-ui')) { console.log('مثبت مسبقاً'); process.exit(0); }

// 1) النوع: blocked_apps
if (!s.includes('blocked_apps?:')) {
  const tA = /type UsageRule = \{[^}]*daily_limit_minutes\?: number;/;
  if (!tA.test(s)) { console.error('FAIL: UsageRule anchor'); process.exit(1); }
  s = s.replace(tA, (m) => m + '\n  blocked_apps?: string[];');
}

// 2) الحالات
const stA = 'const [draftEnabled, setDraftEnabled] = useState(true);';
if (!s.includes(stA)) { console.error('FAIL: draftEnabled anchor'); process.exit(1); }
s = s.replace(stA, stA +
  "\n  const [draftBlockedApps, setDraftBlockedApps] = useState<string[]>([]);" +
  "\n  const [childAppsOptions, setChildAppsOptions] = useState<string[]>([]);");

// 3) المساعد: جلب تطبيقات الطفل (قبل saveUsageRule مباشرة)
const fnA = '  const saveUsageRule = async (rule: UsageRule) => {';
if (!s.includes(fnA)) { console.error('FAIL: saveUsageRule anchor'); process.exit(1); }
s = s.replace(fnA,
  '  const fetchChildApps = useCallback(async (cid: number | string) => {\n' +
  '    try {\n' +
  "      const token = await SecureStore.getItemAsync('userToken');\n" +
  '      if (!token) return;\n' +
  "      const r = await fetch(`${BASE_URL}/api/parent/child-apps/${encodeURIComponent(String(cid))}`, { headers: requestHeaders(token) });\n" +
  '      const d = await r.json().catch(() => null);\n' +
  "      const list = Array.isArray(d?.apps) ? d.apps : [];\n" +
  '      setChildAppsOptions(list);\n' +
  "      if (!list.length) Alert.alert('لا توجد بيانات', 'لم يرفع جهاز الطفل قائمة تطبيقاته بعد. افتح تطبيق الطفل مرة واحدة ثم أعد المحاولة.');\n" +
  '    } catch {\n' +
  "      Alert.alert('خطأ', 'تعذر جلب تطبيقات الطفل.');\n" +
  '    }\n' +
  '  }, []);\n\n' + fnA);

// 4) داخل saveUsageRule: حفظ الحظر بعد نجاح القواعد
const svA = /(await fetchLiveUsageRules\(token\);\s*)(setEditingRuleId\(null\);)/;
if (!svA.test(s)) { console.error('FAIL: save success anchor'); process.exit(1); }
s = s.replace(svA, (m, g1, g2) => g1 +
  "      // [blockapps-ui] حفظ قائمة الحظر مع القواعد\n" +
  '      try {\n' +
  "        const br = await fetch(`${BASE_URL}/api/parent/blocked-apps/${encodeURIComponent(String(childId))}`, {\n" +
  "          method: 'PUT',\n" +
  '          headers: requestHeaders(token),\n' +
  "          body: JSON.stringify({ apps: draftBlockedApps }),\n" +
  '        });\n' +
  '        if (!br.ok) {\n' +
  '          const bd = await br.json().catch(() => null);\n' +
  "          Alert.alert('تنبيه', 'حُفظت القواعد لكن تعذر حفظ قائمة الحظر: ' + (bd?.error || br.status));\n" +
  '        }\n' +
  '      } catch {}\n' + g2);

// 5) عند فتح المحرر: تعبئة المسودة + جلب القائمة المحفوظة
const edA = "setDraftBedtimeStart(rule.bedtime_start || '');";
if (!s.includes(edA)) { console.error('FAIL: editor-open anchor'); process.exit(1); }
s = s.replace(edA, edA +
  "\n                      setDraftBlockedApps(Array.isArray(rule.blocked_apps) ? rule.blocked_apps : []);" +
  "\n                      setChildAppsOptions([]);" +
  "\n                      void (async () => {" +
  "\n                        try {" +
  "\n                          const t2 = await SecureStore.getItemAsync('userToken');" +
  "\n                          if (!t2) return;" +
  "\n                          const r2 = await fetch(`${BASE_URL}/api/parent/blocked-apps/${encodeURIComponent(String(rule.child_account_id))}`, { headers: requestHeaders(t2) });" +
  "\n                          const d2 = await r2.json().catch(() => null);" +
  "\n                          if (r2.ok && Array.isArray(d2?.apps)) setDraftBlockedApps(d2.apps);" +
  "\n                        } catch {}" +
  "\n                      })();");

// 6) الواجهة: بعد سطر حالة التفعيل مباشرة
const uiA = /\{rule\.enabled \? 'القواعد مفعّلة' : 'القواعد غير مفعّلة'\}\s*<\/Text>/;
if (!uiA.test(s)) { console.error('FAIL: enabled-status anchor'); process.exit(1); }
s = s.replace(uiA, (m) => m + `

                  {/* [blockapps-ui] إدارة قائمة الحظر */}
                  {editingRuleId === String(rule.child_account_id) ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.mutedText}>
                        ⛔ التطبيقات المحظورة ({draftBlockedApps.length})
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                        {draftBlockedApps.map((p) => (
                          <Pressable
                            key={p}
                            onPress={() => setDraftBlockedApps(draftBlockedApps.filter((x) => x !== p))}
                            style={{ backgroundColor: C.danger, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 11 }}>✕ {p}</Text>
                          </Pressable>
                        ))}
                        {childAppsOptions
                          .filter((p) => !draftBlockedApps.includes(p))
                          .map((p) => (
                            <Pressable
                              key={p}
                              onPress={() => setDraftBlockedApps([...draftBlockedApps, p])}
                              style={{ backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}
                            >
                              <Text style={{ color: C.muted, fontSize: 11 }}>+ {p}</Text>
                            </Pressable>
                          ))}
                      </View>
                      <Pressable
                        onPress={() => void fetchChildApps(rule.child_account_id)}
                        style={[styles.primaryBtn, { marginTop: 8, paddingVertical: 8 }]}
                      >
                        <Text style={styles.primaryBtnText}>📥 جلب تطبيقات الطفل المثبتة</Text>
                      </Pressable>
                    </View>
                  ) : null}`);

fs.writeFileSync(f, s);
console.log('OK: parental UI blockapps installed');
