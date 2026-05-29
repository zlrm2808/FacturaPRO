'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Shield, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'

const MODULE_COLORS: Record<string, string> = {
  AUTH: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  CLIENTES: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  PRODUCTOS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  FACTURAS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  LICENCIAS: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CUENTAS: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  USUARIOS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  INVENTARIO: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
}

const MODULE_OPTIONS = [
  'AUTH',
  'CLIENTES',
  'PRODUCTOS',
  'FACTURAS',
  'LICENCIAS',
  'CUENTAS',
  'USUARIOS',
  'INVENTARIO',
]

export function AuditView() {
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [module, setModule] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const buildQuery = () => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', limit.toString())
    if (userId) params.set('userId', userId)
    if (action) params.set('action', action)
    if (module) params.set('module', module)
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) params.set('toDate', toDate)
    return params.toString()
  }

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit', userId, action, module, fromDate, toDate, page],
    queryFn: () => api.get(`/audit?${buildQuery()}`),
  })

  const logs = data?.logs || []
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }

  const handleRefresh = () => {
    refetch()
  }

  const handleClearFilters = () => {
    setUserId('')
    setAction('')
    setModule('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const getModuleColor = (mod: string) => {
    return MODULE_COLORS[mod] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Auditoría del Sistema
          </h1>
          <p className="text-muted-foreground">Registro de todas las acciones del sistema</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">ID Usuario</Label>
              <Input
                placeholder="ID del usuario..."
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setPage(1) }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Acción</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar acción..."
                  value={action}
                  onChange={(e) => { setAction(e.target.value); setPage(1) }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Módulo</Label>
              <Select value={module} onValueChange={(v) => { setModule(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {MODULE_OPTIONS.map((mod) => (
                    <SelectItem key={mod} value={mod}>
                      {mod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1) }}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination.total} registro{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No se encontraron registros de auditoría</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: Record<string, unknown>) => (
                    <TableRow key={log.id as string}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateTime(log.createdAt as string)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(log.user as Record<string, unknown>)?.name as string || 'Sistema'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.action as string}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getModuleColor(log.module as string)}`}>
                          {log.module as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={log.details as string}>
                        {log.details as string || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(log.ip as string) || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page >= pagination.totalPages}
          >
            Siguiente
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
