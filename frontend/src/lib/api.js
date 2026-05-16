import axios from "axios";

export const API_BASE = `${import.meta.env.VITE_BACKEND_URL || ""}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE,
});

// Production-grade interceptor for automatic token injection
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("meditrack_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("meditrack_token", token);
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem("meditrack_token");
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export const apiRequest = async ({ method = "get", url, data, token, params }) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await apiClient.request({ method, url, data, params, headers });
  return response.data;
};