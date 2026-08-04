import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = '@autopulse_telemetry';
const VIRTUAL_ODO_KEY = '@autopulse_odometer';
const PARKING_LOCATION_KEY = '@autopulse_parking';
const BATTERY_HEALTH_KEY = '@autopulse_battery';
const TRIPS_HISTORY_KEY = '@autopulse_trips';

// For MVP, hardcode gas price. In a real app this would be a setting.
const GAS_PRICE_PER_LITER = 1.20;

export class LocalStore {
  async saveTelemetry(vehicleId: string, data: any) {
    try {
      const existingStr = await AsyncStorage.getItem(STORE_KEY);
      let records = existingStr ? JSON.parse(existingStr) : [];

      const newRecord = {
        ...data,
        timestamp: new Date().toISOString(),
        vehicleId
      };

      records.unshift(newRecord);
      if (records.length > 500) records = records.slice(0, 500);

      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(records));
      return newRecord;
    } catch (e) {
      console.error('Failed to save telemetry locally', e);
    }
  }

  async addDistance(meters: number) {
    try {
      const current = await AsyncStorage.getItem(VIRTUAL_ODO_KEY);
      const odo = current ? parseFloat(current) : 0;
      await AsyncStorage.setItem(VIRTUAL_ODO_KEY, (odo + meters).toString());
    } catch (e) { }
  }

  async saveParkingLocation(lat: number, lng: number) {
    try {
      await AsyncStorage.setItem(PARKING_LOCATION_KEY, JSON.stringify({ lat, lng, time: Date.now() }));
    } catch (e) { }
  }

  async saveBatteryHealth(voltage: number) {
    try {
      await AsyncStorage.setItem(BATTERY_HEALTH_KEY, voltage.toString());
    } catch (e) { }
  }

  async getInsights(vehicleId: string) {
    try {
      const [telemetryStr, odoStr, parkingStr, batteryStr] = await Promise.all([
        AsyncStorage.getItem(STORE_KEY),
        AsyncStorage.getItem(VIRTUAL_ODO_KEY),
        AsyncStorage.getItem(PARKING_LOCATION_KEY),
        AsyncStorage.getItem(BATTERY_HEALTH_KEY)
      ]);

      const records = telemetryStr ? JSON.parse(telemetryStr).filter((r: any) => r.vehicleId === vehicleId) : [];
      const virtualOdometerKm = (odoStr ? parseFloat(odoStr) : 0) / 1000;
      const parking = parkingStr ? JSON.parse(parkingStr) : null;
      const batteryVoltage = batteryStr ? parseFloat(batteryStr) : null;

      // Fuel Calculation: MAF (g/s) to Liters/Hour -> Liters consumed.
      // Formula approx: (MAF / 14.7 / 730) * 3600 = L/h.
      // For this session, we will estimate fuel cost simply based on average MAF over total session time.
      // We'll calculate total cost of fuel consumed during this session:
      let totalLiters = 0;
      records.forEach((r: any) => {
        if (r.maf) {
          // Assume 2 seconds per record (polling interval)
          const litersPerSecond = (r.maf / 14.7 / 730);
          totalLiters += (litersPerSecond * 2);
        }
      });
      const fuelCost = totalLiters * GAS_PRICE_PER_LITER;

      const hardBrakes = records.filter((r: any) => r.hard_braking).length;

      return {
        virtual_odometer_km: virtualOdometerKm,
        hard_brakes: hardBrakes,
        fuel_cost: fuelCost,
        parking_location: parking,
        battery_voltage: batteryVoltage,
        total_records: records.length,
      };
    } catch (e) {
      console.error('Failed to get insights', e);
      return null;
    }
  }

  async clearData() {
    await AsyncStorage.multiRemove([STORE_KEY, VIRTUAL_ODO_KEY, PARKING_LOCATION_KEY, BATTERY_HEALTH_KEY, TRIPS_HISTORY_KEY]);
  }

  async saveTrip(trip: any) {
    try {
      const existingStr = await AsyncStorage.getItem(TRIPS_HISTORY_KEY);
      let trips = existingStr ? JSON.parse(existingStr) : [];
      trips.unshift({ ...trip, id: Date.now(), date: new Date().toLocaleDateString() });
      if (trips.length > 50) trips = trips.slice(0, 50);
      await AsyncStorage.setItem(TRIPS_HISTORY_KEY, JSON.stringify(trips));
    } catch (e) { }
  }

  async getTrips() {
    try {
      const str = await AsyncStorage.getItem(TRIPS_HISTORY_KEY);
      return str ? JSON.parse(str) : [];
    } catch (e) { return []; }
  }


  async saveWebhookUrl(url: string): Promise<void> {
    await AsyncStorage.setItem('webhook_url', url);
  }

  async getWebhookUrl(): Promise<string | null> {
    return await AsyncStorage.getItem('webhook_url');
  }
}

export const localStore = new LocalStore();
