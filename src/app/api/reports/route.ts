import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function createDateRangeFilter(fromDate?: string | null, toDate?: string | null) {
  const dateFilter: Record<string, unknown> = {}

  if (fromDate) {
    const start = new Date(fromDate)
    start.setHours(0, 0, 0, 0)
    dateFilter.gte = start
  }

  if (toDate) {
    const end = new Date(toDate)
    end.setHours(23, 59, 59, 999)
    dateFilter.lte = end
  }

  return Object.keys(dateFilter).length ? dateFilter : undefined
}

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
    const rangeFilter = createDateRangeFilter(fromDate, toDate)
    if (rangeFilter) {
      dateFilter.date = rangeFilter
    }

    switch (type) {
      case 'ventas':
        return await handleVentasReport(dateFilter)
      case 'inventario':
        return await handleInventarioReport()
      case 'clientes':
        return await handleClientesReport()
      case 'estado-cuenta':
        return await handleEstadoCuentaReport(searchParams)
      case 'facturas-vencidas':
        return await handleFacturasVencidasReport(fromDate, toDate)
      case 'pagos':
        return await handlePagosReport(dateFilter)
      case 'transacciones-usuario':
        return await handleTransaccionesUsuarioReport(searchParams, dateFilter)
      case 'productos-vendidos':
        return await handleProductosVendidosReport(dateFilter)
      case 'ganancias':
        return await handleGananciasReport(dateFilter)
      case 'lista-precios':
        return await handleListaPreciosReport(searchParams)
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
    (sum, p) => sum + (p.averageCost || p.purchasePrice) * p.quantity,
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

async function handleEstadoCuentaReport(searchParams: URLSearchParams) {
  const includeZeroBalance = searchParams.get('includeZeroBalance') === 'true'
  const fromDate = searchParams.get('fromDate')
  const toDate = searchParams.get('toDate')
  const rangeFilter = createDateRangeFilter(fromDate, toDate)

  const invoiceWhere: Record<string, unknown> = {
    status: { not: 'ANULADA' },
  }

  const movementFilter = {
    OR: [
      { invoices: { some: { ...invoiceWhere, ...(rangeFilter ? { date: rangeFilter } : {}) } } },
      { transactions: { some: { ...(rangeFilter ? { date: rangeFilter } : {}) } } },
      { accountEntries: { some: { ...(rangeFilter ? { date: rangeFilter } : {}) } } },
    ],
  }

  const clientIds = rangeFilter
    ? (await db.client.findMany({
        where: movementFilter,
        select: { id: true },
      })).map((client) => client.id)
    : []

  const clientWhere = rangeFilter
    ? clientIds.length > 0
      ? { id: { in: clientIds } }
      : { id: { in: [] } }
    : movementFilter

  const clients = await db.client.findMany({
    where: clientWhere,
    include: {
      invoices: {
        where: invoiceWhere,
        select: {
          total: true,
          paymentMethod: true,
          accountEntries: {
            where: { type: 'ABONO' },
            select: { amount: true },
          },
        },
      },
      accountEntries: { select: { type: true, amount: true } },
      _count: { select: { invoices: true, transactions: true, accountEntries: true } },
    },
    orderBy: { name: 'asc' },
  })

  const invoiceCountMap = new Map<string, number>()
  const transactionCountMap = new Map<string, number>()
  const accountEntryCountMap = new Map<string, number>()

  if (rangeFilter && clientIds.length) {
    const invoicesInRange = await db.invoice.findMany({
      where: {
        clientId: { in: clientIds },
        ...invoiceWhere,
        date: rangeFilter,
      },
      select: { clientId: true },
    })
    invoicesInRange.forEach((invoice) => {
      invoiceCountMap.set(invoice.clientId, (invoiceCountMap.get(invoice.clientId) || 0) + 1)
    })

    const transactionsInRange = await db.transaction.findMany({
      where: {
        clientId: { in: clientIds },
        date: rangeFilter,
      },
      select: { clientId: true },
    })
    transactionsInRange.forEach((transaction) => {
      transactionCountMap.set(transaction.clientId, (transactionCountMap.get(transaction.clientId) || 0) + 1)
    })

    const accountEntriesInRange = await db.accountEntry.findMany({
      where: {
        clientId: { in: clientIds },
        date: rangeFilter,
      },
      select: { clientId: true },
    })
    accountEntriesInRange.forEach((entry) => {
      accountEntryCountMap.set(entry.clientId, (accountEntryCountMap.get(entry.clientId) || 0) + 1)
    })
  }

  const clientsWithComputedBalance = clients.map((c) => {
    const balanceFromClient = c.balance ?? 0
    const pendingInvoiceBalance = c.invoices.reduce((sum, invoice) => {
      const paidAmount = invoice.accountEntries.reduce((sub, entry) => sub + entry.amount, 0)
      const remaining = Math.max(0, invoice.total - paidAmount)
      return sum + remaining
    }, 0)

    const pendingNonCreditInvoices = c.invoices.reduce((sum, invoice) => {
      if (invoice.paymentMethod === 'CREDITO') return sum
      const paidAmount = invoice.accountEntries.reduce((sub, entry) => sub + entry.amount, 0)
      const remaining = Math.max(0, invoice.total - paidAmount)
      return sum + remaining
    }, 0)

    const missingCreditInvoiceBalance = Math.max(0, pendingInvoiceBalance - pendingNonCreditInvoices - balanceFromClient)
    const computedBalance = balanceFromClient + pendingNonCreditInvoices + missingCreditInvoiceBalance

    return {
      ...c,
      computedBalance,
      invoiceCount: rangeFilter ? invoiceCountMap.get(c.id) || 0 : c._count.invoices,
      transactionCount: rangeFilter ? transactionCountMap.get(c.id) || 0 : c._count.transactions,
      accountEntryCount: rangeFilter ? accountEntryCountMap.get(c.id) || 0 : c._count.accountEntries,
    }
  })

  const filteredClients = includeZeroBalance
    ? clientsWithComputedBalance
    : clientsWithComputedBalance.filter((c) => c.computedBalance !== 0)

  const clientsWithBalance = filteredClients.filter((c) => c.computedBalance !== 0)
  const totalBalanceOutstanding = filteredClients.reduce(
    (sum, c) => sum + c.computedBalance,
    0
  )

  return NextResponse.json({
    type: 'estado-cuenta',
    totalMovementClients: filteredClients.length,
    clientsWithBalanceCount: clientsWithBalance.length,
    totalBalanceOutstanding,
    clients: filteredClients.map((c) => ({
      id: c.id,
      name: c.name,
      balance: c.computedBalance,
      invoiceCount: c.invoiceCount,
      transactionCount: c.transactionCount,
      accountEntryCount: c.accountEntryCount,
    })),
  })
}

async function handleFacturasVencidasReport(fromDate?: string | null, toDate?: string | null) {
  const overdueFilter: Record<string, unknown> = { status: 'VENCIDA' }
  const dateFilter = createDateRangeFilter(fromDate, toDate)

  const overdueInvoices = await db.invoice.findMany({
    where: {
      ...overdueFilter,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
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

async function handleListaPreciosReport(searchParams: URLSearchParams) {
  const currency = searchParams.get('currency') || 'usd' // 'usd' or 'both'
  const categoryId = searchParams.get('category') || ''
  const clientId = searchParams.get('clientId') || ''

  const where: Record<string, unknown> = {
    status: 'ACTIVO',
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  const products = await db.product.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
    },
    orderBy: [
      { category: { name: 'asc' } },
      { name: 'asc' },
    ],
  })

  // Get current dollar rate
  let dollarRate = 0
  try {
    const todayRate = await db.dollarRate.findFirst({
      orderBy: { date: 'desc' },
    })
    if (todayRate) {
      dollarRate = todayRate.officialRate
    }
  } catch {
    // Rate not available
  }

  // Fetch client custom prices if clientId provided
  let clientPrices: Record<string, number> = {}
  let clientName: string | null = null
  if (clientId) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    })
    if (client) {
      clientName = client.name
      const prices = await db.clientPrice.findMany({
        where: { clientId },
        select: { productId: true, customPrice: true },
      })
      clientPrices = prices.reduce((acc, cp) => {
        acc[cp.productId] = cp.customPrice
        return acc
      }, {} as Record<string, number>)
    }
  }

  // Build product data with optional custom prices
  const productData = products.map((p) => {
    const customPrice = clientPrices[p.id]
    const effectivePrice = customPrice !== undefined ? customPrice : p.salePrice
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      salePrice: effectivePrice,
      salePriceBs: dollarRate > 0 ? effectivePrice * dollarRate : 0,
      normalPrice: p.salePrice,
      normalPriceBs: dollarRate > 0 ? p.salePrice * dollarRate : 0,
      hasCustomPrice: customPrice !== undefined,
      quantity: p.quantity,
      category: p.category?.name || 'Sin categoría',
      unit: p.unitOfMeasure || 'UNIDAD',
    }
  })

  // Group by category
  const byCategory = productData.reduce(
    (acc, p) => {
      const catName = p.category
      if (!acc[catName]) {
        acc[catName] = []
      }
      acc[catName].push(p)
      return acc
    },
    {} as Record<string, typeof productData>
  )

  return NextResponse.json({
    type: 'lista-precios',
    currency,
    dollarRate,
    totalProducts: products.length,
    categories: Object.keys(byCategory).length,
    clientName,
    clientId: clientId || null,
    products: productData,
    byCategory,
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
      product: { select: { id: true, name: true, purchasePrice: true, averageCost: true } },
    },
  })

  let totalRevenue = 0
  let totalCost = 0

  invoiceItems.forEach((item) => {
    totalRevenue += item.subtotal
    // Use averageCost if available, otherwise fall back to purchasePrice
    const costPerUnit = item.product.averageCost || item.product.purchasePrice
    totalCost += costPerUnit * item.quantity
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
