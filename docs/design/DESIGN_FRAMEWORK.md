# AutoPulse — Design Framework

**Versión:** DF-MK0 · 1.0 (propuesta documental)  
**Método:** GALACTIC → GRAVITY → CONTRACT  
**Lema:** DESIGN GALACTIC → EXECUTE BY CONTRACT  
**Tipo:** Marco de diseño de producto, experiencia, arquitectura y gobernanza de interfaz  
**Estado:** DESIGN PROPOSAL · NOT IMPLEMENTED · NOT CERTIFIED  
**Referencia de revisión:** PR #96, commit `b2c801bcd46e4a07685a75dbc962c6d51fd77edf`  
**Fecha de elaboración:** 2026-11-16  
**Fuente metodológica:** `designframework.md`, documento suministrado por el usuario, versión 1.0, «GALACTIC → GRAVITY → CONTRACT».  
**Alcance:** AutoPulse Android, Live, Check, History/Session Report, Garage, configuración, observabilidad y su evolución futura. No presupone soporte exclusivo de Renault.

> **Diseña el universo. Descubre sus leyes. Construye una pieza a la vez.**
>
> **Una idea en GALACTIC no es una feature aprobada, un cambio de diseño no es una autorización de APK y una captura o CI verde no equivale a certificación física.**

---

## 0. Instrucciones de uso y autoridad

Este documento aplica al diseño de AutoPulse la metodología recibida. **No reemplaza** los contratos ya aprobados de adquisición, seguridad, Check ni liberación. No cambia código, tokens, permisos, persistencia, comandos OBD, política de background o estado de las PR.

### Orden de precedencia

1. Seguridad física, comportamiento read-only y restricciones legales/contractuales de liberación: `docs/release/AUTOPULSE_V1_CLOSURE_AUTHORITY.md` y contratos específicos vigentes.
2. Semántica operativa y evidencia de Live: `docs/design/AUTOPULSE_SYSTEM_DESIGN.md`.
3. Semántica de Check: `docs/design/check/CHECK_DESIGN_AUTHORITY.md` y `CHECK_SAFETY_CONTRACT.md`.
4. Este documento: **método, diseño objetivo, catálogo de decisiones y contratos propuestos**.
5. Referencias de inspiración visual: `mobile-app/uis/stitch_autopulse_digital_cluster/high_performance_diagnostic_interface/DESIGN.md`.
6. Comportamiento actual en código: verificable mediante `mobile-app/src/styles/theme.ts` y componentes reales. Es **evidencia del presente**, no necesariamente estándar aprobado.

Ante una contradicción con una autoridad superior: detener la promoción del contrato, registrar la discrepancia y resolverla formalmente. Ningún valor de una propuesta se vuelve oficial solo por aparecer en este documento.

### Etiquetas de procedencia

| Etiqueta | Significado y manejo |
|---|---|
| `OFFICIAL` | Contrato vigente/autoridad expresamente aprobada. Requiere referencia exacta. |
| `OBSERVED` | Comprobado en código, CI, reporte físico o captura identificada. No implica comportamiento universal. |
| `INFERRED` | Hipótesis razonada; exige falsación y revisión antes de promoverse. |
| `INSPIRED` | Referencia conceptual o estética sin autoridad de implementación. |
| `GENERATED` | Recomendación nueva de este framework; requiere gate de aprobación. |

Estado de una capacidad y **nivel de evidencia** son dimensiones independientes. Ejemplo: `EXISTS in code / PHYSICAL UNVERIFIED` es válido; `CERTIFIED` no se deduce de `EXISTS`.

---

## 1. Propósito, promesa y doble protección

La pregunta rectora no es «¿qué pantalla construiremos?» sino:

> **¿Cómo puede AutoPulse transformar observaciones reales de un vehículo en información comprensible y útil, conservando su procedencia y sin distraer ni engañar al conductor?**

AutoPulse V1 es una aplicación Android local-first, de lectura OBD, centrada en evidencia. Sus superficies fundamentales son:

- **Live:** adquisición en curso e interpretación orientada al conductor.
- **History / Session Report:** reconstrucción de lo capturado, preservación e integridad de la evidencia.
- **Check:** consulta diagnóstica read-only y reporte de cobertura limitada con trazabilidad.
- **Garage, Settings y superficies auxiliares:** contexto, configuración, accesibilidad y administración local.

**Protección de visión:** el diseño presente no debe impedir razonablemente la evolución hacia herramientas de explicación, simulación, automatización controlada y diagnósticos más profundos.

**Protección de realidad:** la ambición futura no justifica desestabilizar Live, falsificar soporte de PIDs, romper una sesión, introducir trabajo visual pesado ni distraer al conductor. La estabilidad operativa es una invariante de producto.

### Invariantes superiores

`No fabricated evidence` · `No silent data loss` · `No driver-critical interaction required in motion` · `No unsupported ECU operation` · `No false health certification` · `No unbounded loading/recovery` · `No background guarantee without service evidence` · `No merge/build implied by design approval`.

---

## 2. Proceso canónico

