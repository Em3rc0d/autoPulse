import { LiveSessionCoordinator } from './LiveSessionCoordinator';

class LiveSessionRegistry {
  private controllers: Map<string, LiveSessionCoordinator> = new Map();

  getController(sessionId: string): LiveSessionCoordinator | undefined {
    return this.controllers.get(sessionId);
  }

  registerController(sessionId: string, controller: LiveSessionCoordinator) {
    this.controllers.set(sessionId, controller);
  }

  unregisterController(sessionId: string) {
    this.controllers.delete(sessionId);
  }
}

export const liveSessionRegistry = new LiveSessionRegistry();
