import { create } from 'zustand'

type AppPage = 'dashboard' | 'pos' | 'clients' | 'client-detail' | 'inventory' | 'accounts' | 'reports' | 'audit' | 'notifications' | 'settings' | 'licenses' | 'users'

interface AuthState {
  token: string | null
  user: { id: string; username: string; name: string; role: string } | null
  isAuthenticated: boolean
  login: (token: string, user: AuthState['user']) => void
  logout: () => void
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
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,
  login: (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: null, user: null, isAuthenticated: false })
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
