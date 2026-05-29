'use client'

import { useEffect, useState } from 'react'
import { Providers } from '@/components/providers'
import { useAuthStore, useAppStore } from '@/lib/store'
import { LoginForm } from '@/components/login-form'
import { AppSidebar } from '@/components/app-sidebar'
import { DashboardView } from '@/components/dashboard-view'
import { PosView } from '@/components/pos-view'
import { ClientsView } from '@/components/clients-view'
import { InventoryView } from '@/components/inventory-view'
import { AccountsView } from '@/components/accounts-view'
import { ReportsView } from '@/components/reports-view'
import { AuditView } from '@/components/audit-view'
import { NotificationsView } from '@/components/notifications-view'
import { SettingsView } from '@/components/settings-view'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { Bell, Moon, Sun, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'

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
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    pos: 'Facturación (POS)',
    clients: 'Gestión de Clientes',
    inventory: 'Gestión de Inventario',
    accounts: 'Estados de Cuenta',
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
  const { isAuthenticated } = useAuthStore()
  const { currentPage } = useAppStore()

  // Hydration safety: useSyncExternalStore-like pattern
  const [hydrated, setHydrated] = useState(() => false)
  useEffect(() => {
    // Schedule state update after mount to avoid synchronous setState in effect
    const id = requestAnimationFrame(() => setHydrated(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!hydrated) {
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
            {renderPage()}
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
