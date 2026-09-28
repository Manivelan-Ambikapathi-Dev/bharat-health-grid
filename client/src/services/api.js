const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const AUTH_STORAGE_KEY = 'bhg_auth';

function readToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return '';
    }
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
}

function publicMessage(message, status) {
  if (status === 502 || status === 503 || status === 504) {
    if (typeof message === 'string' && (message.includes('not configured') || message.includes('API key') || message.includes('quota'))) {
      return message;
    }
    return 'Gemini is temporarily unavailable. Please try again.';
  }
  if (typeof message === 'string' && message.length > 0 && message.length <= 180) {
    return message;
  }
  return 'The request could not be completed.';
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = readToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('The health grid API is unavailable.');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401 && path !== '/auth/login') {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }

  if (!response.ok || body?.success === false) {
    throw new Error(publicMessage(body?.message, response.status));
  }

  return body.data;
}

function loginRequest(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

function getCurrentUser() {
  return request('/auth/me');
}

function approveRedistribution(recommendation) {
  return request('/redistribution/approve', {
    method: 'POST',
    body: JSON.stringify({
      medicine: recommendation.medicine,
      source_phc: recommendation.source_phc,
      destination_phc: recommendation.destination_phc,
    }),
  });
}

function getStateSummary() {
  return request('/analytics/state-summary');
}

function getAlerts() {
  return request('/alerts');
}

function getMedicineStock() {
  return request('/medicine-stock');
}

function getBeds() {
  return request('/beds');
}

function getPhcs() {
  return request('/phcs');
}

function getFootfall(phcId) {
  return request(`/patient-footfall?phc_id=${encodeURIComponent(phcId)}`);
}

function getAllFootfall() {
  return request('/patient-footfall');
}

function getPhcSummary(phcId) {
  return request(`/analytics/phc-summary/${encodeURIComponent(phcId)}`);
}

function analyzeResourceRisk() {
  return request('/ai/resource-risk-analysis', { method: 'POST' });
}

function findRedistribution() {
  return request('/ai/redistribution-recommendations', { method: 'POST' });
}

function askQuestion(question) {
  return request('/ai/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

function forecastQuery(params = {}) {
  const search = new URLSearchParams();
  if (params.phcId) {
    search.set('phc_id', String(params.phcId));
  }
  if (params.state) {
    search.set('state', params.state);
  }
  if (params.district) {
    search.set('district', params.district);
  }
  if (params.days) {
    search.set('days', String(params.days));
  }
  if (params.risk) {
    search.set('risk', params.risk);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function getDemandForecast(params) {
  return request(`/analytics/forecast${forecastQuery(params)}`);
}

function getMedicineForecast(params) {
  return request(`/analytics/medicine-forecast${forecastQuery(params)}`);
}

function getForecastAlerts(params) {
  return request(`/analytics/forecast-alerts${forecastQuery(params)}`);
}

function analyzeForecast(forecastData) {
  return request('/ai/forecast-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forecastData }),
  });
}

function runEmergencySimulation(demandIncreasePercent) {
  return request('/analytics/emergency-simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demandIncreasePercent, horizonDays: 7 }),
  });
}

function listManagedMedicine() {
  return request('/phc-resources/medicine-stock');
}

function createManagedMedicine(body) {
  return request('/phc-resources/medicine-stock', { method: 'POST', body: JSON.stringify(body) });
}

function updateManagedMedicine(stockId, body) {
  return request(`/phc-resources/medicine-stock/${encodeURIComponent(stockId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function deleteManagedMedicine(stockId) {
  return request(`/phc-resources/medicine-stock/${encodeURIComponent(stockId)}`, { method: 'DELETE' });
}

function listManagedFootfall() {
  return request('/phc-resources/patient-footfall');
}

function createManagedFootfall(body) {
  return request('/phc-resources/patient-footfall', { method: 'POST', body: JSON.stringify(body) });
}

function updateManagedFootfall(recordId, body) {
  return request(`/phc-resources/patient-footfall/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function deleteManagedFootfall(recordId) {
  return request(`/phc-resources/patient-footfall/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
}

function listManagedBeds() {
  return request('/phc-resources/beds');
}

function createManagedBeds(body) {
  return request('/phc-resources/beds', { method: 'POST', body: JSON.stringify(body) });
}

function updateManagedBeds(bedId, body) {
  return request(`/phc-resources/beds/${encodeURIComponent(bedId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function deleteManagedBeds(bedId) {
  return request(`/phc-resources/beds/${encodeURIComponent(bedId)}`, { method: 'DELETE' });
}

function listManagedAttendance() {
  return request('/phc-resources/attendance');
}

function createManagedAttendance(body) {
  return request('/phc-resources/attendance', { method: 'POST', body: JSON.stringify(body) });
}

function updateManagedAttendance(attendanceId, body) {
  return request(`/phc-resources/attendance/${encodeURIComponent(attendanceId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function deleteManagedAttendance(attendanceId) {
  return request(`/phc-resources/attendance/${encodeURIComponent(attendanceId)}`, { method: 'DELETE' });
}

function analyzeEmergency(scenario, simulationData) {
  return request('/ai/emergency-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, simulationData }),
  });
}

export {
  loginRequest,
  getCurrentUser,
  approveRedistribution,
  getStateSummary,
  getAlerts,
  getMedicineStock,
  getBeds,
  getPhcs,
  getFootfall,
  getAllFootfall,
  getPhcSummary,
  analyzeResourceRisk,
  findRedistribution,
  askQuestion,
  getDemandForecast,
  getMedicineForecast,
  getForecastAlerts,
  analyzeForecast,
  runEmergencySimulation,
  analyzeEmergency,
  listManagedMedicine,
  createManagedMedicine,
  updateManagedMedicine,
  deleteManagedMedicine,
  listManagedFootfall,
  createManagedFootfall,
  updateManagedFootfall,
  deleteManagedFootfall,
  listManagedBeds,
  createManagedBeds,
  updateManagedBeds,
  deleteManagedBeds,
  listManagedAttendance,
  createManagedAttendance,
  updateManagedAttendance,
  deleteManagedAttendance,
};
