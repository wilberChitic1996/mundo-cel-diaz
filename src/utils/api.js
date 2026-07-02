// src/utils/api.js
import axios from 'axios';

// ── URL del API — MISMO dominio (proxy de Vercel) ─────────────────
// En producción y staging el frontend llama al API por su PROPIO dominio (/api),
// y Vercel lo reenvía internamente a Railway (ver "rewrites" en vercel.json — cada
// ambiente/rama reenvía a SU Railway). Así el navegador NO hace peticiones "cruzadas"
// (cross-origin) → sin preflight CORS. Motivo: algunas redes/ISP cuelgan el preflight
// (OPTIONS) hacia el dominio de Railway y el login quedaba en "Sin conexión al servidor".
// En local se usa el API de desarrollo directo.
function resolveApiUrl() {
  if (typeof window !== 'undefined' && window.location) {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4000/api';
    return '/api';
  }
  return 'http://localhost:4000/api';
}

const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: API_URL,
  // 30s: tolera lentitud del servidor (ej. incidentes de Railway o arranque en frío).
  // Antes eran 10s y en un bajón las cargas se cortaban y la app mostraba todo en cero.
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(function(config) {
  var session = getLocalSession();
  if (session && session.token) {
    config.headers['Authorization'] = 'Bearer ' + session.token;
  }
  return config;
});

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

export const authAPI = {
  login: async function(email, password) {
    var data = await api.post('/auth/login', { email, password });
    saveLocalSession(data);
    return data;
  },
  logout: function(refreshToken) {
    clearLocalSession();
    if (refreshToken) return api.post('/auth/logout', { refreshToken }).catch(function() {});
  },
  refresh: function(refreshToken)                     { return api.post('/auth/refresh', { refreshToken }); },
  getSession: getLocalSession,
  verify2fa:     function(email, code)                { return api.post('/auth/verify-2fa', { email, code }); },
  findUser:      function(email)                      { return api.post('/auth/find-user', { email }); },
  verifyAnswer:  function(email, answer)              { return api.post('/auth/verify-answer', { email, answer }); },
  resetPassword: function(resetToken, newPassword) { return api.post('/auth/reset-password', { resetToken, newPassword }); },
};

// Verificación pública de comprobantes (sin autenticación — la usa la página /?verify=)
export const publicAPI = {
  verify: function(saleId) { return api.get('/public/verify/' + encodeURIComponent(saleId)); },
};

export const productsAPI = {
  getAll:       function(cfg)   { return api.get('/products', cfg); },
  create:       function(data)  { return api.post('/products', data); },
  update:       function(id, d) { return api.put('/products/' + id, d); },
  remove:       function(id)    { return api.delete('/products/' + id); },
  priceHistory:  function(id)         { return api.get('/products/' + id + '/price-history'); },
  adjustStock:   function(id, data)   { return api.post('/products/' + id + '/adjust-stock', data); },
  stockHistory:  function(id)         { return api.get('/products/' + id + '/stock-history'); },
};

export const salesAPI = {
  getAll:  function(cfg)  { return api.get('/sales', cfg); },
  create:  function(data) { return api.post('/sales', data); },
};

export const accountsAPI = {
  getAll:     function(cfg)      { return api.get('/accounts', cfg); },
  create:     function(data)     { return api.post('/accounts', data); },
  addPayment: function(id, data) { return api.post('/accounts/' + id + '/payments', data); },
};

export const returnsAPI = {
  getAll: function(cfg)  { return api.get('/returns', cfg); },
  create: function(data) { return api.post('/returns', data); },
};

export const defectivesAPI = {
  getAll:  function(cfg)        { return api.get('/defectives', cfg); },
  update:  function(id, status) { return api.put('/defectives/' + id, { status }); },
};

export const usersAPI = {
  getAll:  function(cfg)   { return api.get('/users', cfg); },
  create:  function(data)  { return api.post('/users', data); },
  update:  function(id, d) { return api.put('/users/' + id, d); },
};

export const clientsAPI = {
  getAll:  function(cfg)   { return api.get('/clients', cfg); },
  create:  function(data)  { return api.post('/clients', data); },
  update:  function(id, d) { return api.put('/clients/' + id, d); },
  remove:  function(id)    { return api.delete('/clients/' + id); },
};

export const repairsAPI = {
  getAll:       function(cfg)         { return api.get('/repairs', cfg); },
  create:       function(data)        { return api.post('/repairs', data); },
  updateStatus: function(id, status)  { return api.put('/repairs/' + id + '/status', { status }); },
  update:       function(id, data)    { return api.put('/repairs/' + id, data); },
  remove:       function(id)          { return api.delete('/repairs/' + id); },
  uploadPhoto:  function(id, data)    { return api.post('/repairs/' + id + '/photos', data); },
  deletePhoto:  function(id, data)    { return api.delete('/repairs/' + id + '/photos', { data }); },
};