```text
GALACTIC (IMAGINAR)
    ↓ genera escenarios sin veto prematuro
DISCOVER (DESCOMPONER)
    ↓ casos, actores, contextos, preguntas
ARCHITECT (ABSTRAER)
    ↓ entidades, fuentes de verdad, estados, invariantes
GRAVITY (CONFRONTAR)
    ↓ Capability Map, Reality Map, Gap Map
STRATEGIST (PRIORIZAR)
    ↓ valor, riesgo, madurez, costo y dependencia
CONTRACT (DELIMITAR)
    ↓ cambios pequeños con aceptación y rollback
BUILD (IMPLEMENTAR, solo con gate)
    ↓ pruebas repetibles y evidencias
VALIDATE (REALITY TEST)
    ↓ qué demostró CI, emulador y vehículo
LEARN ─────────────────────────────→ GALACTIC
```

**Modos mentales no intercambiables:**

| Modo | Pregunta | Output | Prohibición |
|---|---|---|---|
| `GALACTIC` | ¿Qué podría ser útil, incluso más allá del Android actual? | Catálogo amplio de escenarios | No evaluar por dificultad ni convertir ideas en backlog. |
| `ARCHITECT` | ¿Qué primitivas explican muchos escenarios? | Domain Model, invariantes, dependencias | No crear una lógica distinta por cada pantalla. |
| `STRATEGIST / GRAVITY` | ¿Qué aporta valor hoy y qué preservar para mañana? | Capability Map, Gap Map, Value Matrix, roadmap | No confundir «interesante» con «ahora». |
| `ENGINEER / CONTRACT` | ¿Cuál es el cambio mínimo demostrable y reversible? | Contrato con inputs, outputs, tests, fallo y rollback | No comenzar código con decisiones importantes abiertas. |

Se puede reabrir GALACTIC en producto, módulo, pantalla o interacción particular. Su amplitud **no cambia** el alcance de V1 sin una decisión de estrategia.

---

## 3. GALACTIC — Universo de AutoPulse

### 3.1. Gramática de exploración

```text
ENTITY × PERSPECTIVE × ACTION × TIME × INTERFACE × ACTOR × CONTEXT
```

| Dimensión | Variantes AutoPulse para explorar, no compromisos |
|---|---|
| Entity | vehículo, ECU, adaptador, PID, señal, DTC, sesión, alerta, reporte, conductor, perfil, evento, permiso |
| Perspective | operativa, temporal, seguridad, confiabilidad, procedencia, mantenimiento, ergonomía, rendimiento, costo |
| Action | observar, comparar, rastrear, explicar, exportar, reproducir, simular, auditar, filtrar, confirmar, recuperar |
| Time | pasado, presente, esperado, observado, simulado, histórico, antes/después de incidente |
| Interface | cockpit, detalle técnico, timeline, lista, gráfico, voz, háptica, JSON, CLI, laboratorio automatizado |
| Actor | conductor, acompañante, propietario, técnico, auditor QA, ingeniero, agente de automatización autorizado |
| Context | arranque, uso normal, conducción, taller, sin datos, falla de conexión, recuperación, proceso muerto, postflight |

### 3.2. Catálogo galáctico inicial

**G-01.** Un conductor oye una instrucción breve ante riesgo térmico, sin leer una tarjeta mientras maneja.  
**G-02.** El sistema explica por qué una lectura aparece como ausente y si falta soporte, permiso, conexión o una respuesta válida.  
**G-03.** Un técnico reproduce una sesión persistida y observa cronológicamente qué evidencia cambió, sin alterar el reporte original.  
**G-04.** Un auditor compara Summary, métricas exportadas y eventos V3, identificando discrepancias de correlación.  
**G-05.** AutoPulse distingue `0 km/h` real de `sin velocidad disponible`.  
**G-06.** Una misma sesión se presenta como cockpit simplificado, tabla detallada o evidencia técnica exportable.  
**G-07.** Un usuario cambia entre Logan, Duster u otro automóvil y el sistema descubre capacidades sin asumir PIDs de otro vehículo.  
**G-08.** Un conductor termina Live y recibe un resumen compacto sin esperar un proceso que bloquee la interfaz.  
**G-09.** El sistema preserva información válida si desaparece Bluetooth a mitad de una sesión.  
**G-10.** Un fallo de proceso puede explicarse al siguiente inicio distinguiendo ausencia de datos de pérdida de integridad.  
**G-11.** Un conductor selecciona Essential, Family, Performance, Off-Road o Diagnostic sin que los modos inventen señales.  
**G-12.** El sistema explica el alcance real de Check y las ECU/servicios que no pudo evaluar.  
**G-13.** Una sesión de laboratorio genera video, logs, pruebas y un reporte de estabilidad sin 24 capturas manuales.  
**G-14.** La UI se adapta a pantallas pequeñas, letra ampliada, notches y diferentes niveles de atención.  
**G-15.** Un usuario consulta diferencias de comportamiento antes/después de una intervención mecánica sin confundir correlación con causalidad.  
**G-16.** Una posible IA explica evidencia con incertidumbre, pero no certifica fallas mecánicas ni inicia comandos ECU sin autorización.

