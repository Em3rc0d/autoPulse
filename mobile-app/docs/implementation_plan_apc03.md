# Plan de Implementación APC-03: Persistencia Productiva

Este documento establece el diseño relacional y arquitectónico que traduce los contratos del dominio (APC-01) en un esquema físico y productivo sobre `expo-sqlite` y `drizzle-orm` (APC-02), preservando la estricta separación comercial.

## User Review Required

> [!IMPORTANT]
> **Estrategia de Telemetría (Punto 7):** Propongo almacenar la telemetría de alta frecuencia (AutoPulse Live) agrupada en bloques/chunks en lugar de una fila por cada frame de lectura, para salvaguardar el I/O de SQLite. ¿Estás de acuerdo con este enfoque de "empaquetamiento temporal"?

> [!IMPORTANT]
> **Borrado Lógico vs Físico:** Propongo borrado lógico (soft-delete) para `AutoPulse Check` (evaluaciones, hallazgos) y borrado físico con políticas de retención (ej: 30 días o límite de tamaño) para `AutoPulse Live`. ¿Se ajusta esto a las expectativas comerciales?

---

## 1. Identidad de la base productiva
- **Nombre definitivo:** `autopulse_prod.db`.
- **Estrategia de versionado:** Esquema de migraciones empaquetadas (similar al Spike), pero en un directorio independiente `prod_migrations/`.
- **Destino de autopulse_spike.db:** El Spike cumplió su misión. La base canaria no se mezclará con producción y podrá ser desactivada o destruida.

## 2. Clasificación de datos
- **Alta persistencia:** Entidades maestras (Vehículos, Clientes, Operadores).
- **Transaccional core:** Evaluaciones y su ciclo de vida (DRAFT -> SIGNED).
- **Transaccional efímera:** Sesiones Live (alta frecuencia, sujetas a purga automática).
- **Inmutable:** Evidencias (incluyendo telemetría promovida) y Reportes Snapshots.

---

## 3. Modelo de AutoPulse Check (Línea Profesional)
Esquema enfocado en la integridad y el expediente.

* `check_vehicles` (id, vin, make, model, year)
* `check_clients` (id, name, contact_info)
* `check_evaluations` (id, vehicle_id, client_id, operator_id, status, created_at, signed_at)
* `check_captures` (id, evaluation_id, status, type)
* `check_findings` (id, evaluation_id, severity, confidence, technical_note, rule_source)
* `check_evidence` (id, evaluation_id, type, reference_id, content)
* `check_reports` (id, evaluation_id, version, frozen_snapshot_json)

---

## 4. Modelo de AutoPulse Live (Experiencia Telemetría)
Esquema enfocado en velocidad de inserción y purga eficiente.

* `live_sessions` (id, start_time, end_time, profile_type [OffRoad, Drag, etc], status)
* `live_markers` (id, session_id, timestamp, note)
* `live_alerts` (id, session_id, timestamp, severity, description)
* `live_telemetry_blocks` (id, session_id, window_start, window_end, compressed_data_blob)
  * *Razón:* Almacenar series temporales fila por fila ahogaría SQLite. Se insertarán "paquetes" de N segundos o N frames.

---

## 5. Puente de promoción (TelemetryEvidencePromotion)
* `promoted_telemetry_evidence` (id, evaluation_id, live_session_id, window_start, window_end, frozen_data, promoted_at)
* **Invariantes arquitectónicas:**
  * **Copia inmutable:** `frozen_data` copia los datos exactos del bloque de la sesión Live en el momento de la promoción.
  * **Independencia:** Si la sesión Live es purgada más adelante, la evidencia promovida sobrevive dentro de la Evaluación.
  * **Rechazo estricto:** Drizzle/Repositorios rechazarán la promoción si la `evaluation_id` apunta a un registro `SIGNED`.

---

## 6. Integridad e Invariantes Persistentes
- **Claves foráneas (FK):** Habilitadas a nivel de conexión SQLite (`PRAGMA foreign_keys = ON`).
- **Estados válidos:** Restricciones Check o validación en el Repositorio antes de insertar.
- **Borrado:**
  - `Check`: Soft delete con `deleted_at`.
  - `Live`: Cascading delete físico al borrar una `live_session`.

---

## 7. Escalabilidad local y Riesgos
- **Telemetría Masiva:** AutoPulse Live generará megabytes de datos rápidamente. Agrupar en `live_telemetry_blocks` minimiza la fragmentación.
- **Políticas de retención:** Se implementará (a nivel de infraestructura) un mecanismo de limpieza que borre sesiones Live antiguas o sin marcar (un-pinned) para evitar que Live degrade el espacio y performance de Check.

---

## 8. Frontera dominio–infraestructura
- Los esquemas de Drizzle residirán única y exclusivamente en `src/infrastructure/database/schema/`.
- El Dominio no conocerá ni importará a Drizzle.
- Se crearán Mapeadores (Ej: `EvaluationMapper.toDomain(row)`) para convertir los DTOs de SQL en las clases inmutables `Evaluation` aprobadas en APC-01.

---

## 9. Migración productiva inicial
- Se usará `drizzle-kit` para generar `0000_initial_prod_schema.sql` como línea base.
- Se configurará el `ProdInitializer` que orquestará la apertura de `autopulse_prod.db`.

---

## 10. Plan de Pruebas (Verificación)
- **Integridad:** Intentar insertar un Hallazgo en una Evaluación inexistente (Debe fallar FK).
- **Mutabilidad Cero:** Intentar añadir una captura a una Evaluación `SIGNED` (El repositorio debe denegarlo).
- **Promoción:** Insertar sesión Live -> Promover Ventana -> Eliminar Sesión Live Físicamente -> Verificar que el snapshot existe en la Evaluación.
- **Rendimiento Mock:** Inserción de 100 bloques de telemetría simulada.
