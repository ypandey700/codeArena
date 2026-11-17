import api from './api';
const data = (response) => response.data.data;
export const requestId = () => globalThis.crypto?.randomUUID?.() || `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const skiller = {
  dashboard: (signal) => api.get('/skiller', { signal }).then(data),
  history: (page = 1, signal) => api.get('/skiller/history', { params: { page, limit: 8 }, signal }).then(data),
  diagnostic: () => api.get('/skiller/diagnostic').then(data),
  assess: (answers) => api.post('/skiller/diagnostic', { answers }).then(data),
  link: (provider, url) => api.put(`/skiller/profiles/${provider}`, { url }, { timeout: 15000 }).then(data),
  unlink: (provider) => api.delete(`/skiller/profiles/${provider}`).then(data),
  next: (topic, signal) => api.post('/skiller/next', topic ? { topic } : {}, { signal }).then(data),
  attempt: (id, signal) => api.get(`/skiller/attempts/${id}`, { signal }).then(data),
  draft: (id, body) => api.patch(`/skiller/attempts/${id}/draft`, body).then(data),
  hint: (id) => api.post(`/skiller/attempts/${id}/hint`).then(data),
  evaluate: (id, kind, body) => api.post(`/skiller/attempts/${id}/${kind}`, body, { timeout: 120000 }).then(data),
  abandon: (id) => api.post(`/skiller/attempts/${id}/abandon`).then(data),
};
export const skillerError = (error) => error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'This request is taking longer than expected. Reopen the attempt to check its saved state.' : error.message || 'Something went wrong. Try again.');
export const TOPIC_LABELS = { arrays: 'Arrays', strings: 'Strings', hashing: 'Hash maps & sets', 'binary-search': 'Binary search', stacks: 'Stacks', 'dynamic-programming': 'Dynamic programming' };
export const TOPIC_STATES = { unassessed: 'Not assessed', 'needs-practice': 'Needs practice', improving: 'Improving', strong: 'Strong' };
