import { NativeModule, requireNativeModule } from 'expo';

export type AppUsage = {
  packageName: string;
  minutes: number;
};

declare class GuardModule extends NativeModule<{}> {
  hasUsageAccess(): boolean;
  openUsageSettings(): void;
  getTodayUsage(): Promise<AppUsage[]>;
  getInstalledApps(): Promise<string[]>;
}

export default requireNativeModule<GuardModule>('GuardModule');
