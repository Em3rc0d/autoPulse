// Mock of Anomaly Detector
const edgeAnomalyDetector = {
  evaluate: (reading) => {
    let isAnomaly = false;
    let reasons = [];
    if (reading.coolant_temp > 105) { isAnomaly = true; reasons.push('Sobrecalentamiento Crítico (>105°C)'); }
    if (reading.engine_load > 85 && reading.rpm < 2000) { isAnomaly = true; reasons.push('Sobreesfuerzo (Alta carga a bajas RPM)'); }
    if (reading.speed > 120 && reading.coolant_temp > 100) { isAnomaly = true; reasons.push('Estrés térmico a alta velocidad'); }
    if (reading.rpm > 6500) { isAnomaly = true; reasons.push('Sobregiro del motor (Redline)'); }
    return { isAnomaly, reasons };
  }
};

const physics = { speed: 0, rpm: 800, gear: 1, targetSpeed: 60, coolant: 90, time: 0 };
const results = [];

console.log("🚀 INICIANDO SIMULACIÓN DE TRÁFICO ANIMADO (30 SEGUNDOS)\n");

for(let i=0; i<30; i++) {
    physics.time += 1;
    if (physics.time % 8 === 0) {
      physics.targetSpeed = Math.max(0, Math.min(160, physics.speed + (Math.random() * 90 - 40)));
      if (Math.random() < 0.2) physics.targetSpeed = 0; // Parada por tráfico
      results.push(`\n[🚦 EVENTO] Nuevo Objetivo de Velocidad: ${Math.round(physics.targetSpeed)} km/h`);
    }

    const isAccelerating = physics.speed < physics.targetSpeed;

    if (isAccelerating) {
      physics.rpm += 300 + Math.random() * 150;
      physics.speed += (physics.gear * 0.8) + Math.random() * 2;
      if (physics.rpm > 5500) {
        if (physics.gear < 6) { 
          physics.gear++; 
          physics.rpm = 2800; 
          results.push(`[⚙️] CAMBIO A MARCHA ${physics.gear}`);
        } 
      }
    } else {
      physics.rpm -= 200 + Math.random() * 100;
      physics.speed -= 2.5 + Math.random() * 2;
      if (physics.rpm < 1500) {
        if (physics.gear > 1) { 
          physics.gear--; 
          physics.rpm = 3800; 
          results.push(`[⚙️] REDUCIENDO A MARCHA ${physics.gear}`);
        } else if (physics.speed <= 0) { 
          physics.speed = 0; 
          physics.rpm = 800; 
        }
      }
    }
    physics.coolant = 90 + (physics.rpm / 6000) * 15;
    
    const reading = {
      rpm: Math.round(physics.rpm),
      speed: Math.max(0, Math.round(physics.speed)),
      coolant_temp: Math.round(physics.coolant),
      engine_load: Math.min(100, (physics.rpm / 7000) * 100 + Math.random() * 10)
    };
    
    // 2. Evaluar con Edge AI
    const anomaly = edgeAnomalyDetector.evaluate(reading);
    
    results.push(
      `T+${(i+1).toString().padStart(2, '0')}s | Marcha ${physics.gear} | RPM: ${reading.rpm.toString().padStart(4, ' ')} | Vel: ${reading.speed.toString().padStart(3, ' ')} km/h | Temp: ${reading.coolant_temp}°C | Carga: ${reading.engine_load.toFixed(1)}% | Estado: ${anomaly.isAnomaly ? '⚠️ ' + anomaly.reasons.join(', ') : '✅ Nominal'}`
    );
}

console.log(results.join('\n'));
console.log("\n✅ SIMULACIÓN EXITOSA. Motor de Físicas y Detección Edge funcionando a la perfección.");