Los casos G-01…G-16 son **exploración**, no planificación ni permiso para implementarlos. Sus mecanismos comunes importan más que su número.

### 3.3. Preguntas universales para cualquier señal, alerta o reporte

1. **Identidad:** ¿qué señal/evento es y a qué vehículo, ECU y sesión pertenece?
2. **Origen:** ¿es ECU directa, adaptador, teléfono o cálculo?
3. **Estado:** ¿es válida, retrasada, parcial, inválida o desconocida?
4. **Tiempo:** ¿cuándo fue observada y con qué frescura?
5. **Evidencia:** ¿qué consulta, respuesta, bloque o regla la respalda?
6. **Dependencias:** ¿qué pantalla, alerta o inferencia depende de ella?
7. **Ausencia:** ¿qué muestra la UI si no hay evidencia?
8. **Impacto:** ¿qué pasa con el usuario si el valor desaparece durante Live?
9. **Explicación:** ¿podemos explicar la etiqueta sin inventar datos?
10. **Futuro:** ¿cómo sería su replay o comparación histórica sin cambiar su significado?

---

## 4. ARCHITECT — Primitivas y modelo conceptual

No crear funciones independientes para cada modo cuando comparten una misma verdad. Las capacidades comunes candidatas son:

| Primitiva | Responsabilidad | Invariante |
|---|---|---|
| `Observation` | Muestra con valor, unidad, tiempo, fuente, calidad y señal | Una ausencia no es un cero. |
| `CapabilityEvidence` | Diferenciar definición, anuncio, consulta y observación real | `DEFINED ≠ SUPPORTED ≠ OBSERVED`. |
| `SignalPresentation` | Proyección de observación a métricas legibles | Nunca cambia calidad/origen por estética. |
| `AttentionState` | Prioridad de advertencia, acción y tono | Un estado rojo requiere fundamento y contexto. |
| `SessionLifecycle` | Inicio, adquisición, recuperación, stop y terminalización | Los estados son explícitos y recuperables. |
| `DurableEvidence` | Integridad y orden de eventos/bloques | Nada se certifica completo si faltan piezas. |
| `DiagnosticCoverage` | Servicios, endpoints y limitaciones realmente examinadas | `NO_DTC_REPORTED ≠ CAR_HEALTHY`. |
| `Projection` | Cockpit / Check / Summary / Export desde dominio común | La vista no se convierte en fuente autoritativa. |
| `DesignToken` | Rol semántico de color/tipo/espacio/forma/motion | No depender de constantes arbitrarias por pantalla. |
| `TestScenario` | Escenario, estímulo, oracle, evidencia y resultado | Un replay no prueba radio BLE real. |

**Capas de verdad:** `AUTHORITATIVE` (bloque firmado / contrato), `OBSERVED` (ECU o dispositivo), `DERIVED` (algoritmo), `CACHED` (último valor), `EXPECTED` (requisito), `SIMULATED` (replay). La UI debe poder diferenciarlas cuando influyen en la decisión del usuario.

### 4.1. Interfaces como proyecciones

```text
                  ECU / ELM / Phone Sensors
                            ↓
                 Acquisition + Provenance
                            ↓
                  Domain Evidence Model
                            ↓
      ┌─────────────────────┼───────────────────┐
      ↓                     ↓                   ↓
 Driver Live Cockpit   History / Summary    Check / Evidence
      ↓                     ↓                   ↓
      └────────────── Local QA export ──────────┘
```

Las decisiones de estado y las reglas de seguridad pertenecen al dominio; Live y Check no pueden inventar políticas diferentes. Un futuro CLI, voz o agente debe reutilizar contratos y no crear verdades paralelas.

---

## 5. GRAVITY — Reality Map y Gap Map

### 5.1. Clasificación

`EXISTS` · `PARTIAL` · `WEAK` · `MISSING` · `EXPERIMENTAL` · `EXTERNAL`, aplicadas **a la capacidad en código**. Separadamente: `TESTED_UNIT` · `TESTED_EMULATOR` · `OBSERVED_PHYSICAL` · `CERTIFIED_PHYSICAL` · `UNVERIFIED`.

### 5.2. Auditoría de superficies actuales (HEAD indicado)

