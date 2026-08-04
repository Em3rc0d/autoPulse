import { RealLiveSessionController } from './RealLiveSessionController';

class LiveSessionRegistry {
  private controllers: Map<string, RealLiveSessionController> = new Map();

  getController(sessionId: string): RealLiveSessionController | undefined {
    return this.controllers.get(sessionId);
  }

  registerController(sessionId: string, controller: RealLiveSessionController) {
    this.controllers.set(sessionId, controller);
  }

  unregisterController(sessionId: string) {
    this.controllers.delete(sessionId);
  }
}

export const liveSessionRegistry = new LiveSessionRegistry();
