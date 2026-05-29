'use client'

import { useEffect, useState, lazy, Suspense } from 'react'
import { Providers } from '@/components/providers'
import { useAuthStore, useAppStore } from '@/lib/store'
import { LoginForm } from '@/components/login-form'
import { AppSidebar } from '@/components/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { Bell, Moon, Sun, Menu, Loader2, DollarSign, RefreshCw } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'

// Lazy load all views to reduce initial bundle size and memory usage
const DashboardView = lazy(() => import('@/components/dashboard-view').then(m => ({ default: m.DashboardView })))
const PosView = lazy(() => import('@/components/pos-view').then(m => ({ default: m.PosView })))
const ClientsView = lazy(() => import('@/components/clients-view').then(m => ({ default: m.ClientsView })))
const InventoryView = lazy(() => import('@/components/inventory-view').then(m => ({ default: m.InventoryView })))
const AccountsView = lazy(() => import('@/components/accounts-view').then(m => ({ default: m.AccountsView })))
const OverdueView = lazy(() => import('@/components/overdue-view').then(m => ({ default: m.OverdueView })))
const SuppliersView = lazy(() => import('@/components/suppliers-view').then(m => ({ default: m.SuppliersView })))
const ReportsView = lazy(() => import('@/components/reports-view').then(m => ({ default: m.ReportsView })))
const AuditView = lazy(() => import('@/components/audit-view').then(m => ({ default: m.AuditView })))
const NotificationsView = lazy(() => import('@/components/notifications-view').then(m => ({ default: m.NotificationsView })))
const SettingsView = lazy(() => import('@/components/settings-view').then(m => ({ default: m.SettingsView })))

function ViewLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function LicenseBanner() {
  const { data: licenseStatus } = useQuery({
    queryKey: ['license-status'],
    queryFn: () => api.get('/licenses/status'),
    refetchInterval: 60000,
  })

  if (!licenseStatus) return null

  if (!licenseStatus.active) {
    return (
      <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium">
        ⚠️ LICENCIA VENCIDA - El sistema funciona en modo limitado. Contacte al administrador.
      </div>
    )
  }

  if (licenseStatus.daysRemaining !== null && licenseStatus.daysRemaining <= 30) {
    return (
      <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
        ⚠️ Licencia vence en {licenseStatus.daysRemaining} días. Renueve pronto.
      </div>
    )
  }

  return null
}

function Header() {
  const { currentPage } = useAppStore()
  const { user } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const { data: notifData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/notifications'),
    refetchInterval: 30000,
  })
  const { data: dollarRateData, refetch: refetchRate, isFetching: isFetchingRate } = useQuery({
    queryKey: ['header-dollar-rate'],
    queryFn: () => api.get('/dollar-rates?action=effective'),
    refetchInterval: 300000,
  })
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    pos: 'Facturación (POS)',
    clients: 'Gestión de Clientes',
    inventory: 'Gestión de Inventario',
    accounts: 'Estados de Cuenta',
    overdue: 'Facturas Vencidas',
    suppliers: 'Proveedores',
    reports: 'Reportes',
    audit: 'Auditoría',
    notifications: 'Notificaciones',
    settings: 'Configuración',
    licenses: 'Licencias',
    users: 'Gestión de Usuarios',
  }

  const unreadCount = notifData?.notifications?.filter((n: any) => !n.read).length || 0

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">{pageTitles[currentPage] || 'Dashboard'}</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Dollar Rate Indicator */}
        {dollarRateData && dollarRateData.officialRate > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              1 USD = Bs. {dollarRateData.officialRate.toFixed(2)}
            </span>
            <button
              onClick={() => refetchRate()}
              className="ml-0.5 text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors"
              title="Actualizar tasa"
            >
              <RefreshCw className={`h-3 w-3 ${isFetchingRate ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
        <Button variant="ghost" size="icon" className="relative" onClick={() => setCurrentPage('notifications')}>
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </header>
  )
}

function AppContent() {
  const { isAuthenticated, hydrate } = useAuthStore()
  const { currentPage } = useAppStore()

  // Hydration: load auth state from localStorage after mount
  const [ready, setReady] = useState(false)

  useEffect(() => {
    hydrate()
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [hydrate])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardView />
      case 'pos':
        return <PosView />
      case 'clients':
        return <ClientsView />
      case 'inventory':
        return <InventoryView />
      case 'accounts':
        return <AccountsView />
      case 'overdue':
        return <OverdueView />
      case 'suppliers':
        return <SuppliersView />
      case 'reports':
        return <ReportsView />
      case 'audit':
        return <AuditView />
      case 'notifications':
        return <NotificationsView />
      case 'settings':
      case 'licenses':
      case 'users':
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <LicenseBanner />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/30">
            <Suspense fallback={<ViewLoader />}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  )
}
