import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    if (!type) {
      return NextResponse.json(
        { error: 'type es requerido' },
        { status: 400 }
      )
    }

    const dateFilter: Record<string, unknown> = {}
    if (fromDate || toDate) {
      dateFilter.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const createdAtFilter: Record<string, unknown> = {}
    if (fromDate || toDate) {
      createdAtFilter.createdAt = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    switch (type) {
      case 'ventas':
        return await handleVentasReport(dateFilter)
      case 'inventario':
        return await handleInventarioReport()
      case 'clientes':
        return await handleClientesReport()
      case 'facturas-vencidas':
        return await handleFacturasVencidasReport()
      case 'pagos':
        return await handlePagosReport(dateFilter)
      case 'transacciones-usuario':
        return await handleTransaccionesUsuarioReport(searchParams, dateFilter)
      case 'productos-vendidos':
        return await handleProductosVendidosReport(dateFilter)
      case 'ganancias':
        return await handleGananciasReport(dateFilter)
      default:
        return NextResponse.json(
          { error: 'Tipo de reporte inválido' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Reports GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

async function handleVentasReport(dateFilter: Record<string, unknown>) {
  const invoices = await db.invoice.findMany({
    where: {
      ...dateFilter,
      status: { not: 'ANULADA' },
    },
    include: {
      client: { select: { name: true } },
    },
  })

  const totalInvoices = invoices.length
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0)
  const totalTax = invoices.reduce((sum, inv) => sum + inv.tax, 0)
  const totalDiscount = invoices.reduce((sum, inv) => sum + inv.discount, 0)

  // By payment method
  const byPaymentMethod = invoices.reduce(
    (acc, inv) => {
      const method = inv.paymentMethod
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 }
      }
      acc[method].count += 1
      acc[method].total += inv.total
      return acc
    },
    {} as Record<string, { count: number; total: number }>
  )

  // By status
  const byStatus = invoices.reduce(
    (acc, inv) => {
      const status = inv.status
      if (!acc[status]) {
        acc[status] = { count: 0, total: 0 }
      }
      acc[status].count += 1
      acc[status].total += inv.total
      return acc
    },
    {} as Record<string, { count: number; total: number }>
  )

  return NextResponse.json({
    type: 'ventas',
    totalInvoices,
    totalAmount,
    totalTax,
    totalDiscount,
    byPaymentMethod,
    byStatus,
    invoices,
  })
}

async function handleInventarioReport() {
  const products = await db.product.findMany({
    include: {
      category: { select: { id: true, name: true } },
    },
  })

  const totalProducts = products.length
  const lowStockItems = products.filter((p) => p.quantity <= p.minStock)
  const totalValue = products.reduce(
    (sum, p) => sum + p.salePrice * p.quantity,
    0
  )
  const totalCostValue = products.reduce(
    (sum, p) => sum + p.purchasePrice * p.quantity,
    0
  )

  // By category
  const byCategory = products.reduce(
    (acc, p) => {
      const catName = p.category?.name || 'Sin categoría'
      if (!acc[catName]) {
        acc[catName] = { count: 0, totalValue: 0, totalQuantity: 0 }
      }
      acc[catName].count += 1
      acc[catName].totalValue += p.salePrice * p.quantity
      acc[catName].totalQuantity += p.quantity
      return acc
    },
    {} as Record<string, { count: number; totalValue: number; totalQuantity: number }>
  )

  return NextResponse.json({
    type: 'inventario',
    totalProducts,
    lowStockCount: lowStockItems.length,
    totalValue,
    totalCostValue,
    byCategory,
    lowStockItems: lowStockItems.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      quantity: p.quantity,
      minStock: p.minStock,
      category: p.category?.name,
    })),
  })
}

async function handleClientesReport() {
  const clients = await db.client.findMany({
    include: {
      _count: { select: { invoices: true } },
    },
  })

  const totalClients = clients.length
  const clientsWithBalance = clients.filter((c) => c.balance > 0)
  const totalBalanceOutstanding = clients.reduce(
    (sum, c) => sum + c.balance,
    0
  )

  return NextResponse.json({
    type: 'clientes',
    totalClients,
    clientsWithBalanceCount: clientsWithBalance.length,
    totalBalanceOutstanding,
    clientsWithBalance: clientsWithBalance.map((c) => ({
      id: c.id,
      name: c.name,
      balance: c.balance,
      invoiceCount: c._count.invoices,
    })),
  })
}

