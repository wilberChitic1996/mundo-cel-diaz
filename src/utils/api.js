// src/utils/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Token JWT en cada request
api.interceptors.request.use(function(config) {
  var session = getLocalSession();
  if (session && session.token) {
    config.headers['Authorization'] = 'Bearer ' + session.token;
  }
  return config;
});

// Manejar respuestas
api.interceptors.response.use(
  function(response) { return response.data; },
  function(error) {
    var msg = error.response ? error.response.data : { error: 'Error de conexion' };
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
    var data = await api.post('/auth/login', { email, password });
    saveLocalSession(data);
    return data;
  },
  logout: function() { clearLocalSession(); },
  getSession: getLocalSession,

  // ── Recuperación de contraseña (endpoints públicos, sin JWT) ──
  findUser:      function(email)                      { return api.post('/auth/find-user', { email }); },
  verifyAnswer:  function(email, answer)              { return api.post('/auth/verify-answer', { email, answer }); },
  resetPassword: function(email, answer, newPassword) { return api.post('/auth/reset-password', { email, answer, newPassword }); },
};

// ── Productos ─────────────────────────────────────────
export const productsAPI = {
  getAll:       function(cfg)   { return api.get('/products', cfg); },
  create:       function(data)  { return api.post('/products', data); },
  update:       function(id, d) { return api.put('/products/' + id, d); },
  remove:       function(id)    { return api.delete('/products/' + id); },
  priceHistory: function(id)    { return api.get('/products/' + id + '/price-history'); },
};

// ── Ventas ────────────────────────────────────────────
export const salesAPI = {
  getAll:  function(cfg)  { return api.get('/sales', cfg); },
  create:  function(data) { return api.post('/sales', data); },
};

// ── Cuentas ───────────────────────────────────────────
export const accountsAPI = {
  getAll:     function(cfg)      { return api.get('/accounts', cfg); },
  create:     function(data)     { return api.post('/accounts', data); },
  addPayment: function(id, data) { return api.post('/accounts/' + id + '/payments', data); },
};

// ── Devoluciones ──────────────────────────────────────
export const returnsAPI = {
  getAll: function(cfg)  { return api.get('/returns', cfg); },
  create: function(data) { return api.post('/returns', data); },
};

// ── Piezas Defectuosas ────────────────────────────────
export const defectivesAPI = {
  getAll:  function(cfg)        { return api.get('/defectives', cfg); },
  update:  function(id, status) { return api.put('/defectives/' + id, { status }); },
};

// ── Usuarios ──────────────────────────────────────────
export const usersAPI = {
  getAll:  function()      { return api.get('/users'); },
  create:  function(data)  { return api.post('/users', data); },
  update:  function(id, d) { return api.put('/users/' + id, d); },
};

// ── Clientes ──────────────────────────────────────────
export const clientsAPI = {
  getAll:  function(cfg)   { return api.get('/clients', cfg); },
  create:  function(data)  { return api.post('/clients', data); },
  update:  function(id, d) { return api.put('/clients/' + id, d); },
  remove:  function(id)    { return api.delete('/clients/' + id); },
};

// ── Reparaciones ──────────────────────────────────────
export const repairsAPI = {
  getAll:       function(cfg)         { return api.get('/repairs', cfg); },
  create:       function(data)        { return api.post('/repairs', data); },
  updateStatus: function(id, status)  { return api.put('/repairs/' + id + '/status', { status }); },
  update:       function(id, data)    { return api.put('/repairs/' + id, data); },
  remove:       function(id)          { return api.delete('/repairs/' + id); },
};

// ── Garantías ─────────────────────────────────────────
export const warrantiesAPI = {
  getAll:  function(cfg)   { return api.get('/warranties', cfg); },
  create:  function(data)  { return api.post('/warranties', data); },
  update:  function(id, d) { return api.put('/warranties/' + id, d); },
};

// ── Auditoría ─────────────────────────────────────────
export const auditAPI = {
  getAll: function(params) {
    var qs = params ? ('?' + Object.keys(params).filter(function(k){ return params[k]; }).map(function(k){ return k + '=' + encodeURIComponent(params[k]); }).join('&')) : '';
    return api.get('/audit' + qs);
  },
};

// ── Proveedores y Compras ─────────────────────────────
export const suppliersAPI = {
  getAll:          function(cfg)   { return api.get('/suppliers', cfg); },
  create:          function(data)  { return api.post('/suppliers', data); },
  update:          function(id, d) { return api.put('/suppliers/' + id, d); },
  getPurchases:    function(cfg)   { return api.get('/suppliers/purchases', cfg); },
  createPurchase:  function(data)  { return api.post('/suppliers/purchases', data); },
};

// ── Configuración de tienda ───────────────────────────
export const settingsAPI = {
  getAll: function()     { return api.get('/settings'); },
  update: function(data) { return api.put('/settings', data); },
};

// ── Caja ──────────────────────────────────────────────
export const cajaAPI = {
  getSesiones:   function()          { return api.get('/caja/sesiones'); },
  getSesionActiva: function()        { return api.get('/caja/sesiones/activa'); },
  abrir:         function(data)      { return api.post('/caja/abrir', data); },
  cerrar:        function(id, data)  { return api.post('/caja/cerrar/' + id, data); },
  getGastos:     function(sesionId)  { return api.get('/caja/gastos' + (sesionId ? '?sesion_id=' + sesionId : '')); },
  crearGasto:    function(data)      { return api.post('/caja/gastos', data); },
  eliminarGasto: function(id)        { return api.delete('/caja/gastos/' + id); },
};

// ── Panel Super Admin ─────────────────────────────────
export const adminAPI = {
  getTenants:          function()          { return api.get('/admin/tenants'); },
  createTenant:        function(data)      { return api.post('/admin/tenants', data); },
  updateTenant:        function(id, data)  { return api.put('/admin/tenants/' + id, data); },
  getStats:            function()          { return api.get('/admin/stats'); },
  getSubscription:     function()          { return api.get('/admin/subscription'); },
  init:                function(data)      { return api.post('/admin/init', data); },
  getTenantUsers:      function(id)        { return api.get('/admin/tenants/' + id + '/users'); },
  resetUserPassword:   function(id, data)  { return api.put('/admin/users/' + id + '/reset-password', data); },
  toggleUser:          function(id)        { return api.put('/admin/users/' + id + '/toggle', {}); },
  updateMe:            function(data)      { return api.put('/admin/me', data); },
  deleteTenant:        function(id)        { return api.delete('/admin/tenants/' + id); },
  createTenantUser:    function(id, data)  { return api.post('/admin/tenants/' + id + '/users', data); },
  deleteUser:          function(id)        { return api.delete('/admin/users/' + id); },
};

// ── Health check ──────────────────────────────────────
export const checkAPI = async function() {
  try {
    var baseUrl = API_URL.replace('/api', '');
    var res = await fetch(baseUrl + '/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
};

export default api;