| Capacidad | Reality Map | Evidencia de repositorio | Riesgo / gap |
|---|---|---|---|
| Modelo de producto orientado a evidencia | `EXISTS` documental | `AUTOPULSE_SYSTEM_DESIGN.md` | Consolidar contrato visual sin contradecirlo. |
| Check read-only, etapas y cobertura | `EXISTS` documental / implementación parcial por escenarios | `CHECK_DESIGN_AUTHORITY.md` + pantallas de Check | Evitar certificar ECUs o servicios no consultados. |
| Paleta compartida React Native | `PARTIAL` | `src/styles/theme.ts` | Convive con colores hardcoded por pantalla. |
| Referencia visual aspiracional | `EXISTS` como inspiración | `uis/stitch_.../DESIGN.md` | Colores y glassmorphism no son norma de runtime. |
| Tipografía consistente y legible | `WEAK` | `DriverModeSelector.tsx` usa 7.5/8/10, `DriverStartupCoordinator.tsx` 8/9; `DriverLiveSessionScreen.tsx` 70/26 | La diferencia extrema complica legibilidad y escalado. |
| Densidad informativa de Live | `PARTIAL` | `DriverLiveSessionScreen.tsx`, `BaseLiveMetricCard.tsx` | Verificar jerarquía, altura útil y scroll real en equipos. |
| Estados semánticos de Live | `PARTIAL` | `AUTOPULSE_SYSTEM_DESIGN.md`, componentes Live | Falta matriz única pantalla/voz/alerta/ausencia. |
| Estados de arranque sin refrigerante | `WEAK` | `DriverStartupCoordinator.tsx` + `ColdStartMaturity.ts` | STARTUP puede persistir si no hay temperatura, sin que ello sea un crash. |
| Observabilidad post-sesión | `PARTIAL` | MK10.5.1 en PR #96, CI verde | Arreglo `41` aún sin APK física nueva; no sobrecertificar. |
| Guía de componentes con variantes y pruebas visuales | `MISSING` como sistema integrado | Componente y estilos locales dispersos | Definir API visual/roles sin reescribir de golpe. |
| Laboratorio UI Android automatizado | `EXPERIMENTAL / planned` | Jest/replay CI; no prueba visual integral certificada | Priorizar APK única y evidencia automatizada local. |

**Hallazgo verificable:** `theme.ts` declara `background: #0e1417`, `primary: #00d1ff`, `warning: #FF9F0A`, `success: #32D74B`. La referencia Stitch propone otros tokens y un concepto luminoso. Además `DriverModeSelector` usa un activo `#d7ff4f` y el cockpit contiene estilos locales. **No elegir una paleta por votación estética:** primero aprobar roles semánticos, luego valores accesibles, después migrar por contratos.

### 5.3. Lecciones del Logan (18 octubre 2026)

- Live mostró RPM, velocidad, carga y otros valores con sesión completada y evidencia persistente; un error posterior del analizador JSON no equivale a crash.
- `0105` estuvo ausente de la sesión; no se puede inventar temperatura ni concluir soporte a partir del catálogo general.
- Un `STARTUP · Collecting stable evidence` persistente merece una explicación de *por qué espera*, no un READY falso por timeout.
- Las pantallas de detalle pueden ser densas, pero el **cockpit** debe poder entenderse de un vistazo; la información técnica amplia pertenece a zonas estacionarias.
- Esta muestra física es un **caso de Reality Test**, no una validación universal de Android/ELM/vehículos.

---

## 6. STRATEGIST — Selección y roadmap de capacidades

### 6.1. Matriz de valor cualitativa

| Iniciativa | User / Risk Value | Architecture Fit | Costo/riesgo | Decisión de fase |
|---|---|---|---|---|
| Semántica visual de evidencia y ausencia | Muy alto: evita falsos ceros/READY | Alta | Medio | `VALUABLE / NEXT CONTRACT` |
| Tokens y legibilidad de base | Alto: corrección transversal | Alta | Medio, riesgo de regresión visual | `VALUABLE / NEXT CONTRACT` |
| Estados STARTUP sin `0105` | Alto: elimina espera inexplicada | Alta | Medio por voz y seguridad | `VALUABLE / NEXT CONTRACT` |
| QA visual reproducible + capturas automáticas | Alto: disminuye trabajo manual | Alta | Medio | `VALUABLE / NEXT CONTRACT` |
| Transiciones BLE/Android muy prolongadas | Alto: estabilidad BIEN | Alta | Requiere hardware | `VALUABLE / PHYSICAL GATE` |
| Glow/glassmorphism generalizado | Bajo frente a legibilidad | Baja en hardware heterogéneo | Potencial costo visual | `INSPIRED / DEFERRED` |
| Diagnóstico autónomo con IA | Incertidumbre y alto riesgo de afirmación | Requiere nuevos contratos | Alto | `GALACTIC / LATER` |
| Escritura de comandos ECU no read-only | Fuera de promesa V1 | Conflicto con seguridad | Inaceptable sin rediseño | `OUT OF SCOPE` |

`COOL ≠ VALUABLE ≠ NOW`. Una capacidad puede conservarse en visión y quedar `DEFERRED` sin comprometer roadmap.

### 6.2. Secuencia de diseño; no orden de despliegue aprobado

```text
DF-MK0  Reality Map + criterios + fuentes                 [ESTE DOCUMENTO]
DF-MK1  Semántica de estados y taxonomía visual/voz         [PROPUESTA]
DF-MK2  Tokens y componentes mínimos                       [PROPUESTA]
DF-MK3  Migración vertical de una pantalla, con rollback    [PROPUESTA]
DF-MK4  Pruebas de regresión visual, accesibilidad y QA     [PROPUESTA]
DF-MK5  Validación con hardware y estabilidad sostenida     [GATE FÍSICO]
```

Una fase documental puede aprobarse sin autorizar modificación de runtime. No fusionar etapas por conveniencia.

---

