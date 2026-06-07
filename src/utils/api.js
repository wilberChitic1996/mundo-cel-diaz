// src/utils/api.js
import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' }
});

// Agregar token JWT a cada request
api.interceptors.request.use(function(config) {
  const session = getLocalSession();
  if (session && session.token) {
    config.headers['Authorization'] = 'Bearer ' + session.token;
  }
  return config;
});

// Manejar respuestas — NO recargar en 401, solo rechazar la promesa
api.interceptors.response.use(
  function(response) { return response.data; },
  function(error) {
    const msg = error.response ? error.response.data : { error: 'Error de conexion' };
    return Promise.reject(msg);
  }
);

function getLocalSession() {
  try { return JSON.parse(sessionStorage.getItem('mnpos-api-session') || 'null'); }
  catch { return null; }
}
function saveLocalSession(data) {
  sessionStorage.setItem('mnpos-api-session', JSON.stringify(data));
}
function clearLocalSession() {
  sessionStorage.removeItem('mnpos-api-session');
}

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: async function(email, password) {
    const data = await api.post('/auth/login', { email, password });
    saveLocalSession(data);
    return data;
  },
  logout: function() { clearLocalSession(); },
  getSession: getLocalSession,
};

// ── Productos ─────────────────────────────────────────
export const productsAPI = {
  getAll:  function()      { return api.get('/products'); },
  create:  function(data)  { return api.post('/products', data); },
  update:  function(id, d) { return api.put('/products/' + id, d); },
  remove:  function(id)    { return api.delete('/products/' + id); },
};

// ── Ventas ────────────────────────────────────────────
export const salesAPI = {
  getAll:  function()     { return api.get('/sales'); },
  create:  function(data) { return api.post('/sales', data); },
};

// ── Cuentas ───────────────────────────────────────────
export const accountsAPI = {
  getAll:     function()         { return api.get('/accounts'); },
  create:     function(data)     { return api.post('/accounts', data); },
  addPayment: function(id, data) { return api.post('/accounts/' + id + '/payments', data); },
};

// ── Usuarios ──────────────────────────────────────────
export const usersAPI = {
  getAll:  function()      { return api.get('/users'); },
  create:  function(data)  { return api.post('/users', data); },
  update:  function(id, d) { return api.put('/users/' + id, d); },
};

// ── Health check ──────────────────────────────────────
export const checkAPI = async function() {
  try {
    const res = await fetch('http://localhost:4000/health', {
      signal: AbortSignal.timeout(3000)
    });
    return res.ok;
  } catch { return false; }
};

export default api;
