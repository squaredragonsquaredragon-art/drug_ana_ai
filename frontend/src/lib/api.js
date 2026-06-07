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

/**
 * Safely extracts a human-readable error message from any API error.
 * Handles Pydantic v2 validation errors (detail is an array of objects)
 * as well as plain string details and generic errors.
 */
export const extractErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  // Pydantic v2 returns an array of validation error objects
  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        const field = Array.isArray(err.loc) ? err.loc.filter((l) => l !== "body").join(" → ") : "";
        const msg = err.msg || "Invalid value";
        return field ? `${field}: ${msg}` : msg;
      })
      .join(" | ");
  }
  // Plain string or other types
  if (typeof detail === "string") return detail;
  return fallback;
};

export const apiRequest = async ({ method = "get", url, data, token, params }) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await apiClient.request({ method, url, data, params, headers });
  return response.data;
};