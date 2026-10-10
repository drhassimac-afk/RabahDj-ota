import { registerWebModule, NativeModule } from 'expo';

class GuardModule extends NativeModule<{}> {}

export default registerWebModule(GuardModule, 'GuardModule');
