from app.models.telemetry import TelemetryData

THRESHOLDS = {
    "coolant_temp":   {"warning": 95,   "critical": 105},
    "rpm":            {"warning": 5500, "critical": 6500},
    "battery_voltage":{"warning": 11.8, "critical": 11.0},
    "engine_load":    {"warning": 85,   "critical": 95},
}

def check_alerts(data: TelemetryData) -> list[dict]:
    alerts = []

    if data.coolant_temp:
        t = data.coolant_temp
        if t >= THRESHOLDS["coolant_temp"]["critical"]:
            alerts.append({"type": "CRITICAL", "field": "coolant_temp",
                           "message": f"🔴 Motor sobrecalentado: {t}°C", "value": t})
        elif t >= THRESHOLDS["coolant_temp"]["warning"]:
            alerts.append({"type": "WARNING", "field": "coolant_temp",
                           "message": f"🟡 Temperatura alta: {t}°C", "value": t})

    if data.rpm:
        r = data.rpm
        if r >= THRESHOLDS["rpm"]["critical"]:
            alerts.append({"type": "CRITICAL", "field": "rpm",
                           "message": f"🔴 RPM peligroso: {r}", "value": r})
        elif r >= THRESHOLDS["rpm"]["warning"]:
            alerts.append({"type": "WARNING", "field": "rpm",
                           "message": f"🟡 RPM alto: {r}", "value": r})

    if data.battery_voltage:
        v = data.battery_voltage
        if v <= THRESHOLDS["battery_voltage"]["critical"]:
            alerts.append({"type": "CRITICAL", "field": "battery_voltage",
                           "message": f"🔴 Batería crítica: {v}V", "value": v})
        elif v <= THRESHOLDS["battery_voltage"]["warning"]:
            alerts.append({"type": "WARNING", "field": "battery_voltage",
                           "message": f"🟡 Batería baja: {v}V", "value": v})

    if data.dtc_codes:
        alerts.append({"type": "DTC", "field": "dtc_codes",
                       "message": f"⚠️ Códigos de error: {', '.join(data.dtc_codes)}",
                       "value": data.dtc_codes})

    return alerts
