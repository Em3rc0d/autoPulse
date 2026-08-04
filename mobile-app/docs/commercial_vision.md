# Visión Comercial de AutoPulse

AutoPulse se define como un producto comercial estructurado en dos experiencias principales que comparten la adquisición de datos del vehículo, pero responden a necesidades y públicos distintos. Su diferenciador clave es la combinación de lectura técnica, traducción comprensible, registro histórico, y la capacidad única de convertir telemetría real en evidencia técnica controlada.

## 1. AutoPulse Check (Línea Profesional)

**Propósito:** Evaluar el vehículo, recopilar evidencia, interpretar resultados y generar un informe técnico defendible.

**Público Principal:**
* Talleres, mecánicos y técnicos automotrices.
* Inspectores y compradores de vehículos usados.
* Flotas y empresas de mantenimiento.
* Clientes que requieren evidencia verificable y trazable del estado de un vehículo.

**Características:**
* Evaluaciones vehiculares con datos del cliente/vehículo.
* Capturas OBD controladas (DTC, freeze frames, readiness).
* Evidencia fotográfica, audiovisual y técnica.
* Adquisición de datos, triaje y hallazgos basados en reglas (la conclusión final corresponde al técnico).
* Reportes firmados, inmutables e historial de evaluaciones.

## 2. AutoPulse Live (Experiencia de Telemetría)

**Propósito:** Mostrar e interpretar el comportamiento del vehículo en tiempo real mediante telemetría avanzada y visual.

**Público Principal:**
* Entusiastas del off-road, rutas y dunas.
* Pilotos de performance y pruebas de aceleración (drag).
* Usuarios en sesiones técnicas, experimentales o de monitoreo prolongado.

**Características y Presets Visuales:**
* **Essential:** RPM, Velocidad, Temperatura, Voltaje, Carga.
* **Off-Road / Dunas:** Prioriza resistencia (Refrigerante, Admisión, Inclinación, Alertas).
* **Route:** Monitoreo prolongado y consumo calculado.
* **Diagnostic:** Análisis profundo (Fuel trims, MAF, MAP, Lambda, Avance, O₂).
* **Performance:** Exigencia, máximos y presiones disponibles.
* **Drag:** RPM vs tiempo, aceleración, marcadores de salida/llegada.

*Nota:* Puede incorporar señales del teléfono (GPS, inclinación, aceleración) siempre diferenciadas claramente de las lecturas directas de la ECU.

## 3. Oferta Comercial Integrada (AutoPulse Pro)

La arquitectura soporta tres ofertas comerciales basadas en la relación estricta de que **Check documenta** y **Live observa**:

1. **AutoPulse Check:** El producto profesional de diagnóstico y reportes.
2. **AutoPulse Live:** El producto para entusiastas y monitoreo IRL.
3. **AutoPulse Pro:** La combinación total. Permite la **Promoción de Telemetría** (vía `TelemetryEvidencePromotion`), convirtiendo ventanas específicas de una sesión Live en evidencia inmutable adjunta a un expediente profesional.

## 4. Directriz Arquitectónica para el Modelado (APC-03)

El modelado de datos y persistencia productiva debe respetar esta separación desde su génesis:
* La telemetría de una sesión Live **no** es automáticamente una evaluación ni un hallazgo.
* Los contratos definidos en APC-01 deben persistirse usando la infraestructura validada en APC-02.
* El diseño de la base de datos debe reflejar fielmente la división comercial entre Check y Live.
