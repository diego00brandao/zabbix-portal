import axios from 'axios';

const api = axios.create({ baseURL: '/' });

api.interceptors.request.use(config => {
  try {
    const conn = JSON.parse(localStorage.getItem('selectedConnection'));
    if (conn?.id) config.headers['X-Connection-Id'] = conn.id;
  } catch {}
  return config;
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      const isLoginRoute = err.config?.url?.includes('/auth/login');
      if (!isLoginRoute) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;