## 7. Design System objetivo — reglas semánticas

Esta sección expresa un **sistema objetivo GENERATED**, no tokens finales aprobados. Los nombres visuales podrán variar si el test de contraste o la marca lo requiere.

### 7.1. Jerarquía de atención

En conducción:

```text
ACCIÓN CRÍTICA REAL
    ↓
ESTADO DE CONEXIÓN / EVIDENCIA QUE REQUIERE ATENCIÓN
    ↓
VALOR PRIMARIO CON UNIDAD Y FRESCURA
    ↓
VALORES SECUNDARIOS
    ↓
DETALLE TÉCNICO AL ESTACIONAR
```

En pantalla estable: el estado normal debe ser silencioso y compacto. No ocupar media pantalla con un banner «Live». Conduciendo: no obligar a desplazamiento vertical, abrir menús, interpretar párrafos ni tocar botones pequeños.

### 7.2. Estados compartidos de presentación

| Estado dominio | Representación visual | Voz / haptic | Prohibiciones |
|---|---|---|---|
| `WAITING_FOR_ECU` | Espera corta; mostrar qué falta | Ninguna por defecto | No mostrar valor congelado como actual. |
| `ECU_LIVE_HEALTHY` | Indicador discreto; valor legible | Silencio normal | No duplicar banner de éxito. |
| `SIGNAL_UNAVAILABLE` | `—` + motivo cuando se conoce | Ninguna | No mostrar `0`, ni inferir PID soportado. |
| `SIGNAL_STALE` | Indicador de retraso y última observación | Aviso solo si accionable | No presentar dato viejo como instantáneo. |
| `MOTION_DATA_LIMITED` | Precisión sobre qué señal falta | Resumen eventual; no spam | No convertir ausencia de velocidad en muerte total de telemetría. |
| `RECOVERING` | Estado transitorio con resultado acotado | Aviso de cambio de estado según severidad | No loop infinito sin estado terminal. |
| `SESSION_INTERRUPTED` | Estado explícito, persistible y recuperable | Una advertencia breve cuando corresponda | No decir que finalizó normalmente. |
| `CRITICAL_CONFIRMED` | Alta prominencia, instrucción breve | Voz/haptic según política | No diagnosticar mecánicamente sin evidencia. |
| `CHECK_LIMITED` | Cobertura evaluada y omisiones | No sugerir automóvil «sin fallas» | No equiparar cero DTC encontrados con salud total. |

No basta un color: iconografía, texto corto, forma, posición y accesibilidad deben reforzar la semántica. Un estado puede utilizar distintos tonos en Live y Check si mantiene **el mismo significado**, no necesariamente idéntico hex.

### 7.3. Densidad informativa + legibilidad

Principio de interfaz: **más información útil por viewport, no más widgets por viewport**. El espacio vacío es necesario cuando separa decisiones; es desperdicio cuando encierra una sola cifra en tarjetas enormes y oculta contexto relevante bajo scroll.

Criterios candidatos para validar, no constantes ya aprobadas:

- Texto general legible: evaluar cuerpo ≈16 unidades lógicas y soporte de escala de fuente del sistema. Evitar métricas esenciales o controles con texto 7–10 cuando se deben leer en conducción.
- Etiquetas técnicas: preferir 12–14 con contraste suficiente; tamaños inferiores solo si se demuestra que la información no es crítica, accesible por otro canal y pasa test de escalado.
- Tocar con seguridad: objetivo de área interactiva ≥48 dp para acciones principales en Android; el objetivo real se verificará con tamaños físicos y accesibilidad.
- Contraste propuesto: ≥4.5:1 para texto común; ≥3:1 para texto grande e iconografía que transmite información. Medir para cada combinación foreground/background, sin confiar en color neón por sí mismo.
- Números con ancho tabular para lecturas cambiantes; valor + unidad + origen/frescura cuando afecte la interpretación.
- Pantallas pequeñas: reordenar o condensar, nunca resolver recortando etiquetas a 7px. Modos/controles secundarios pueden colapsar explícitamente.
- Safe Area, navegación Android, teclado, scroll y lectores de pantalla no deben ocultar Stop ni reportes.
- Reducción de movimiento y latencia: animar solo cambios que ayuden a comprender el estado, sin glow/bloom permanente de alto costo.

Estos umbrales se adoptan como **propuestas para tests**, no como promesa de cumplimiento WCAG/Android aún demostrado.

### 7.4. Roles de tokens propuestos

Separar `semantic` de `raw`: pantallas consumen roles, no hexadecimales aislados.

| Token semántico propuesto | Descripción | Estado de decisión |
|---|---|---|
| `surface.canvas`, `surface.card`, `surface.overlay` | Capas de profundidad y contenido | `GENERATED`; mapear a `theme.ts` tras contraste. |
| `text.primary`, `text.secondary`, `text.muted` | Legibilidad relativa comprobable | `GENERATED`; auditar tamaños existentes. |
| `signal.ecu`, `signal.adapter`, `signal.phone`, `signal.derived` | Procedencia sin sustituir etiqueta textual | `GENERATED`; no inventa fuentes. |
| `status.healthy`, `status.attention`, `status.critical`, `status.unknown` | Severidad/evidencia | `GENERATED`; requiere matriz de estados. |
| `action.primary`, `action.destructive`, `focus.visible` | Interacción clara y accesible | `GENERATED`; atención a Stop. |
| `space.1..N`, `radius.card`, `type.value`, `type.body`, `type.label` | Escala coherente y reutilizable | `GENERATED`; no fijar números sin revisar UI. |

