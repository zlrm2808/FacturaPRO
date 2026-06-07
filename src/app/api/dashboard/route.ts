import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getEffectiveDollarRate } from '@/lib/dollar-rate'

export async function GET(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const now = new Date()

    // Today boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    // Week boundaries (start of week = Monday)
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - mondayOffset)
    const weekEnd = new Date(todayEnd)

    // Month boundaries
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Get today's dollar rate
    const dollarRateInfo = await getEffectiveDollarRate(now)
    const dollarRate = dollarRateInfo.officialRate
    const parallelRate = dollarRateInfo.parallelRate

    // Sales totals
    const [
      salesToday,
      salesThisWeek,
      salesThisMonth,
      totalClients,
      totalProducts,
      activeProducts,
      pendingInvoices,
      overdueInvoices,
      recentTransactions,
      topSellingProducts,
      revenueChartData,
    ] = await Promise.all([
      // Sales today
      db.invoice.aggregate({
        _sum: { total: true, totalBs: true },
        _count: true,
        where: {
          date: { gte: todayStart, lt: todayEnd },
          status: { not: 'ANULADA' },
        },
      }),

      // Sales this week
      db.invoice.aggregate({
        _sum: { total: true, totalBs: true },
        where: {
          date: { gte: weekStart, lt: weekEnd },
          status: { not: 'ANULADA' },
        },
      }),

      // Sales this month
      db.invoice.aggregate({
        _sum: { total: true, totalBs: true },
        where: {
          date: { gte: monthStart, lt: monthEnd },
          status: { not: 'ANULADA' },
        },
      }),

      // Total clients
      db.client.count(),

      // Total products
      db.product.count(),

      // Active products (for low stock calculation)
      db.product.findMany({
        where: { status: 'ACTIVO' },
        select: { id: true, quantity: true, minStock: true },
      }),

      // Pending invoices
      db.invoice.count({ where: { status: 'PENDIENTE' } }),

      // All pending/overdue invoices to count overdue dynamically
      db.invoice.findMany({
        where: { status: { in: ['PENDIENTE', 'VENCIDA'] } },
        select: { id: true, status: true, paymentMethod: true, date: true, creditDays: true },
      }),

      // Recent transactions (last 5)
      db.transaction.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          user: { select: { name: true } },
          client: { select: { id: true, name: true } },
        },
      }),

      // Top selling products (last 5)
      getTopSellingProducts(),

      // Revenue chart data (last 7 days)
      getRevenueChartData(todayStart),
    ])

    const lowStockCount = activeProducts.filter(
      (p) => p.quantity <= p.minStock
    ).length

    const overdueInvoicesCount = overdueInvoices.filter((invoice) => {
      if (invoice.status === 'VENCIDA') return true
      if (invoice.status === 'PENDIENTE' && invoice.paymentMethod === 'CREDITO') {
        const dueDate = new Date(invoice.date)
        dueDate.setDate(dueDate.getDate() + (invoice.creditDays || 0))
        return dueDate <= now
      }
      return false
    }).length

    return NextResponse.json({
      salesToday: salesToday._sum.total || 0,
      salesTodayBs: salesToday._sum.totalBs || 0,
      salesTodayCount: salesToday._count,
      salesThisWeek: salesThisWeek._sum.total || 0,
      salesThisWeekBs: salesThisWeek._sum.totalBs || 0,
      salesThisMonth: salesThisMonth._sum.total || 0,
      salesThisMonthBs: salesThisMonth._sum.totalBs || 0,
      totalClients,
      totalProducts,
      lowStockCount,
      pendingInvoices,
      overdueInvoices: overdueInvoicesCount,
      recentTransactions,
      topSellingProducts,
      revenueChartData,
      dollarRate,
      parallelRate,
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

async function getTopSellingProducts() {
  const invoiceItems = await db.invoiceItem.findMany({
    where: {
      invoice: { status: { not: 'ANULADA' } },
    },
    include: {
      product: { select: { name: true, code: true } },
    },
  })

  const productSales = invoiceItems.reduce(
    (acc, item) => {
      const productId = item.productId
      if (!acc[productId]) {
        acc[productId] = {
          name: item.product.name,
          code: item.product.code,
          totalQuantity: 0,
          totalRevenue: 0,
        }
      }
      acc[productId].totalQuantity += item.quantity
      acc[productId].totalRevenue += item.subtotal
      return acc
    },
    {} as Record<string, { name: string; code: string; totalQuantity: number; totalRevenue: number }>
  )

  return Object.values(productSales)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 5)
}

async function getRevenueChartData(todayStart: Date) {
  const chartData = []

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const result = await db.invoice.aggregate({
      _sum: { total: true, totalBs: true },
      _count: true,
      where: {
        date: { gte: dayStart, lt: dayEnd },
        status: { not: 'ANULADA' },
      },
    })

    chartData.push({
      date: dayStart.toISOString().split('T')[0],
      revenue: result._sum.total || 0,
      revenueBs: result._sum.totalBs || 0,
      count: result._count,
    })
  }

  return chartData
}
