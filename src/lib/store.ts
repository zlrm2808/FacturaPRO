import { create } from 'zustand'

type AppPage = 'dashboard' | 'pos' | 'invoicing' | 'clients' | 'client-detail' | 'inventory' | 'accounts' | 'overdue' | 'suppliers' | 'reports' | 'audit' | 'notifications' | 'settings' | 'licenses' | 'users'

type BillingMode = 'pos' | 'invoicing'

interface AuthState {
  token: string | null
  user: { id: string; username: string; name: string; role: string } | null
  loginDate: string | null // YYYY-MM-DD - to detect midnight on client side
  isAuthenticated: boolean
  hydrated: boolean
  login: (token: string, user: AuthState['user']) => void
  logout: () => void
  hydrate: () => void
  checkMidnight: () => void
}

interface AppState {
  currentPage: AppPage
  selectedClientId: string | null
  selectedInvoiceId: string | null
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  lowStockFilterActive: boolean
  posHistoryOpen: boolean
  billingMode: BillingMode
  setCurrentPage: (page: AppPage) => void
  setSelectedClientId: (id: string | null) => void
  setSelectedInvoiceId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setLowStockFilterActive: (v: boolean) => void
  setPosHistoryOpen: (v: boolean) => void
  setBillingMode: (mode: BillingMode) => void
}

/**
 * Get today's date in YYYY-MM-DD format (UTC to match server-side)
 */
function getTodayDate(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loginDate: null,
  isAuthenticated: false,
  hydrated: false,
  login: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('loginDate', getTodayDate())
    }
    set({ token, user, loginDate: getTodayDate(), isAuthenticated: true })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('loginDate')
    }
    set({ token: null, user: null, loginDate: null, isAuthenticated: false })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    try {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      const loginDate = localStorage.getItem('loginDate')
      const user = userStr ? JSON.parse(userStr) : null

      // Check if login date is today (midnight expiry on client side)
      const today = getTodayDate()
      if (loginDate && loginDate !== today) {
        // Session expired: past midnight - clear everything
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('loginDate')
        set({ token: null, user: null, loginDate: null, isAuthenticated: false, hydrated: true })
        return
      }

      set({
        token,
        user,
        loginDate,
        isAuthenticated: !!token,
        hydrated: true,
      })
    } catch {
      set({ hydrated: true })
    }
  },
  checkMidnight: () => {
    const { loginDate, logout } = get()
    if (!loginDate) return
    const today = getTodayDate()
    if (loginDate !== today) {
      // Past midnight - auto logout
      logout()
    }
  },
}))

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  selectedClientId: null,
  selectedInvoiceId: null,
  sidebarOpen: true,
  sidebarCollapsed: false,
  lowStockFilterActive: false,
  posHistoryOpen: false,
  billingMode: 'pos',
  setCurrentPage: (page) => set({ currentPage: page }),
  setSelectedClientId: (id) => set({ selectedClientId: id }),
  setSelectedInvoiceId: (id) => set({ selectedInvoiceId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setLowStockFilterActive: (v) => set({ lowStockFilterActive: v }),
  setPosHistoryOpen: (v) => set({ posHistoryOpen: v }),
  setBillingMode: (mode) => set({ billingMode: mode }),
}))
