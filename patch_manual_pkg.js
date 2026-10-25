const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('draftNewPackage')) { console.log('مثبت مسبقاً'); process.exit(0); }

// 1) حالة جديدة
const stA = 'const [childAppsOptions, setChildAppsOptions] = useState<string[]>([]);';
if (!s.includes(stA)) { console.error('FAIL: state anchor'); process.exit(1); }
s = s.replace(stA, stA + "\n  const [draftNewPackage, setDraftNewPackage] = useState('');");

// 2) صف الإدخال اليدوي قبل زر الجلب
const uiA = 'onPress={() => void fetchChildApps(rule.child_account_id)}';
const pIdx = s.indexOf(uiA);
if (pIdx === -1) { console.error('FAIL: fetch button anchor'); process.exit(1); }
const prIdx = s.lastIndexOf('<Pressable', pIdx);
if (prIdx === -1) { console.error('FAIL: Pressable start'); process.exit(1); }
const row = `                      {/* [blockapps-ui] إضافة حزمة يدوياً */}
                      <View style={{ flexDirection: 'row', marginTop: 8 }}>
                        <TextInput
                          value={draftNewPackage}
                          onChangeText={setDraftNewPackage}
                          placeholder="اسم الحزمة يدوياً: com.android.chrome"
                          placeholderTextColor={C.muted}
                          autoCapitalize="none"
                          style={{ flex: 1, backgroundColor: C.input, borderColor: C.border, borderWidth: 1, borderRadius: 8, color: C.text, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 }}
                        />
                        <Pressable
                          onPress={() => {
                            const p = draftNewPackage.trim();
                            if (!p) return;
                            if (!draftBlockedApps.includes(p)) setDraftBlockedApps([...draftBlockedApps, p]);
                            setDraftNewPackage('');
                          }}
                          style={{ marginLeft: 8, backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 12 }}>+ حظر</Text>
                        </Pressable>
                      </View>
`;
s = s.slice(0, prIdx) + row + s.slice(prIdx);
fs.writeFileSync(f, s);
console.log('OK: manual package input installed');
