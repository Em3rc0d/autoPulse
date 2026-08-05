import { liveSessionRegistry } from '../LiveSessionRegistry';
import { LiveSessionCoordinator } from '../LiveSessionCoordinator';

describe('LiveSessionRegistry', () => {
  afterEach(() => {
    liveSessionRegistry.unregisterController('test-session');
  });

  it('registers and retrieves a controller', () => {
    const mockController = {} as LiveSessionCoordinator;
    liveSessionRegistry.registerController('test-session', mockController);
    
    expect(liveSessionRegistry.getController('test-session')).toBe(mockController);
  });

  it('should return one controller per session', () => {
    const mockController1 = {} as LiveSessionCoordinator;
    const mockController2 = {} as LiveSessionCoordinator;

    liveSessionRegistry.registerController('session-1', mockController1);
    liveSessionRegistry.registerController('session-2', mockController2);

    expect(liveSessionRegistry.getController('session-1')).toBe(mockController1);
    expect(liveSessionRegistry.getController('session-2')).toBe(mockController2);

    liveSessionRegistry.unregisterController('session-1');
    expect(liveSessionRegistry.getController('session-1')).toBeUndefined();
  });
});
