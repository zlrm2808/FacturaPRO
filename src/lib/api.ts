import { useAuthStore } from './store'

const API_BASE = '/api'

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = useAuthStore.getState().token
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async get(path: string): Promise<any> {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.getHeaders() })
    if (!res.ok) {
      const errorText = await res.text()
      // Auto-logout only on auth validation endpoint failures
      if (res.status === 401 && path.startsWith('/auth/')) {
        useAuthStore.getState().logout()
      }
      throw new Error(errorText)
    }
    return res.json()
  }

  async post(path: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const errorText = await res.text()
      // Auto-logout only on auth validation endpoint failures
      if (res.status === 401 && path.startsWith('/auth/')) {
        useAuthStore.getState().logout()
      }
      throw new Error(errorText)
    }
    return res.json()
  }

  async put(path: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const errorText = await res.text()
      if (res.status === 401) {
        useAuthStore.getState().logout()
      }
      throw new Error(errorText)
    }
    return res.json()
  }

  async del(path: string): Promise<any> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    if (!res.ok) {
      const errorText = await res.text()
      if (res.status === 401) {
        useAuthStore.getState().logout()
      }
      throw new Error(errorText)
    }
    return res.json()
  }
}

export const api = new ApiClient()
