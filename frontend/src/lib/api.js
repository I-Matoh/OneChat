/**
 * Core API Client Interceptor
 * 
 * Architecture Note:
 * This singleton utility encapsulates the native Fetch API, pre-configuring all global
 * networking defaults, error boundary catching, and JWT token injection. By confining
 * all REST API calls into a single dictionary object (`api`), the rest of the React
 * application doesn't have to worry about URLs, token management, or headers.
 */
const API = import.meta.env.VITE_API_URL || '';

function getStoredToken() {
  try {
    const auth = JSON.parse(localStorage.getItem('onechat_auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || data.message || 'Request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  auth: {
    me: () => apiFetch('/auth/me'),
    login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (name, email, password) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  },

  workspaces: {
    list: () => apiFetch('/workspaces'),
    create: (data) => apiFetch('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    get: (id) => apiFetch(`/workspaces/${id}`),
    update: (id, data) => apiFetch(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/workspaces/${id}`, { method: 'DELETE' }),
    members: (id) => apiFetch(`/workspaces/${id}/members`),
  },

  pages: {
    list: (workspaceId) => apiFetch(`/workspaces/${workspaceId}/pages`),
    create: (workspaceId, data) => apiFetch(`/workspaces/${workspaceId}/pages`, { method: 'POST', body: JSON.stringify(data) }),
    get: (pageId) => apiFetch(`/workspaces/pages/${pageId}`),
    update: (pageId, data) => apiFetch(`/workspaces/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (pageId) => apiFetch(`/workspaces/pages/${pageId}`, { method: 'DELETE' }),
  },

  tasks: {
    list: (workspaceId) => apiFetch(`/tasks?workspaceId=${workspaceId}`),
    create: (data) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list: (workspaceId) => apiFetch(workspaceId ? `/chat/conversations?workspaceId=${workspaceId}` : '/chat/conversations'),
    create: (data) => apiFetch('/chat/conversations', { method: 'POST', body: JSON.stringify(data) }),
    join: (id) => apiFetch(`/chat/conversations/${id}/join`, { method: 'POST' }),
    getMessages: (id, page = 1, limit = 50) => apiFetch(`/chat/conversations/${id}/messages?page=${page}&limit=${limit}`),
  },

  messages: {
    create: (data) => apiFetch('/chat/messages', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/chat/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  ai: {
    chat: (prompt, context, contextType = 'chat') => apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ prompt, context, contextType }) }),
    extractActions: (text) => apiFetch('/ai/extract-actions', { method: 'POST', body: JSON.stringify({ text }) }),
  },
};

export default api;
