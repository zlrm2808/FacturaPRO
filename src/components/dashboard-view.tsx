'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDate, formatDateTime, getStatusColor, getPaymentMethodLabel } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import {
  TrendingUp,
  Users,
  Package,
  FileText,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  ShoppingCart,
} from 'lucide-react'
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
} from 'recharts'

const CHART_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e']

interface DashboardData {
  salesToday: number
  salesTodayBs: number
  salesTodayCount: number
  salesThisWeek: number
  salesThisWeekBs: number
  salesThisMonth: number
  salesThisMonthBs: number
  totalClients: number
  totalProducts: number
  lowStockCount: number
  pendingInvoices: number
  overdueInvoices: number
  dollarRate: number
  parallelRate: number
  recentTransactions: {
    id: string
    amount: number
    amountBs: number
    dollarRate: number
    paymentMethod: string
    date: string
    user: { name: string }
    client: { id: string; name: string } | null
  }[]
  topSellingProducts: {
    name: string
    code: string
    totalQuantity: number
    totalRevenue: number
  }[]
  revenueChartData: {
    date: string
    revenue: number
    revenueBs: number
    count: number
  }[]
}

function StatCard({
  title,
  value,
  valueBs,
  subtitle,
  icon: Icon,
  iconBg,
  loading,
  onClick,
}: {
  title: string
  value: string
  valueBs?: string
  subtitle?: string
  icon: React.ElementType
  iconBg: string
  loading?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      className={`relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight">{value}</p>
                {valueBs && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{valueBs}</p>
                )}
              </>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-28" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function DashboardView() {
  const { setCurrentPage, setSelectedClientId, setLowStockFilterActive } = useAppStore()

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard'),
    refetchInterval: 60000,
  })

  if (isLoading) return <DashboardSkeleton />
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <p className="text-lg font-medium">Error al cargar el dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error).message || 'Intente recargar la página'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  // Prepare bar chart data
  const barChartData = data.revenueChartData.map((item) => {
    const d = new Date(item.date)
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    return {
      name: dayNames[d.getDay()] + ' ' + d.getDate(),
      Ventas: item.revenue,
      VentasBs: item.revenueBs,
      Facturas: item.count,
    }
  })

  // Prepare pie chart data from recent transactions
  const paymentMethods: Record<string, number> = {}
  data.recentTransactions.forEach((t) => {
    const label = getPaymentMethodLabel(t.paymentMethod)
    paymentMethods[label] = (paymentMethods[label] || 0) + t.amount
  })
  const pieChartData = Object.entries(paymentMethods).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del sistema</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Dollar Rate Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Oficial: {data.dollarRate > 0 ? `Bs. ${data.dollarRate.toFixed(2)}` : 'N/A'}
              </span>
              <span className="mx-1.5 text-muted-foreground">|</span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                Paralelo: {data.parallelRate > 0 ? `Bs. ${data.parallelRate.toFixed(2)}` : 'N/A'}
              </span>
            </div>
          </div>
          <Button
            onClick={() => setCurrentPage('pos')}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 self-start"
          >
            <ShoppingCart className="h-4 w-4" />
            Nueva Venta
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas Hoy"
          value={formatCurrency(data.salesToday)}
          valueBs={data.salesTodayBs > 0 ? formatBs(data.salesTodayBs) : undefined}
          subtitle={`${data.salesTodayCount} facturas`}
          icon={TrendingUp}
          iconBg="bg-emerald-500"
          onClick={() => setCurrentPage('reports')}
        />
        <StatCard
          title="Clientes Totales"
          value={data.totalClients.toLocaleString()}
          icon={Users}
          iconBg="bg-teal-500"
          onClick={() => setCurrentPage('clients')}
        />
        <StatCard
          title="Productos en Stock"
          value={data.totalProducts.toLocaleString()}
          subtitle={data.lowStockCount > 0 ? `${data.lowStockCount} con stock bajo` : undefined}
          icon={Package}
          iconBg="bg-cyan-500"
          onClick={() => setCurrentPage('inventory')}
        />
        <StatCard
          title="Facturas Pendientes"
          value={data.pendingInvoices.toString()}
          subtitle={data.overdueInvoices > 0 ? `${data.overdueInvoices} vencidas` : undefined}
          icon={FileText}
          iconBg="bg-amber-500"
          onClick={() => setCurrentPage('overdue')}
        />
      </div>

      {/* Sales Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setCurrentPage('reports')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Venta Semanal</p>
              <p className="text-lg font-bold">{formatCurrency(data.salesThisWeek)}</p>
              {data.salesThisWeekBs > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatBs(data.salesThisWeekBs)}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setCurrentPage('reports')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Venta Mensual</p>
              <p className="text-lg font-bold">{formatCurrency(data.salesThisMonth)}</p>
              {data.salesThisMonthBs > 0 && (
                <p className="text-xs text-teal-600 dark:text-teal-400">{formatBs(data.salesThisMonthBs)}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setLowStockFilterActive(true)
            setCurrentPage('inventory')
          }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Stock Bajo</p>
              <p className="text-lg font-bold">{data.lowStockCount} productos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas últimos 7 días</CardTitle>
            <CardDescription>Ingresos diarios (USD)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'VentasBs') return [formatBs(value), 'Bs.']
                      return [formatCurrency(value), 'USD']
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métodos de Pago</CardTitle>
            <CardDescription>Distribución por método de pago reciente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Monto']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay datos de pagos recientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Últimas Transacciones</CardTitle>
                <CardDescription>Transacciones recientes del sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay transacciones recientes
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Fecha</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Monto</th>
                      <th className="text-right py-2 font-medium text-muted-foreground hidden sm:table-cell">Bs.</th>
                      <th className="text-left py-2 font-medium text-muted-foreground hidden md:table-cell">Método</th>
                      <th className="text-left py-2 font-medium text-muted-foreground hidden lg:table-cell">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTransactions.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (t.client) {
                            setSelectedClientId(t.client.id)
                            setCurrentPage('accounts')
                          }
                        }}
                      >
                        <td className="py-2.5 text-xs">{formatDate(t.date)}</td>
                        <td className="py-2.5 text-xs font-medium">
                          {t.client?.name || 'Consumidor'}
                        </td>
                        <td className="py-2.5 text-xs font-semibold text-right">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="py-2.5 text-xs font-semibold text-right hidden sm:table-cell text-emerald-600 dark:text-emerald-400">
                          {t.amountBs > 0 ? formatBs(t.amountBs) : '-'}
                        </td>
                        <td className="py-2.5 hidden md:table-cell">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {getPaymentMethodLabel(t.paymentMethod)}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                          {t.user.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Productos Más Vendidos</CardTitle>
                <CardDescription>Top 5 productos por cantidad</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 gap-1"
                onClick={() => setCurrentPage('inventory')}
              >
                Ver Todo <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.topSellingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay datos de ventas aún
              </p>
            ) : (
              <div className="space-y-3">
                {data.topSellingProducts.map((product, i) => (
                  <div
                    key={product.code}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white flex-shrink-0 ${
                          i === 0
                            ? 'bg-amber-500'
                            : i === 1
                            ? 'bg-gray-400'
                            : i === 2
                            ? 'bg-amber-700'
                            : 'bg-muted-foreground/30'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.code}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(product.totalRevenue)}</p>
                      {data.dollarRate > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          {formatBs(product.totalRevenue * data.dollarRate)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{product.totalQuantity} uds</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {data.lowStockCount > 0 && (
        <Card className="border-amber-200 dark:border-amber-800/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base text-amber-700 dark:text-amber-400">
                Alerta de Stock Bajo
              </CardTitle>
              <Badge variant="outline" className="ml-auto border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                {data.lowStockCount} producto{data.lowStockCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            <CardDescription>
              Productos con cantidad igual o menor al stock mínimo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LowStockProducts />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function LowStockProducts() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', 'lowStock'],
    queryFn: () => api.get('/products?lowStock=true'),
  })
  const { setCurrentPage, setLowStockFilterActive } = useAppStore()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) return null

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {products.map((product: any) => (
        <div
          key={product.id}
          className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
          onClick={() => {
            setLowStockFilterActive(true)
            setCurrentPage('inventory')
          }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.code}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              variant="outline"
              className={
                product.quantity === 0
                  ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                  : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
              }
            >
              {product.quantity === 0 ? 'Agotado' : `${product.quantity} uds`}
            </Badge>
            <span className="text-xs text-muted-foreground">min: {product.minStock}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
