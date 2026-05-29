import { create } from 'zustand'

type AppPage = 'dashboard' | 'pos' | 'clients' | 'client-detail' | 'inventory' | 'accounts' | 'overdue' | 'suppliers' | 'reports' | 'audit' | 'notifications' | 'settings' | 'licenses' | 'users'

interface AuthState {
  token: string | null
  user: { id: string; username: string; name: string; role: string } | null
  isAuthenticated: boolean
  hydrated: boolean
  login: (token: string, user: AuthState['user']) => void
  logout: () => void
  hydrate: () => void
}

interface AppState {
  currentPage: AppPage
  selectedClientId: string | null
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  setCurrentPage: (page: AppPage) => void
  setSelectedClientId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,
  login: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    set({ token: null, user: null, isAuthenticated: false })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    try {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      const user = userStr ? JSON.parse(userStr) : null
      set({
        token,
        user,
        isAuthenticated: !!token,
        hydrated: true,
      })
    } catch {
      set({ hydrated: true })
    }
  },
}))

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  selectedClientId: null,
  sidebarOpen: true,
  sidebarCollapsed: false,
  setCurrentPage: (page) => set({ currentPage: page }),
  setSelectedClientId: (id) => set({ selectedClientId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))
