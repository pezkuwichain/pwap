import axios, {AxiosError, InternalAxiosRequestConfig} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://bereketli.pezkiwi.app/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage keys
const TOKEN_KEY = '@bereketli_access_token';
const REFRESH_KEY = '@bereketli_refresh_token';

export async function saveTokens(access: string, refresh: string) {
  await AsyncStorage.setItem(TOKEN_KEY, access);
  await AsyncStorage.setItem(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

// Request interceptor: token ekle
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: 401 → token refresh → retry
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

client.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {_retry?: boolean};

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Baska bir refresh zaten calisiyor — kuyruge ekle
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const {access_token, refresh_token} = response.data;
        await saveTokens(access_token, refresh_token);

        // Kuyruktekileri coz
        refreshQueue.forEach(({resolve}) => resolve(access_token));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return client(originalRequest);
      } catch (refreshError) {
        refreshQueue.forEach(({reject}) => reject(refreshError));
        refreshQueue = [];
        await clearTokens();
        // TODO: navigate to login screen
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default client;
