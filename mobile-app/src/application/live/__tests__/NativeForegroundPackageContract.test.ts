import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Contract tests intentionally read the INSTALLED package's real JS/Java files.
 * Our regular Jest mocks cannot detect a missing mandatory native field.
 * This is static package integration verification, NOT a device test.
 */
const projectRoot = path.resolve(__dirname, '../../../..');
const packageRoot = path.join(projectRoot, 'node_modules', '@supersami', 'rn-foreground-service');
const nativeRoot = path.join(packageRoot, 'android', 'src', 'main', 'java', 'com', 'supersami', 'foregroundservice');
function read(file: string) {
  return fs.readFileSync(file, 'utf8');
}

describe('Installed Android foreground-service integration contract', () => {
  it("uses the real native package's mandatory ServiceType field", () => {
    const nativeModule = read(path.join(nativeRoot, 'ForegroundServiceModule.java'));
    const service = read(path.join(nativeRoot, 'ForegroundService.java'));
    const runtime = read(path.join(packageRoot, 'index.js'));
    expect(nativeModule).toContain('notificationConfig.hasKey("ServiceType")');
    expect(service).toContain('notificationConfig.getString("ServiceType")');
    expect(service).toContain('case "connectedDevice":');
    expect(runtime).toMatch(/startService\(\{[\s\S]*?ServiceType/);
  });

  it('requires app-side connectedDevice permission and manifest service declaration', () => {
    const manifest = read(path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'));
    expect(manifest).toContain('android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE');
    expect(manifest).toMatch(/<service[^>]+ForegroundService"[^>]+foregroundServiceType="connectedDevice"/);
  });

  it('registers the native foreground task before registering the Expo root', () => {
    const entry = read(path.join(projectRoot, 'index.js'));
    expect(entry).toContain('onServiceErrorCallBack:');
    const taskRegistration = entry.indexOf('ReactNativeForegroundService.register(');
    const rootRegistration = entry.indexOf('registerRootComponent(App)');
    expect(taskRegistration).toBeGreaterThanOrEqual(0);
    expect(rootRegistration).toBeGreaterThan(taskRegistration);
  });
});
