'use client'

import { useAuthStore, useAppStore } from '@/lib/store'
import { getRoleLabel } from '@/lib/format'
import { api } from '@/lib/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  FileText,
  BarChart3,
  Shield,
  Bell,
  Settings,
  Key,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Truck,
  FileSpreadsheet,
} from 'lucide-react'

type Page = 'dashboard' | 'pos' | 'invoicing' | 'clients' | 'client-detail' | 'inventory' | 'accounts' | 'overdue' | 'suppliers' | 'reports' | 'audit' | 'notifications' | 'settings' | 'licenses' | 'users'

const mainNav: { id: Page; label: string; icon: React.ElementType; roles?: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Facturación (POS)', icon: ShoppingCart },
  { id: 'invoicing', label: 'Facturación (Tradicional)', icon: FileSpreadsheet },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'accounts', label: 'Estados de Cuenta', icon: FileText },
  { id: 'overdue', label: 'Facturas Vencidas', icon: AlertTriangle },
  { id: 'suppliers', label: 'Proveedores', icon: Truck },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
]

const adminNav: { id: Page; label: string; icon: React.ElementType; roles?: string[] }[] = [
  { id: 'audit', label: 'Auditoría', icon: Shield, roles: ['DESARROLLADOR', 'ADMINISTRADOR'] },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'settings', label: 'Configuración', icon: Settings, roles: ['DESARROLLADOR', 'ADMINISTRADOR'] },
  { id: 'licenses', label: 'Licencias', icon: Key, roles: ['DESARROLLADOR'] },
  { id: 'users', label: 'Usuarios', icon: UserCog, roles: ['DESARROLLADOR', 'ADMINISTRADOR'] },
]

export function AppSidebar() {
  const { user, logout } = useAuthStore()
  const { currentPage, setCurrentPage, sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {})
    } catch {
      // Ignore errors - still logout client-side
    }
    logout()
  }

  const role = user?.role || 'EMPLEADO'
  const filteredAdminNav = adminNav.filter((item) => !item.roles || item.roles.includes(role))
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U'

  return (
    <div
      className={`h-screen flex flex-col bg-card border-r border-border transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-border">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <ShoppingCart className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-lg tracking-tight">FacturaPro</span>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {mainNav.map((item) => (
          <Button
            key={item.id}
            variant={currentPage === item.id ? 'secondary' : 'ghost'}
            className={`w-full justify-start gap-3 h-10 ${
              sidebarCollapsed ? 'px-2' : 'px-3'
            } ${currentPage === item.id ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}`}
            onClick={() => setCurrentPage(item.id)}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
          </Button>
        ))}

        {filteredAdminNav.length > 0 && (
          <>
            <Separator className="my-2" />
            {!sidebarCollapsed && (
              <p className="px-3 text-xs font-medium text-muted-foreground mb-1">Administración</p>
            )}
            {filteredAdminNav.map((item) => (
              <Button
                key={item.id}
                variant={currentPage === item.id ? 'secondary' : 'ghost'}
                className={`w-full justify-start gap-3 h-10 ${
                  sidebarCollapsed ? 'px-2' : 'px-3'
                } ${currentPage === item.id ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}`}
                onClick={() => setCurrentPage(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Button>
            ))}
          </>
        )}
      </nav>

      {/* User Info */}
      <div className="border-t border-border p-2 space-y-2">
        <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : 'px-2'}`}>
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-emerald-600 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {getRoleLabel(role)}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-muted-foreground"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-destructive"
            onClick={handleLogout}
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
