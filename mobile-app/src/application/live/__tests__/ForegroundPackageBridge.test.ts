import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

// Execute the installed dependency's real JavaScript, not a mock of its API.
// Only the Android bridge and scheduler are substituted; this is not a device test.
function loadPackage() {
  const listeners: Record<string, (message: string) => void> = {};
  const bridge = {
    startService: jest.fn().mockResolvedValue(null),
    isRunning: jest.fn().mockResolvedValue(1),
    runTask: jest.fn().mockResolvedValue(null),
    stopService: jest.fn().mockResolvedValue(null),
    stopServiceAll: jest.fn().mockResolvedValue(null),
  };
  class Emitter {
    addListener(name: string, listener: (message: string) => void) {
      listeners[name] = listener;
      return { remove: jest.fn() };
    }
  }
  const native = { NativeModules: { ForegroundService: bridge },
    AppRegistry: { registerHeadlessTask: jest.fn() }, NativeEventEmitter: Emitter,
    DeviceEventEmitter: new Emitter(), Alert: { alert: jest.fn() } };
  const source = fs.readFileSync(path.resolve(__dirname,
    '../../../../node_modules/@supersami/rn-foreground-service/index.js'), 'utf8');
  const babel = require('@babel/core');
  const code = babel.transformSync(source, { babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  const exports: Record<string, any> = {};
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (name === 'react-native') return native;
    throw new Error(`Unexpected dependency: ${name}`);
  }, console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  setTimeout: (fn: () => void) => { Promise.resolve().then(fn); }, clearTimeout: jest.fn() });
  return { api: exports.default, bridge, listeners };
}
const config = { id: 1234, title: 'AutoPulse', message: 'Live OBD session active',
  ServiceType: 'connectedDevice', icon: 'ic_launcher', button: false, button2: false };

describe('Installed foreground package across its native bridge', () => {
  it('waits for native foreground readiness before scheduling tasks or marking running', async () => {
    const { api, bridge } = loadPackage();
    let acknowledge!: (running: number) => void;
    bridge.isRunning.mockImplementationOnce(() => new Promise<number>(resolve => { acknowledge = resolve; }));
    const starting = api.start(config);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(bridge.isRunning).toHaveBeenCalled();
    expect(api.is_running()).toBe(false);
    expect(bridge.runTask).not.toHaveBeenCalled();
    acknowledge(1);
    await starting;
    expect(api.is_running()).toBe(true);
    expect(bridge.runTask).toHaveBeenCalledTimes(1);
    expect(bridge.startService).toHaveBeenCalledWith(expect.objectContaining(config));
  });

  it('rejects and never runs tasks if Android accepts the intent but never starts foreground', async () => {
    const { api, bridge } = loadPackage();
    bridge.isRunning.mockResolvedValue(0);
    await expect(api.start(config)).rejects.toThrow('FOREGROUND_SERVICE_START_NOT_CONFIRMED');
    expect(api.is_running()).toBe(false);
    expect(bridge.runTask).not.toHaveBeenCalled();
    expect(bridge.isRunning).toHaveBeenCalledTimes(40);
  });

  it('clears running and reports native errors after start', async () => {
    const { api, bridge, listeners } = loadPackage();
    const onError = jest.fn();
    api.register({ config: { alert: false, onServiceErrorCallBack: onError } });
    await api.start(config);
    listeners.onServiceError('native failure');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(api.is_running()).toBe(false);
    expect(bridge.stopService).toHaveBeenCalledTimes(1);
  });
});
