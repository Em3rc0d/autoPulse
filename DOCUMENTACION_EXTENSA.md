# AutoPulse - Documentación Técnica Extensa y Visual 🚗⚡

Este documento describe detalladamente la arquitectura, flujo de datos y componentes internos de la plataforma **AutoPulse**.

---

## 1. Arquitectura General del Sistema

El sistema está dividido en tres actores principales:
1. **Vehículo (ECU)** + Adaptador Bluetooth (ELM327)
2. **Aplicación Móvil (React Native)** - Actúa como puente y procesador primario.
3. **Backend y Web (Python + Next.js)** - Almacenamiento, Machine Learning, y visualización global.

```mermaid
graph TD
    subgraph Vehículo
        ECU[Unidad de Control ECU]
        OBD2[Puerto OBD-II]
        ELM[Adaptador ELM327 Bluetooth]
        ECU --> OBD2 --> ELM
    end

    subgraph Aplicación Móvil React Native
        BT_SRV[bluetoothOBD.ts]
        LOCAL_DB[(AsyncStorage)]
        HOOK[useOBDPolling]
        API_CLIENT[api.ts HTTP Client]
        
        ELM <-->|Bluetooth Serial| BT_SRV
        BT_SRV --> HOOK
        HOOK --> LOCAL_DB
        HOOK --> API_CLIENT
    end

    subgraph Backend FastAPI
        API_ROUTE[Rutas API REST]
        WS_ROUTE[WebSocket Server]
        ML[Isolation Forest ML]
        MONGO[(MongoDB)]
        
        API_CLIENT -->|POST /ingest| API_ROUTE
        API_ROUTE --> MONGO
        API_ROUTE <--> ML
        API_ROUTE --> WS_ROUTE
    end

    subgraph Web Dashboard
        NEXTJS[Next.js App]
        CHART[Gráficas en Tiempo Real]
        
        WS_ROUTE -->|Broadcast WS| NEXTJS
        NEXTJS --> CHART
    end
```

---

## 2. Flujo de Secuencia (Ingesta de Telemetría)

¿Cómo viaja la información desde el motor hasta el dashboard web en tiempo real?

```mermaid
sequenceDiagram
    participant Auto as Auto (ECU)
    participant App as App Móvil (Polling)
    participant API as FastAPI Backend
    participant ML as Modelo ML
    participant Web as Web Dashboard

    loop Cada 2 segundos
        App->>Auto: Enviar PID (ej. 010C para RPM)
        Auto-->>App: Respuesta Hex (ej. 41 0C 1A F8)
        App->>App: Parseo Matemático (RPM = 1726)
        App->>App: Guardar en LocalStore
        App->>API: HTTP POST /telemetry/ingest (Data JSON)
        
        API->>ML: predict(telemetry_data)
        ML-->>API: Resultado de Anomalía (true/false)
        
        API->>API: Guardar en MongoDB
        
        API->>Web: WebSocket Broadcast (Data + Anomalía)
        Web->>Web: Actualizar Gráficas UI
        
        API-->>App: HTTP 200 OK (Alertas + Estado ML)
    end
```

---

## 3. Modelo de Datos (Base de Datos)

Aunque MongoDB es NoSQL, internamente manejamos los siguientes modelos estructurados con `Pydantic` en el backend:

```mermaid
erDiagram
    USUARIO ||--o{ VEHICULO : "posee"
    VEHICULO ||--o{ TELEMETRIA : "genera"

    USUARIO {
        string id PK
        string username
        string email
        string hashed_password
        boolean is_active
    }

    VEHICULO {
        string vehicle_id PK
        string name
        string make
        string model
        int year
        string fuel_type
        string owner_id FK
        datetime created_at
    }

    TELEMETRIA {
        string id PK
        string vehicle_id FK
        datetime timestamp
        float rpm
        float speed
        float coolant_temp
        float engine_load
        float throttle_pos
        float maf
        string[] dtc_codes
    }
```

---

## 4. Lógica de Detección Automática de Viajes (Trip Detection)

La aplicación móvil no requiere que el usuario presione "Iniciar Viaje". Utiliza una máquina de estados basada en las RPM del motor:

```mermaid
stateDiagram-v2
    [*] --> MotorApagado
    
    MotorApagado --> ViajeActivo : RPM > 400 detectado
    
    state ViajeActivo {
        [*] --> LeyendoTelemetria
        LeyendoTelemetria --> CalculandoDeltas : Analizar Freno/Aceleración
        CalculandoDeltas --> Transmitiendo : Enviar a Backend
        Transmitiendo --> LeyendoTelemetria : Esperar 2 seg
    }
    
    ViajeActivo --> ConfirmandoParada : RPM < 50
    ConfirmandoParada --> ViajeActivo : RPM sube nuevamente
    ConfirmandoParada --> MotorApagado : RPM < 50 durante 3 ciclos (6 segs)
    
    MotorApagado --> CalculandoResumen : Generar Resumen Viaje
    CalculandoResumen --> [*]
```

---

## 5. Machine Learning - Isolation Forest

En lugar de usar alertas estáticas rígidas (ej. "RPM > 5000 = peligro"), el backend utiliza `Isolation Forest` de `Scikit-Learn`.

```mermaid
flowchart LR
    A[Datos Históricos\n(1 semana min)] -->|Entrenamiento| B(Isolation Forest)
    B --> C{Modelo Entrenado}
    
    D[Nueva Lectura OBD] --> C
    C -->|Puntaje Anomalía < 0| E[Alerta: Comportamiento Atípico]
    C -->|Puntaje Anomalía > 0| F[Operación Normal]
```

El algoritmo traza los puntos de la telemetría en un plano multidimensional. Si una lectura es fácil de "aislar" del resto del conjunto (ej. alta temperatura combinada con alta carga del motor a muy baja velocidad), el modelo la clasifica como una anomalía.

---

## 6. Estado Pendiente a Implementar

Para llegar a este nivel de automatización, aún se requieren implementar las siguientes fases técnicas (Deuda Técnica actual):

1. **API Client (`api.ts`)**: Crear el puente HTTP en React Native.
2. **Auth Flows**: Autenticación en la App (Login/Registro).
3. **Dashboard Web**: Programar los dashboards y gráficas usando WebSockets en Next.js.
4. **Infraestructura**: Desplegar la base de datos (MongoDB) y el entorno en FastAPI.
