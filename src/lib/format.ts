export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PAGADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    PENDIENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    VENCIDA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    ANULADA: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    ACTIVA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    VENCIDA_LIC: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    SUSPENDIDA: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    ACTIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    INACTIVO: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
    TARJETA: 'Tarjeta',
    CREDITO: 'Crédito',
  }
  return labels[method] || method
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    DESARROLLADOR: 'Desarrollador',
    ADMINISTRADOR: 'Administrador',
    EMPLEADO: 'Empleado',
  }
  return labels[role] || role
}
