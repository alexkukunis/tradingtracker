const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Helper function to get auth token
const getToken = () => {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
}

// Helper function to set auth token
const setToken = (token, rememberMe = false) => {
  if (rememberMe) {
    localStorage.setItem('auth_token', token)
  } else {
    sessionStorage.setItem('auth_token', token)
  }
}

// Helper function to remove auth token
const removeToken = () => {
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_token')
}

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      let errorMessage = 'Request failed'
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || `Server error: ${response.status}`
      } catch (e) {
        errorMessage = `Server error: ${response.status} ${response.statusText}`
      }
      console.error('API Error:', { url, status: response.status, error: errorMessage })
      throw new Error(errorMessage)
    }

    return response.json()
  } catch (error) {
    // Network errors or other fetch errors
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError') {
      console.error('Network Error:', { url, error: error.message })
      throw new Error('Unable to connect to server. Please make sure the server is running and check your connection.')
    }
    console.error('API Request Error:', { url, error: error.message })
    throw error
  }
}

// Auth API
export const authAPI = {
  register: async (email, password, name, rememberMe = false) => {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    })
    if (data.token) {
      setToken(data.token, rememberMe)
    }
    return data
  },

  login: async (email, password, rememberMe = false) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    if (data.token) {
      setToken(data.token, rememberMe)
    }
    return data
  },

  logout: () => {
    removeToken()
  },

  getCurrentUser: async () => {
    return apiRequest('/api/auth/me')
  }
}

// Trades API
export const tradesAPI = {
  getAll: async () => {
    return apiRequest('/api/trades')
  },

  getById: async (id) => {
    return apiRequest(`/api/trades/${id}`)
  },

  create: async (tradeData) => {
    return apiRequest('/api/trades', {
      method: 'POST',
      body: JSON.stringify(tradeData)
    })
  },

  update: async (id, tradeData) => {
    return apiRequest(`/api/trades/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tradeData)
    })
  },

  delete: async (id) => {
    return apiRequest(`/api/trades/${id}`, {
      method: 'DELETE'
    })
  }
}

// Settings API
export const settingsAPI = {
  get: async () => {
    return apiRequest('/api/settings')
  },

  update: async (settingsData) => {
    return apiRequest('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData)
    })
  }
}

// TradeLocker API
export const tradelockerAPI = {
  connect: async (email, password, server, environment = 'live', accountId = null) => {
    return apiRequest('/api/tradelocker/connect', {
      method: 'POST',
      body: JSON.stringify({ email, password, server, environment, accountId })
    })
  },

  getStatus: async () => {
    return apiRequest('/api/tradelocker/status')
  },

  disconnect: async () => {
    return apiRequest('/api/tradelocker/disconnect', {
      method: 'POST'
    })
  },

  // mode: 'initial' → fetch full history, keep last 100 trades (first-time setup)
  //       'refresh' → incremental: only trades newer than last sync (default)
  sync: async (mode = 'refresh') => {
    return apiRequest('/api/tradelocker/sync', {
      method: 'POST',
      body: JSON.stringify({ mode })
    })
  }
}

// Export token management functions
export { getToken, setToken, removeToken }
