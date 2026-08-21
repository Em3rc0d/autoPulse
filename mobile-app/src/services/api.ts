import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cloud services are outside the local-first Release-1 path. Development may
// opt in explicitly; production never ships a private-IP/cleartext endpoint.
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '';

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
