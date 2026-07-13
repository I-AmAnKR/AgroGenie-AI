import axios from 'axios'

// 1. Centralized API configuration
// Reads from Vite environment variable. In production, this should be set to the backend URL.
// Fallback to '/api/v1' for local development to leverage Vite proxy.
const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

const axiosClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor — attach auth token when available
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agrogenie_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — normalise all API errors into a standard shape
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const normalised = {
      success: false,
      error: {
        code: error.response?.status ?? 'NETWORK_ERROR',
        message: error.response?.data?.error?.message
          ?? error.response?.data?.message
          ?? error.message
          ?? 'An unexpected error occurred'
      }
    }
    return Promise.reject(normalised)
  }
)

export default axiosClient
