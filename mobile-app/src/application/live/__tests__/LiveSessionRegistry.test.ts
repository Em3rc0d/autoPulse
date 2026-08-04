import { liveSessionRegistry } from '../LiveSessionRegistry';
import { RealLiveSessionController } from '../RealLiveSessionController';

describe('LiveSessionRegistry', () => {
  it('should return one controller per session', () => {
    const mockController1 = {} as RealLiveSessionController;
    const mockController2 = {} as RealLiveSessionController;

    liveSessionRegistry.registerController('session-1', mockController1);
    liveSessionRegistry.registerController('session-2', mockController2);

    expect(liveSessionRegistry.getController('session-1')).toBe(mockController1);
    expect(liveSessionRegistry.getController('session-2')).toBe(mockController2);

    liveSessionRegistry.unregisterController('session-1');
    expect(liveSessionRegistry.getController('session-1')).toBeUndefined();
  });
});
