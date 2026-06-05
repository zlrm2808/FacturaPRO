'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDate, getStatusColor, getPaymentMethodLabel } from '@/lib/format'
import { generateReportPDF, generatePriceListPDF } from '@/lib/report-pdf'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  FileSpreadsheet,
  FileDown,
  DollarSign,
  Package,
  Users,
  FileText,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Tags,
  Droplets,
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
  { id: 'lista-precios', label: 'Lista de Precios', icon: Tags },
] as const

type ReportType = (typeof REPORT_TYPES)[number]['id']

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#6366f1']

export function ReportsView() {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [reportType, setReportType] = useState<ReportType>('ventas')
  const [fromDate, setFromDate] = useState(thirtyDaysAgo)
  const [toDate, setToDate] = useState(today)

  // Price list specific options
  const [priceCurrency, setPriceCurrency] = useState<'usd' | 'both'>('usd')
  const [showWatermark, setShowWatermark] = useState(false)
  const [priceCategory, setPriceCategory] = useState('')

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: () => api.get('/categories'),
  })

  const buildReportUrl = () => {
    let url = `/reports?type=${reportType}&fromDate=${fromDate}&toDate=${toDate}`
    if (reportType === 'lista-precios') {
      url += `&currency=${priceCurrency}`
      if (priceCategory) {
        url += `&category=${priceCategory}`
      }
    }
    return url
  }

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', reportType, fromDate, toDate, priceCurrency, priceCategory],
    queryFn: () => api.get(buildReportUrl()),
    enabled: !!reportType,
  })

  const { data: companyData } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get('/company'),
  })

  const exportToPDF = () => {
    if (!report) return

    const company = companyData || { name: 'FacturaPro', copyright: 'Zeus Rodriguez' }

    let title = ''
    let subtitle = ''
    let headers: string[] = []
    let rows: (string | number)[][] = []
    let summaryCards: { label: string; value: string }[] = []
    let groupHeaders: { label: string; colspan: number }[] | undefined = undefined

    switch (reportType) {
      case 'ventas':
        title = 'Reporte de Ventas'
        headers = ['Número', 'Fecha', 'Cliente', 'Método', 'Estado', 'Total USD']
        rows = (report.invoices || []).map((inv: Record<string, unknown>) => [
          inv.number as string,
          formatDate(inv.date as string),
          (inv.client as Record<string, unknown>)?.name as string || '-',
          getPaymentMethodLabel(inv.paymentMethod as string),
          inv.status as string,
          (inv.total as number).toFixed(2),
        ])
        summaryCards = [
          { label: 'Total Facturas', value: String(report.totalInvoices) },
          { label: 'Monto Total', value: `$${(report.totalAmount as number).toFixed(2)}` },
          { label: 'ITBIS', value: `$${(report.totalTax as number).toFixed(2)}` },
          { label: 'Descuentos', value: `$${(report.totalDiscount as number).toFixed(2)}` },
        ]
        break
      case 'inventario':
        title = 'Reporte de Inventario'
        headers = ['Código', 'Nombre', 'Categoría', 'Cantidad', 'Mínimo']
        rows = (report.lowStockItems || []).map((p: Record<string, unknown>) => [
          p.code as string,
          p.name as string,
          p.category as string || '-',
          p.quantity as number,
          p.minStock as number,
        ])
        summaryCards = [
          { label: 'Total Productos', value: String(report.totalProducts) },
          { label: 'Stock Bajo', value: String(report.lowStockCount) },
          { label: 'Valor Inventario', value: `$${(report.totalValue as number).toFixed(2)}` },
          { label: 'Costo Inventario', value: `$${(report.totalCostValue as number).toFixed(2)}` },
        ]
        break
      case 'clientes':
        title = 'Reporte de Clientes'
        headers = ['Nombre', 'Balance USD', 'Facturas']
        rows = (report.clientsWithBalance || []).map((c: Record<string, unknown>) => [
          c.name as string,
          (c.balance as number).toFixed(2),
          c.invoiceCount as number,
        ])
        summaryCards = [
          { label: 'Total Clientes', value: String(report.totalClients) },
          { label: 'Con Balance', value: String(report.clientsWithBalanceCount) },
          { label: 'Balance Pendiente', value: `$${(report.totalBalanceOutstanding as number).toFixed(2)}` },
        ]
        break
      case 'facturas-vencidas':
        title = 'Reporte de Facturas Vencidas'
        headers = ['Número', 'Fecha', 'Cliente', 'Total USD']
        rows = (report.invoices || []).map((inv: Record<string, unknown>) => [
          inv.number as string,
          formatDate(inv.date as string),
          (inv.client as Record<string, unknown>)?.name as string || '-',
          (inv.total as number).toFixed(2),
        ])
        summaryCards = [
          { label: 'Facturas Vencidas', value: String(report.count) },
          { label: 'Monto Vencido', value: `$${(report.totalOverdue as number).toFixed(2)}` },
        ]
        break
      case 'pagos':
        title = 'Reporte de Pagos'
        headers = ['Fecha', 'Cliente', 'Método', 'Monto USD']
        rows = (report.transactions || []).map((t: Record<string, unknown>) => [
          formatDate(t.date as string),
          (t.client as Record<string, unknown>)?.name as string || '-',
          getPaymentMethodLabel(t.paymentMethod as string),
          (t.amount as number).toFixed(2),
        ])
        summaryCards = [
          { label: 'Total Transacciones', value: String(report.count) },
          { label: 'Monto Total Pagos', value: `$${(report.totalPayments as number).toFixed(2)}` },
        ]
        break
      case 'productos-vendidos':
        title = 'Reporte de Productos Vendidos'
        headers = ['Código', 'Nombre', 'Cantidad', 'Ingresos']
        rows = (report.topProducts || []).map((p: Record<string, unknown>) => [
          (p.product as Record<string, unknown>)?.code as string,
          (p.product as Record<string, unknown>)?.name as string,
          p.totalQuantity as number,
          `$${(p.totalRevenue as number).toFixed(2)}`,
        ])
        break
      case 'ganancias':
        title = 'Reporte de Ganancias'
        headers = ['Concepto', 'Monto USD']
        rows = [
          ['Ingresos Totales', `$${(report.totalRevenue as number).toFixed(2)}`],
          ['Costo Total', `$${(report.totalCost as number).toFixed(2)}`],
          ['Ganancia', `$${(report.profit as number).toFixed(2)}`],
          ['Margen', `${report.profitMargin}%`],
        ]
        summaryCards = [
          { label: 'Ingresos', value: `$${(report.totalRevenue as number).toFixed(2)}` },
          { label: 'Costos', value: `$${(report.totalCost as number).toFixed(2)}` },
          { label: 'Ganancia', value: `$${(report.profit as number).toFixed(2)}` },
          { label: 'Margen', value: `${report.profitMargin}%` },
        ]
        break
      case 'lista-precios': {
        // Use dedicated price list PDF generator
        const priceListDoc = generatePriceListPDF(company, {
          products: (report.products || []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            code: p.code as string,
            name: p.name as string,
            salePrice: p.salePrice as number,
            salePriceBs: p.salePriceBs as number,
            category: p.category as string || 'Sin categoría',
            unit: (p as any).unit as string || 'Unidad',
          })),
          byCategory: report.byCategory || {},
          dollarRate: report.dollarRate as number || 0,
          totalProducts: report.totalProducts as number || 0,
          categories: report.categories as number || 0,
          currency: priceCurrency,
        }, {
          watermark: showWatermark,
        })
        priceListDoc.save(`reporte-lista-precios.pdf`)
        toast.success('PDF descargado correctamente')
        return
      }
      default:
        return
    }

    const doc = generateReportPDF(company, {
      title,
      subtitle,
      fromDate,
      toDate,
      headers,
      rows,
      summaryCards,
      watermark: showWatermark,
      groupHeaders,
    })

    doc.save(`reporte-${reportType}.pdf`)
    toast.success('PDF descargado correctamente')
  }

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
      case 'lista-precios':
        if (priceCurrency === 'both') {
          return (report.products || []).map((p: Record<string, unknown>) => ({
            Codigo: p.code,
            Nombre: p.name,
            Categoria: p.category || '-',
            PrecioUSD: p.salePrice,
            PrecioBs: (p.salePriceBs as number) > 0 ? p.salePriceBs : '-',
          }))
        }
        return (report.products || []).map((p: Record<string, unknown>) => ({
          Codigo: p.code,
          Nombre: p.name,
          Categoria: p.category || '-',
          PrecioUSD: p.salePrice,
        }))
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
      case 'lista-precios':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SummaryCard title="Total Productos" value={report.totalProducts} icon={Package} />
            <SummaryCard title="Categorías" value={report.categories} icon={Tags} />
            {(report.dollarRate as number) > 0 && (
              <SummaryCard title="Tasa BCV" value={`Bs. ${(report.dollarRate as number).toFixed(2)}`} icon={DollarSign} />
            )}
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
      case 'lista-precios': {
        // Bar chart showing product count by category
        const byCategory = report.byCategory || {}
        const chartData = Object.entries(byCategory).map(([cat, items]) => ({
          name: cat,
          cantidad: (items as Record<string, unknown>[]).length,
        }))
        if (chartData.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#10b981" radius={[4, 4, 0, 0]} />
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
      case 'lista-precios': {
        const isBoth = priceCurrency === 'both'
        const byCategory = report.byCategory || {}
        const categoryEntries = Object.entries(byCategory) as [string, Record<string, unknown>[]][]

        if (categoryEntries.length === 0) {
          return (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No hay productos activos para mostrar
              </CardContent>
            </Card>
          )
        }

        return (
          <div className="space-y-4">
            {categoryEntries.map(([catName, products]) => (
              <Card key={catName} className="overflow-hidden border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2 bg-emerald-50 dark:bg-emerald-900/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    {catName}
                    <Badge variant="secondary" className="ml-2">{products.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-emerald-600 hover:bg-emerald-600">
                          <TableHead className="text-white w-12">N°</TableHead>
                          <TableHead className="text-white">DESCRIPCION DE PRODUCTO</TableHead>
                          <TableHead className="text-white text-center w-20">UNIDAD</TableHead>
                          <TableHead className="text-white text-right w-28">Precio USD</TableHead>
                          {isBoth && (
                            <TableHead className="text-white text-right w-32">Precio Bs</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p: Record<string, unknown>, idx: number) => (
                          <TableRow key={p.id as string}>
                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{p.name as string}</TableCell>
                            <TableCell className="text-center text-muted-foreground text-xs">Unidad</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(p.salePrice as number)}
                            </TableCell>
                            {isBoth && (
                              <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                {(p.salePriceBs as number) > 0 ? formatBs(p.salePriceBs as number) : '-'}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
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
        <div className="flex gap-2 flex-wrap">
          {reportType === 'lista-precios' && (
            <div className="flex gap-1 mr-2">
              <Button
                size="sm"
                variant={priceCurrency === 'usd' ? 'default' : 'outline'}
                onClick={() => setPriceCurrency('usd')}
                className={priceCurrency === 'usd' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                Solo USD
              </Button>
              <Button
                size="sm"
                variant={priceCurrency === 'both' ? 'default' : 'outline'}
                onClick={() => setPriceCurrency('both')}
                className={priceCurrency === 'both' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                USD + Bs
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={exportToPDF} disabled={!report}>
            <FileDown className="w-4 h-4 mr-2" />
            {reportType === 'lista-precios' ? 'Imprimir Lista' : 'Exportar PDF'}
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
            {/* Date filters - hidden for price list */}
            {reportType !== 'lista-precios' && (
              <>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </>
            )}

            {/* Price list specific filters */}
            {reportType === 'lista-precios' && (
              <>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Select value={priceCurrency} onValueChange={(v) => setPriceCurrency(v as 'usd' | 'both')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">Solo USD</SelectItem>
                      <SelectItem value="both">USD y Bolívares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Categoría</Label>
                  <Select value={priceCategory} onValueChange={setPriceCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {(categories as Record<string, unknown>[] || []).map((cat: Record<string, unknown>) => (
                        <SelectItem key={cat.id as string} value={cat.id as string}>
                          {cat.name as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <div className="flex items-center space-x-2 bg-muted/50 px-3 py-2 rounded-lg border">
                    <Checkbox
                      id="watermark"
                      checked={showWatermark}
                      onCheckedChange={(checked) => setShowWatermark(checked as boolean)}
                    />
                    <Label htmlFor="watermark" className="text-xs flex items-center gap-1.5 cursor-pointer">
                      <Droplets className="w-3.5 h-3.5 text-blue-500" />
                      Marca de agua
                    </Label>
                  </div>
                </div>
              </>
            )}
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