export const warrantiesAPI = {
  getAll:  function(cfg)   { return api.get('/warranties', cfg); },
  create:  function(data)  { return api.post('/warranties', data); },
  update:  function(id, d) { return api.put('/warranties/' + id, d); },
};

export const auditAPI = {
  getAll: function(params) {
    var qs = params ? ('?' + Object.keys(params).filter(function(k){ return params[k]; }).map(function(k){ return k + '=' + encodeURIComponent(params[k]); }).join('&')) : '';
    return api.get('/audit' + qs);
  },
};

export const suppliersAPI = {
  getAll:          function(cfg)   { return api.get('/suppliers', cfg); },
  create:          function(data)  { return api.post('/suppliers', data); },
  update:          function(id, d) { return api.put('/suppliers/' + id, d); },
  getPurchases:    function(cfg)   { return api.get('/suppliers/purchases', cfg); },
  createPurchase:  function(data)  { return api.post('/suppliers/purchases', data); },
};

// ── Categorías ────────────────────────────────────────
export const categoriesAPI = {
  getAll: function(cfg)   { return api.get('/categories', cfg); },
  create: function(data)  { return api.post('/categories', data); },
  update: function(id, d) { return api.put('/categories/' + id, d); },
  remove: function(id)    { return api.delete('/categories/' + id); },
};

// ── Ubicaciones / Estanterías ─────────────────────────
export const locationsAPI = {
  getAll:      function(cfg)        { return api.get('/locations', cfg); },
  create:      function(data)       { return api.post('/locations', data); },
  update:      function(id, d)      { return api.put('/locations/' + id, d); },
  remove:      function(id)         { return api.delete('/locations/' + id); },
  moveProduct: function(pid, data)  { return api.put('/locations/move-product/' + pid, data); },
};

// ── Configuración de tienda ───────────────────────────
export const settingsAPI = {
  getAll: function()     { return api.get('/settings'); },
  update: function(data) { return api.put('/settings', data); },
};

export const cajaAPI = {
  getSesiones:   function()          { return api.get('/caja/sesiones'); },
  getSesionActiva: function()        { return api.get('/caja/sesiones/activa'); },
  abrir:         function(data)      { return api.post('/caja/abrir', data); },
  cerrar:        function(id, data)  { return api.post('/caja/cerrar/' + id, data); },
  getGastos:     function(sesionId)  { return api.get('/caja/gastos' + (sesionId ? '?sesion_id=' + sesionId : '')); },
  crearGasto:    function(data)      { return api.post('/caja/gastos', data); },
  eliminarGasto: function(id)        { return api.delete('/caja/gastos/' + id); },
};

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

export const remindersAPI = {
  summary:  function() { return api.get('/reminders/summary'); },
  accounts: function() { return api.get('/reminders/accounts'); },
};

export const backupAPI = {
  list:     function()   { return api.get('/backup'); },
  create:   function()   { return api.post('/backup'); },
  download: function(id) { return api.get('/backup/' + id + '/download'); },
  data:     function(id) { return api.get('/backup/' + id + '/data'); },
  health:   function()   { return api.get('/backup/health'); },
};

export const pushAPI = {
  vapidKey:   function()    { return api.get('/push/vapid-public-key'); },
  subscribe:  function(sub) { return api.post('/push/subscribe', sub); },
  unsubscribe:function(ep)  { return api.delete('/push/subscribe', { data: { endpoint: ep } }); },
};

export const variantsAPI = {
  list:   function(productId)        { return api.get('/products/' + productId + '/variants'); },
  add:    function(productId, data)  { return api.post('/products/' + productId + '/variants', data); },
  update: function(productId, id, d) { return api.put('/products/' + productId + '/variants/' + id, d); },
  remove: function(productId, id)    { return api.delete('/products/' + productId + '/variants/' + id); },
};

export const serialsAPI = {
  list:    function(productId, status) {
    var qs = status ? '?status=' + encodeURIComponent(status) : '';
    return api.get('/serials/products/' + productId + '/serials' + qs);
  },
  add:     function(productId, data)   { return api.post('/serials/products/' + productId + '/serials', data); },
  update:  function(productId, id, d)  { return api.put('/serials/products/' + productId + '/serials/' + id, d); },
  remove:  function(productId, id)     { return api.delete('/serials/products/' + productId + '/serials/' + id); },
  search:  function(q)                 { return api.get('/serials/serials/search?q=' + encodeURIComponent(q)); },
};

export const checkAPI = async function() {
  try {
    var baseUrl = API_URL.replace('/api', '');
    var res = await fetch(baseUrl + '/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
};

export default api;
