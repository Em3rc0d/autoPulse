import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// El usuario solicitó 0.0.0.0. Nota: Si pruebas en un dispositivo físico real conectado por WiFi,
// deberás cambiar esto por la IP local de tu PC (ej. 192.168.1.X).
// Para emuladores Android, usa 10.0.2.2.
export const BASE_URL = 'http://10.224.244.55:8000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('@autopulse_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (credentials: any) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (data: any) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  }
};

export const telemetryAPI = {
  ingest: async (data: any) => {
    const res = await api.post('/telemetry/ingest', data);
    return res.data;
  }
};

export const vehiclesAPI = {
  get: async (vehicleId: string) => {
    const res = await api.get(`/vehicles/${vehicleId}`);
    return res.data;
  }
};
