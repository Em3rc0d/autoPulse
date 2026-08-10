import { ObdCommandExecutor } from './ports/ObdCommandExecutor';

class ObdTransportRegistry {
  private controllers: Map<string, ObdCommandExecutor> = new Map();

  register(handleId: string, controller: ObdCommandExecutor) {
    this.controllers.set(handleId, controller);
  }

  take(handleId: string): ObdCommandExecutor | null {
    const controller = this.controllers.get(handleId);
    if (controller) {
      this.controllers.delete(handleId);
      return controller;
    }
    return null;
  }
}

export const obdTransportRegistry = new ObdTransportRegistry();
