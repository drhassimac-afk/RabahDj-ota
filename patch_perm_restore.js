const fs = require('fs');
const f = 'src/lib/guard-sync.ts';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('[perm-exports]')) { console.log('مثبت مسبقاً'); process.exit(0); }

// توسيع النوع (مرساة حية مؤكدة — رأيناها في tsc السابق):
const tA = /openAppSettings\?\(\): void;/;
if (!tA.test(s)) { console.error('FAIL: type anchor'); process.exit(1); }
s = s.replace(tA,
  "openAppSettings?(): void;\n" +
  "  hasOverlayPermission?(): boolean;\n" +
  "  openOverlaySettings?(): void;");

// التصديرات (نفس المحتوى الذي عمل في 563bee1):
const addExports = `
// [perm-exports] مساعدات أذونات موحدة للشاشات
export type PermStatus = { overlay: boolean; usage: boolean; bgLocation: boolean };
export async function readPermissionsStatus(): Promise<PermStatus> {
  let overlay = false, usage = false, bgLocation = false;
  try {
    if (native?.hasOverlayPermission) overlay = native.hasOverlayPermission();
    if (native?.hasUsageAccess) usage = native.hasUsageAccess();
  } catch {}
  try {
    const Location = require('expo-location');
    const bg = await Location.getBackgroundPermissionsAsync?.();
    bgLocation = !!bg?.granted;
  } catch {}
  return { overlay, usage, bgLocation };
}
export function openPermission(setting: 'overlay' | 'usage' | 'app'): void {
  try {
    if (!native) return;
    if (setting === 'overlay' && native.openOverlaySettings) return native.openOverlaySettings();
    if (setting === 'usage') return native.openUsageSettings();
    native.openAppSettings?.();
  } catch {}
}
`;
const ugA = 'export function useGuard(): LockState & {';
if (!s.includes(ugA)) { console.error('FAIL: useGuard anchor'); process.exit(1); }
s = s.replace(ugA, addExports + '\n' + ugA);

fs.writeFileSync(f, s);
console.log('OK: permission exports restored');