**Importante:** mantener `src/styles/theme.ts` como implementación actual hasta que un contrato apruebe migraciones. El documento Stitch es `INSPIRED`, no token source-of-truth del APK. La paleta de una marca no se impone sobre otro producto por analogía; aquí se evalúa la identidad AutoPulse.

### 7.5. Inventario de componentes / proyecciones

| Capacidad de diseño | Fuente presente | Variantes a normalizar |
|---|---|---|
| `SignalCard` | `BaseLiveMetricCard.tsx`, `LiveMetricCard.tsx` | ECU/adapter/phone/derived; live/stale/no-evidence; detalle al estacionar. |
| `DriverModeSelector` | Componente actual | compacto/expandido; screen-reader; fuente ampliada; modo activo. |
| `StartupEvidenceBanner` | `DriverStartupCoordinator.tsx` | esperando RPM, refrigerante no observado, madura, limitada; sin READY ficticio. |
| `LiveStateBanner` | `DriverLiveSessionScreen.tsx` | healthy, degraded, recovering, interrupted, terminal. |
| `SessionSummary` | `SessionSummaryScreen.tsx` | complete/partial/degraded/corrupted; export explícito. |
| `CheckStage / CheckReport` | `CheckScreen.tsx`, `DiagnosticCheckReportScreen.tsx` | incomplete, unsupported, no DTC reported, sealed/verified. |
| `VoiceAndHapticAlert` | Servicios y contratos de voz | EN predeterminado / ES elegible; corto, accionable, con rate limits. |

El inventario es de **capabilities UI candidatas**, no una afirmación de que todos estos componentes ya compartan una API. Priorizar consolidación de estados antes que rediseño estético.

---

## 8. CONTRACT — Diseño para ejecución verificable

Un contrato de diseño debe atravesar, si corresponde:

```text
Presentation → Application → Domain → Persistence → Integration → Validation
```

Solo se construye después de resolver fuentes de datos, arquitectura, alcance, riesgos, rollback y autoridad.

### 8.1. Plantilla obligatoria

```yaml
contract_id: DF-XX
objective: <capacidad concreta>
status: PROPOSED | APPROVED | IMPLEMENTED | VALIDATED | REJECTED
provenance: [OFFICIAL, OBSERVED, INFERRED, INSPIRED, GENERATED]
authority_refs: []
in_scope: []
out_of_scope: []
domain_entities: []
invariants: []
inputs: []
outputs: []
state_changes: []
failure_modes: []
authorization: <quién aprueba y quién ejecuta>
persistence: <qué se almacena / qué NO cambia>
audit: <evidencia verificable>
acceptance: []
rollback: <cómo revertir sin pérdida de datos>
physical_gate: <necesario / no necesario>
```

### 8.2. Contratos propuestos (ninguno aprobado para build)

#### DF-01 — Audit + design-token inventory

**Objetivo:** extraer todos los estilos reales y roles visuales por pantalla, identificar duplicidades y evaluar legibilidad.

**In scope:** inventario en `theme.ts`, `DriverModeSelector`, `DriverStartupCoordinator`, `DriverLiveSessionScreen`, `SessionSummaryScreen`, `CheckScreen` y componentes relacionados; hoja de contraste y propuesta de tokens.  
**Out of scope:** reemplazar paleta, editar UI o tocar adquisición.  
**Invariantes:** ninguna afirmación oficial sin procedencia; preservar identidad del producto.  
**Inputs:** HEAD exacto, screenshots piloto, tamaños de pantalla de prueba.  
**Outputs:** lista `OBSERVED` con ubicación de código y tokens `GENERATED` a revisar.  
**State changes / Persistence:** ninguno.  
**Failure modes:** falta de variante, font scaling no probado, contraste insuficiente.  
**Authorization:** aprobación documental separada de aprobación de implementación.  
**Audit:** tabla archivo/línea/rol/contraste/estatus.  
**Acceptance:** inventario reproducible, sin valores inventados, controversias abiertas visibles.  
**Rollback:** no aplica, es read-only.  
**Physical gate:** no; revisión visual posterior sí.

#### DF-02 — Evidence-first startup messaging

**Objetivo:** representar explícitamente el motivo de espera del arranque sin bloquear Live ni declarar preparación sin evidencia.

