'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDate, getStatusColor, getPaymentMethodLabel } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  BarChart3,
  Printer,
  FileSpreadsheet,
  FileDown,
  DollarSign,
  Package,
  Users,
  FileText,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { id: 'ventas', label: 'Ventas', icon: DollarSign },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'facturas-vencidas', label: 'Facturas Vencidas', icon: AlertTriangle },
  { id: 'pagos', label: 'Pagos', icon: FileText },
  { id: 'productos-vendidos', label: 'Productos Vendidos', icon: ShoppingCart },
  { id: 'ganancias', label: 'Ganancias', icon: TrendingUp },
] as const

type ReportType = (typeof REPORT_TYPES)[number]['id']

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#6366f1']

export function ReportsView() {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [reportType, setReportType] = useState<ReportType>('ventas')
  const [fromDate, setFromDate] = useState(thirtyDaysAgo)
  const [toDate, setToDate] = useState(today)

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', reportType, fromDate, toDate],
    queryFn: () =>
      api.get(`/reports?type=${reportType}&fromDate=${fromDate}&toDate=${toDate}`),
    enabled: !!reportType,
  })

  const exportToExcel = () => {
    if (!report) return
    const data = getExportData()
    if (!data.length) {
      toast.error('No hay datos para exportar')
      return
    }
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, `reporte-${reportType}.xlsx`)
    toast.success('Archivo Excel descargado')
  }

  const exportToCSV = () => {
    if (!report) return
    const data = getExportData()
    if (!data.length) {
      toast.error('No hay datos para exportar')
      return
    }
    const ws = XLSX.utils.json_to_sheet(data)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-${reportType}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Archivo CSV descargado')
  }

  const getExportData = () => {
    if (!report) return []
    switch (reportType) {
      case 'ventas':
        return (report.invoices || []).map((inv: Record<string, unknown>) => ({
          Numero: inv.number,
          Fecha: formatDate(inv.date as string),
          Cliente: (inv.client as Record<string, unknown>)?.name || '-',
          MetodoPago: getPaymentMethodLabel(inv.paymentMethod as string),
          Subtotal: inv.subtotal,
          ITBIS: inv.tax,
          Total: inv.total,
          Estado: inv.status,
        }))
      case 'inventario':
        return (report.lowStockItems || []).map((p: Record<string, unknown>) => ({
          Codigo: p.code,
          Nombre: p.name,
          Cantidad: p.quantity,
          MinStock: p.minStock,
          Categoria: p.category || '-',
        }))
      case 'clientes':
        return (report.clientsWithBalance || []).map((c: Record<string, unknown>) => ({
          Nombre: c.name,
          Balance: c.balance,
          Facturas: c.invoiceCount,
        }))
      case 'facturas-vencidas':
        return (report.invoices || []).map((inv: Record<string, unknown>) => ({
          Numero: inv.number,
          Fecha: formatDate(inv.date as string),
          Cliente: (inv.client as Record<string, unknown>)?.name || '-',
          Total: inv.total,
        }))
      case 'pagos':
        return (report.transactions || []).map((t: Record<string, unknown>) => ({
          Fecha: formatDate(t.date as string),
          Cliente: (t.client as Record<string, unknown>)?.name || '-',
          Metodo: getPaymentMethodLabel(t.paymentMethod as string),
          Monto: t.amount,
        }))
      case 'productos-vendidos':
        return (report.topProducts || []).map((p: Record<string, unknown>) => ({
          Codigo: (p.product as Record<string, unknown>)?.code,
          Nombre: (p.product as Record<string, unknown>)?.name,
          CantidadVendida: p.totalQuantity,
          Ingresos: p.totalRevenue,
        }))
      case 'ganancias':
        return [{
          IngresosTotales: report.totalRevenue,
          CostoTotal: report.totalCost,
          Ganancia: report.profit,
          Margen: `${report.profitMargin}%`,
        }]
      default:
        return []
    }
  }

  const renderSummaryCards = () => {
    if (!report) return null

    switch (reportType) {
      case 'ventas':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard title="Total Facturas" value={report.totalInvoices} icon={FileText} />
            <SummaryCard title="Monto Total" value={formatCurrency(report.totalAmount)} icon={DollarSign} />
            <SummaryCard title="ITBIS Total" value={formatCurrency(report.totalTax)} icon={DollarSign} />
            <SummaryCard title="Descuentos" value={formatCurrency(report.totalDiscount)} icon={TrendingUp} />
          </div>
        )
      case 'inventario':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard title="Total Productos" value={report.totalProducts} icon={Package} />
            <SummaryCard title="Stock Bajo" value={report.lowStockCount} icon={AlertTriangle} />
            <SummaryCard title="Valor Inventario" value={formatCurrency(report.totalValue)} icon={DollarSign} />
            <SummaryCard title="Costo Inventario" value={formatCurrency(report.totalCostValue)} icon={DollarSign} />
          </div>
        )
      case 'clientes':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SummaryCard title="Total Clientes" value={report.totalClients} icon={Users} />
            <SummaryCard title="Con Balance" value={report.clientsWithBalanceCount} icon={AlertTriangle} />
            <SummaryCard title="Balance Pendiente" value={formatCurrency(report.totalBalanceOutstanding)} icon={DollarSign} />
          </div>
        )
      case 'facturas-vencidas':
        return (
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard title="Facturas Vencidas" value={report.count} icon={AlertTriangle} />
            <SummaryCard title="Monto Vencido" value={formatCurrency(report.totalOverdue)} icon={DollarSign} />
          </div>
        )
      case 'pagos':
        return (
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard title="Total Transacciones" value={report.count} icon={FileText} />
            <SummaryCard title="Monto Total Pagos" value={formatCurrency(report.totalPayments)} icon={DollarSign} />
          </div>
        )
      case 'productos-vendidos':
        return null
      case 'ganancias':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard title="Ingresos" value={formatCurrency(report.totalRevenue)} icon={DollarSign} />
            <SummaryCard title="Costos" value={formatCurrency(report.totalCost)} icon={TrendingUp} />
            <SummaryCard
              title="Ganancia"
              value={formatCurrency(report.profit)}
              icon={TrendingUp}
              valueColor={report.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
            />
            <SummaryCard title="Margen" value={`${report.profitMargin}%`} icon={BarChart3} />
          </div>
        )
      default:
        return null
    }
  }

  const renderChart = () => {
    if (!report) return null

    switch (reportType) {
      case 'ventas': {
        const byMethod = report.byPaymentMethod || {}
        const chartData = Object.entries(byMethod).map(([method, data]) => ({
          name: getPaymentMethodLabel(method),
          total: (data as Record<string, number>).total,
          count: (data as Record<string, number>).count,
        }))
        if (chartData.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventas por Método de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      }
      case 'inventario': {
        const byCategory = report.byCategory || {}
        const chartData = Object.entries(byCategory).map(([cat, data]) => ({
          name: cat,
          value: (data as Record<string, number>).totalValue,
        }))
        if (chartData.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valor por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    dataKey="value"
                  >
                    {chartData.map((_entry: Record<string, unknown>, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      }
      case 'pagos': {
        const byMethod = report.byMethod || {}
        const chartData = Object.entries(byMethod).map(([method, data]) => ({
          name: getPaymentMethodLabel(method),
          total: (data as Record<string, number>).total,
          count: (data as Record<string, number>).count,
        }))
        if (chartData.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagos por Método</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    dataKey="total"
                  >
                    {chartData.map((_entry: Record<string, unknown>, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      }
      case 'productos-vendidos': {
        const topProducts = (report.topProducts || []).slice(0, 10)
        const chartData = topProducts.map((p: Record<string, unknown>) => ({
          name: (p.product as Record<string, unknown>)?.name || 'N/A',
          cantidad: p.totalQuantity,
          ingresos: p.totalRevenue,
        }))
        if (chartData.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Productos Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      }
      default:
        return null
    }
  }

  const renderDataTable = () => {
    if (!report) return null

    switch (reportType) {
      case 'ventas':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle de Facturas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total (USD)</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Total (Bs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.invoices || []).map((inv: Record<string, unknown>) => (
                      <TableRow key={inv.id as string}>
                        <TableCell className="font-medium">{inv.number as string}</TableCell>
                        <TableCell>{formatDate(inv.date as string)}</TableCell>
                        <TableCell>{(inv.client as Record<string, unknown>)?.name as string || '-'}</TableCell>
                        <TableCell>{getPaymentMethodLabel(inv.paymentMethod as string)}</TableCell>
                        <TableCell><Badge className={getStatusColor(inv.status as string)}>{inv.status as string}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.total as number)}</TableCell>
                        <TableCell className="text-right hidden md:table-cell text-emerald-600 dark:text-emerald-400">
                          {inv.totalBs ? formatBs(inv.totalBs as number) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      case 'inventario':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos con Stock Bajo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.lowStockItems || []).map((p: Record<string, unknown>) => (
                      <TableRow key={p.id as string}>
                        <TableCell className="font-medium">{p.code as string}</TableCell>
                        <TableCell>{p.name as string}</TableCell>
                        <TableCell>{p.category as string || '-'}</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">{p.quantity as number}</TableCell>
                        <TableCell className="text-right">{p.minStock as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      case 'clientes':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes con Balance Pendiente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Facturas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.clientsWithBalance || []).map((c: Record<string, unknown>) => (
                      <TableRow key={c.id as string}>
                        <TableCell className="font-medium">{c.name as string}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(c.balance as number)}</TableCell>
                        <TableCell className="text-right">{c.invoiceCount as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      case 'facturas-vencidas':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facturas Vencidas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total (USD)</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Total (Bs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.invoices || []).map((inv: Record<string, unknown>) => (
                      <TableRow key={inv.id as string}>
                        <TableCell className="font-medium">{inv.number as string}</TableCell>
                        <TableCell>{formatDate(inv.date as string)}</TableCell>
                        <TableCell>{(inv.client as Record<string, unknown>)?.name as string || '-'}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(inv.total as number)}</TableCell>
                        <TableCell className="text-right hidden md:table-cell text-emerald-600 dark:text-emerald-400">
                          {inv.totalBs ? formatBs(inv.totalBs as number) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      case 'pagos':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transacciones</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto (USD)</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Monto (Bs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.transactions || []).map((t: Record<string, unknown>) => (
                      <TableRow key={t.id as string}>
                        <TableCell>{formatDate(t.date as string)}</TableCell>
                        <TableCell>{(t.client as Record<string, unknown>)?.name as string || '-'}</TableCell>
                        <TableCell>{getPaymentMethodLabel(t.paymentMethod as string)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.amount as number)}</TableCell>
                        <TableCell className="text-right hidden md:table-cell text-emerald-600 dark:text-emerald-400">
                          {t.amountBs ? formatBs(t.amountBs as number) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      case 'productos-vendidos':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos Vendidos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.topProducts || []).map((p: Record<string, unknown>, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{(p.product as Record<string, unknown>)?.code as string}</TableCell>
                        <TableCell>{(p.product as Record<string, unknown>)?.name as string}</TableCell>
                        <TableCell className="text-right">{p.totalQuantity as number}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.totalRevenue as number)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      case 'ganancias':
        return null
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Genera reportes detallados del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Type Tabs */}
      <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {REPORT_TYPES.map((type) => (
            <TabsTrigger key={type.id} value={type.id} className="gap-1.5 text-xs sm:text-sm">
              <type.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{type.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content is the same for all tabs, using the reportType state */}
        <TabsContent value={reportType} className="space-y-6 mt-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-muted rounded" />
                ))}
              </div>
              <div className="h-64 bg-muted rounded" />
            </div>
          ) : (
            <>
              {renderSummaryCards()}
              {renderChart()}
              {renderDataTable()}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  valueColor,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  valueColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-lg font-bold ${valueColor || ''}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
