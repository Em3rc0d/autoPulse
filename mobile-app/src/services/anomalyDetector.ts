// src/services/anomalyDetector.ts
// Implementación Edge de Detección de Anomalías

export interface TelemetryFrame {
  rpm: number | null;
  speed: number | null;
  coolant_temp: number | null;
  engine_load: number | null;
  throttle_pos: number | null;
  maf: number | null;
  voltage: number | null;
  oil_temp?: number | null;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  reasons: string[];
}

class AnomalyDetector {
  /**
   * Evalúa un frame de telemetría buscando combinaciones inusuales
   * o valores fuera de rangos seguros que indicarían un comportamiento anómalo.
   * Reemplaza el modelo Isolation Forest del backend.
   */
  public evaluate(frame: TelemetryFrame): AnomalyResult {
    let score = 0;
    const reasons: string[] = [];

    // 1. Detección de Temperatura Crítica (Refrigerante o Aceite)
    if (frame.coolant_temp !== null && frame.coolant_temp > 105) {
      score += 40;
      reasons.push(`Alta temperatura de refrigerante (${frame.coolant_temp}°C)`);
    }
    if (frame.oil_temp !== null && frame.oil_temp > 120) {
      score += 35;
      reasons.push(`Alta temperatura de aceite (${frame.oil_temp}°C)`);
    }

    // 2. Relación RPM vs Velocidad (Ej. altas RPM y baja velocidad constante = Fricción/Transmisión patinando)
    if (frame.rpm !== null && frame.speed !== null) {
      if (frame.rpm > 4500 && frame.speed < 20) {
        score += 30;
        reasons.push("Revoluciones excesivas para velocidad actual");
      }
    }

    // 3. Sobrecarga del motor con baja respuesta
    if (frame.engine_load !== null && frame.throttle_pos !== null && frame.speed !== null) {
      if (frame.engine_load > 90 && frame.throttle_pos > 80 && frame.speed < 30) {
        score += 25;
        reasons.push("Alta carga de motor sin aceleración proporcional (Posible pérdida de potencia)");
      }
    }

    // 4. Fallo del sistema eléctrico (Alternador)
    if (frame.voltage !== null) {
      if (frame.voltage < 11.5) {
        score += 50;
        reasons.push(`Voltaje crítico del sistema (${frame.voltage.toFixed(1)}V)`);
      } else if (frame.voltage > 15.5) {
        score += 45;
        reasons.push(`Sobrecarga del alternador (${frame.voltage.toFixed(1)}V)`);
      }
    }

    // El umbral para considerar una anomalía grave es 50
    return {
      isAnomaly: score >= 50,
      score,
      reasons
    };
  }
}

export const edgeAnomalyDetector = new AnomalyDetector();