async function handleFacturasVencidasReport() {
  const overdueInvoices = await db.invoice.findMany({
    where: { status: 'VENCIDA' },
    include: {
      client: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  })

  const totalOverdue = overdueInvoices.reduce(
    (sum, inv) => sum + inv.total,
    0
  )

  return NextResponse.json({
    type: 'facturas-vencidas',
    count: overdueInvoices.length,
    totalOverdue,
    invoices: overdueInvoices,
  })
}

async function handlePagosReport(dateFilter: Record<string, unknown>) {
  const transactions = await db.transaction.findMany({
    where: dateFilter,
    include: {
      client: { select: { name: true } },
      user: { select: { name: true } },
    },
  })

  const totalPayments = transactions.reduce(
    (sum, t) => sum + t.amount,
    0
  )

  const byMethod = transactions.reduce(
    (acc, t) => {
      const method = t.paymentMethod
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 }
      }
      acc[method].count += 1
      acc[method].total += t.amount
      return acc
    },
    {} as Record<string, { count: number; total: number }>
  )

  return NextResponse.json({
    type: 'pagos',
    totalPayments,
    count: transactions.length,
    byMethod,
    transactions,
  })
}

async function handleTransaccionesUsuarioReport(
  searchParams: URLSearchParams,
  dateFilter: Record<string, unknown>
) {
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json(
      { error: 'userId es requerido para este reporte' },
      { status: 400 }
    )
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, role: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'Usuario no encontrado' },
      { status: 404 }
    )
  }

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      ...dateFilter,
    },
    include: {
      client: { select: { name: true } },
      invoice: { select: { number: true } },
    },
    orderBy: { date: 'desc' },
  })

  const totalAmount = transactions.reduce(
    (sum, t) => sum + t.amount,
    0
  )

  const byMethod = transactions.reduce(
    (acc, t) => {
      const method = t.paymentMethod
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 }
      }
      acc[method].count += 1
      acc[method].total += t.amount
      return acc
    },
    {} as Record<string, { count: number; total: number }>
  )

  return NextResponse.json({
    type: 'transacciones-usuario',
    user,
    totalAmount,
    count: transactions.length,
    byMethod,
    transactions,
  })
}

async function handleProductosVendidosReport(dateFilter: Record<string, unknown>) {
  const invoiceDateFilter: Record<string, unknown> = {}
  if (dateFilter.date) {
    invoiceDateFilter.date = dateFilter.date
  }

  const invoiceItems = await db.invoiceItem.findMany({
    where: {
      invoice: {
        ...invoiceDateFilter,
        status: { not: 'ANULADA' },
      },
    },
    include: {
      product: { select: { id: true, name: true, code: true, salePrice: true } },
    },
  })

  // Aggregate by product
  const productSales = invoiceItems.reduce(
    (acc, item) => {
      const productId = item.productId
      if (!acc[productId]) {
        acc[productId] = {
          product: item.product,
          totalQuantity: 0,
          totalRevenue: 0,
        }
      }
      acc[productId].totalQuantity += item.quantity
      acc[productId].totalRevenue += item.subtotal
      return acc
    },
    {} as Record<string, { product: { id: string; name: string; code: string; salePrice: number }; totalQuantity: number; totalRevenue: number }>
  )

  // Sort by totalQuantity desc
  const topProducts = Object.values(productSales).sort(
    (a, b) => b.totalQuantity - a.totalQuantity
  )

  return NextResponse.json({
    type: 'productos-vendidos',
    topProducts,
  })
}

async function handleGananciasReport(dateFilter: Record<string, unknown>) {
  const invoiceDateFilter: Record<string, unknown> = {}
  if (dateFilter.date) {
    invoiceDateFilter.date = dateFilter.date
  }

  const invoiceItems = await db.invoiceItem.findMany({
    where: {
      invoice: {
        ...invoiceDateFilter,
        status: { not: 'ANULADA' },
      },
    },
    include: {
      product: { select: { id: true, name: true, purchasePrice: true } },
    },
  })

  let totalRevenue = 0
  let totalCost = 0

  invoiceItems.forEach((item) => {
    totalRevenue += item.subtotal
    totalCost += item.product.purchasePrice * item.quantity
  })

  const profit = totalRevenue - totalCost
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

  return NextResponse.json({
    type: 'ganancias',
    totalRevenue,
    totalCost,
    profit,
    profitMargin: Math.round(profitMargin * 100) / 100,
  })
}
