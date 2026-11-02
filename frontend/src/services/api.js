import axios from "axios";

let accessToken = null;
let authFailureHandler = null;
let refreshPromise = null;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
});

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const onAuthFailure = (handler) => {
  authFailureHandler = handler;
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register")
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/auth/refresh`,
              {},
              { withCredentials: true }
            )
            .then((res) => {
              const newToken = res.data?.data?.accessToken;
              setAccessToken(newToken);
              return newToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const token = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        if (authFailureHandler) {
          authFailureHandler();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