**In scope:** contrato de copy/UI para arranque cuando RPM y refrigerante están completos, retrasados, ausentes o no anunciados.  
**Out of scope:** forzar `0105`, cambiar el plan de sondeo, silenciar advertencias críticas, modificar BLE, inventar temperatura o establecer un READY por cronómetro.  
**Invariantes:** `missing coolant ≠ warm engine`; `ECU Live ≠ cold-start assessment complete`; ninguna interacción obligatoria durante conducción.  
**Inputs:** `StartupAssessment`, `ColdStartMaturity`, calidad/frescura de las observaciones existentes.  
**Outputs:** copy corto y estados explicables; cualquier cambio de lógica requerirá un contrato de dominio aparte.  
**State changes / Persistence:** propuesta visual, cero modificación de la sesión en esta fase.  
**Failure modes:** mensaje permanece indefinidamente sin explicación, truncamiento, voz repetitiva, información crítica oculta.  
**Authorization:** revisión del contrato con autoridad Live antes de implementarlo.  
**Audit:** fixtures de ausencia, caducidad, llegada tardía y recuperación.  
**Acceptance:** toda espera tiene motivo inteligible, no hay READY falso, el texto no oculta el estado de Live.  
**Rollback:** revertir componente presentacional manteniendo el contrato de dominio.  
**Physical gate:** sí, en la siguiente candidata instalada.

#### DF-03 — Responsive compact Live slice

**Objetivo:** aplicar una escala tipográfica y jerarquía coherentes a **una** superficie de Live sin alterar fuentes de datos.

**In scope:** tamaño de textos, truncamiento, número visible, orden de las métricas y touch targets del selector / tarjetas elegidas tras DF-01.  
**Out of scope:** migrar toda la app, añadir indicadores OBD, reordenar comandos, rediseñar Check, instalar nueva APK sin autorización.  
**Invariantes:** origen y calidad de cada señal se mantienen; Stop siempre es accesible; no scroll para ver alertas importantes.  
**Inputs:** tokens aprobados, matriz de estados, referencia de pantallas reales.  
**Outputs:** componente migrado, pruebas automatizadas, capturas comparativas.  
**State changes:** solo presentación; sin alteración de dominio o persistencia.  
**Failure modes:** clip, overflow, letras minúsculas, cambios a valores mostrados, frames perdidos por animación.  
**Authorization:** gate de código separado y revisión de diff visual.  
**Audit:** evidencia before/after, capturas y regresión.  
**Acceptance:** screen small/large/font scaling; variantes normal/stale/no-data/critical; rendimiento estable en muestra.  
**Rollback:** commit aislado por componente.  
**Physical gate:** sí para ergonomía en dispositivo real, estacionado.

#### DF-04 — QA visual & observability capture

**Objetivo:** reducir capturas manuales mediante pruebas reproducibles y un solo paquete de evidencia por ejecución.

**In scope:** ADB+scrcpy en Windows, tests/analítica en WSL, grabación, logcat, estado de UI y reporte local anonimizado.  
**Out of scope:** afirmar acceso automático a la laptop desde ChatGPT, fabricar respuestas ECU, compartir datos privados sin consentimiento o exigir una APK por test.  
**Invariantes:** logs e informes no alteran comando ECU ni sesión; secretos y raw/VIN/ruta se excluyen al exportar; emulador/replay no equivale a vehículo real.  
**Inputs:** build instalado, identidad SHA, dispositivo USB, escenarios.  
**Outputs:** ZIP QA con manifiesto, hashes, resultado por escenario, fallos y evidencia mínima.  
**State changes:** ninguno sobre ECU; la prueba puede crear sesiones **solo cuando el operador lo autoriza**.  
**Failure modes:** ADB desconectado, video cortado, falta de permisos, ANR no observable, logs vacíos.  
**Authorization:** usuario prepara laptop y autoriza la prueba, con vehículo estacionado.  
**Audit:** versión herramientas, hash APK, tiempo de captura y cobertura.  
**Acceptance:** corrida repetible sin necesidad de 24 capturas; errores no ocultos; reporte atribuible a APK exacta.  
**Rollback:** detener script; preservar datos locales.  
**Physical gate:** sí para confirmar BLE/ECU.

### 8.3. Regla para cambios con efectos peligrosos

Cuando un cambio pueda afectar conducción, datos persistidos, permisos o interacción con vehículo:

```text
OBSERVE → SUGGEST → EXPLAIN → HUMAN APPROVAL → EXECUTE → AUDIT
```

Ningún agente de IA adquiere autoridad para ejecutar comandos ECU o declarar seguridad automotriz por el solo hecho de producir un diseño o recomendación.

---

## 9. Validación: qué significa «BIEN»

**Estabilidad operativa** es distinta de **exactitud funcional** y de **certificación física**.

| Eje | Evidencia requerida | Ejemplo de límite |
|---|---|---|
| `STABILITY` | 0 crashes/ANR observados en una ventana definida, acciones sin cuelgue, recuperación acotada | Un minuto estable no prueba 60 minutos. |
| `CORRECTNESS` | valores y unidades concordantes entre ECU/decode/SQLite/Summary/JSON | 80 `SUCCESS` con 0 valores puede ser bug de atribución. |
| `USABILITY` | lectura, interacción, accesibilidad y estados comprendidos en dispositivo | Tests unitarios no prueban fuentes legibles en Android. |
| `INTEGRITY` | bloques completos/CRC/contadores/secuencia y cierre recuperable | Check COMPLETE no certifica todas las ECU. |
| `SAFETY` | ninguna acción peligrosa ni información tranquilizadora infundada | No emitir `HEALTHY` por datos ausentes. |
| `PROVENANCE` | SHA APK, versión, sesión, build, tipo de entorno, evidencia | Replay no es observación física. |

