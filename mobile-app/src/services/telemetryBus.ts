// src/services/telemetryBus.ts
// Event Bus de alto rendimiento para desacoplar el flujo de datos OBD-II de la UI de React.

type Listener = (data: any) => void;

class TelemetryBus {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, callback: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback); // Retorna función para desuscribirse
  }

  off(event: string, callback: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, data: any) {
    if (!this.listeners[event]) return;
    for (const callback of this.listeners[event]) {
      callback(data);
    }
  }
}

export const telemetryBus = new TelemetryBus();