### Puertas de validación

`D0 DOCUMENTED` → diseño con conflictos y procedencias reconocidos.  
`D1 CONTRACT APPROVED` → criterios, invariantes y rollback cerrados.  
`D2 CODE VERIFIED` → TypeScript, Jest, replay/integración y diff revisados.  
`D3 UI OBSERVED` → emulador/Android real, capturas/video y accesibilidad.  
`D4 PHYSICAL PILOT` → vehículo + ELM, adquisición real, recuperaciones, TTS y logs.  
`D5 PUBLIC RELEASE` → gates de seguridad, firma no-debug, release authority.

Ningún gate sustituye al siguiente. Nunca pasar de `D2` a `D4` por una captura bonita o 722 tests verdes.

**Para el actual ROAD TEST-001:** la corrección MK10.5.1 pasó CI en `b2c801...`, pero sigue sin APK correspondiente ni validación física. Esta documentación no cambia ese estado.

---

## 10. Plantillas operativas para próximas sesiones

### 10.1. GALACTIC SESSION

```markdown
# GALACTIC SESSION — <tema> / <fecha>
Question: ¿qué podría hacer AutoPulse que sería útil?
Boundary: exploración; NO implementación.
Dimensions: ENTITY × PERSPECTIVE × ACTION × TIME × INTERFACE × ACTOR × CONTEXT
Use cases: G-XX ... (muchos, diversos, con casos adversos)
Universal questions: identidad / tiempo / evidencia / ausencia / impacto / futuro
Emerging patterns:
Possible primitives:
Unknowns (no resolver por intuición):
Deferred inspirations:
```

### 10.2. CAPABILITY MAP + GRAVITY REVIEW

```markdown
# GRAVITY REVIEW — <tema>
Capability / Primitives / Domains:
Reality: EXISTS | PARTIAL | WEAK | MISSING | EXPERIMENTAL | EXTERNAL
Provenance + exact source:
Evidence maturity: TESTED_UNIT | TESTED_EMULATOR | OBSERVED_PHYSICAL | UNVERIFIED
Gap to target:
Value: user / risk / frequency / differentiation
Cost: build / maintain / UX / external dependency
Decision: NOW | NEXT | LATER | REJECTED | DEPENDENT
Alternatives + contradictions:
Authority decision:
```

### 10.3. CONTRACT + ACCEPTANCE REPORT

```markdown
# CONTRACT DF-XX
Objective:
In scope / Out of scope:
Domain / Invariants:
Inputs / Outputs / State changes:
Failure modes / Authorization:
Persistence / Audit / Rollback:
Acceptance scenarios: [normal, missing, stale, fail, recovery, accessibility]
Expected artifacts:
GO / HOLD / PIVOT / KILL:

# ACCEPTANCE DF-XX
Target commit SHA / APK SHA:
Environment: CI | emulator | physical Android | ECU vehicle
Executed scenarios / Result / Evidence links:
Known gaps / Regressions:
Final classification: PASS | PARTIAL | FAIL | NOT_EXECUTED
Signer / reviewer / next gate:
```

### 10.4. ADR / decisiones difíciles de revertir

Toda decisión sobre colores oficiales, estado de la sesión, calidad de datos, unidad visual, origen de telemetría, accesibilidad o política de captura debe anotar:

`Context → Alternatives → Evidence → Decision → Consequences → Supersedes → Validation`.

---

## 11. Freeze documental y siguiente contrato

### Checklist para promover este framework a autoridad vigente

- [ ] Revisión por usuario del encuadre GALACTIC→GRAVITY→CONTRACT.
- [ ] Resolver precedencia frente a Design Authority y V1 Release Authority sin contradicciones.
- [ ] Inventario completo de estilos/superficies y semántica `OBSERVED` vs `GENERATED`.
- [ ] Aprobación formal de tokens por roles, contrastes y escalado.
- [ ] Flujos de error, espera, ausencia, recuperación, Check limitado y Stop definidos.
- [ ] Seleccionar un único vertical slice de migración reversible.
- [ ] Matriz de pruebas visuales y accesibilidad con evidencia suficiente.
- [ ] No planificar una APK solo por modificación documental; build requiere gate propio.

**Próximo paso recomendado:** ejecutar **DF-01 como auditoría documental read-only** y elaborar una matriz verificable de todos los estilos reales, antes de editar `theme.ts`. Paralelamente, definir la semántica de `STARTUP` con DF-02, sin mutar el plan OBD hasta contar con evidencia suficiente.

**Regla final:** AutoPulse puede aspirar a experiencias de alcance galáctico; cada pieza construida debe proteger lo que ya funciona, ser compatible con su verdad de dominio y demostrar que funciona **BIEN** antes de llegar al APK.