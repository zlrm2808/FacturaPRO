import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function calcDaysOverdue(dateStr: string | Date, creditDays: number = 0): number {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + creditDays)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
}

// GET /api/invoices/overdue - Get all overdue/vencida invoices grouped by client
// Also includes PENDIENTE invoices older than their credit days
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Get all PENDIENTE + VENCIDA invoices
    const allPendingOrOverdue = await db.invoice.findMany({
      where: {
        status: { in: ['PENDIENTE', 'VENCIDA'] },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            balance: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    const now = new Date()
    const invoicesToShow = allPendingOrOverdue.map((invoice) => {
      const isNonCreditPending = invoice.status === 'PENDIENTE' && invoice.paymentMethod !== 'CREDITO'
      const dueDate = new Date(invoice.date)
      dueDate.setDate(dueDate.getDate() + (invoice.creditDays || 0))
      const isCreditOverdue = invoice.status === 'PENDIENTE' && invoice.paymentMethod === 'CREDITO' && dueDate <= now
      const isOverdue = invoice.status === 'VENCIDA' || isNonCreditPending || isCreditOverdue
      const effectiveStatus = isOverdue ? 'VENCIDA' : 'PENDIENTE'
      const daysOverdue = calcDaysOverdue(invoice.date, invoice.creditDays || 0)

      return {
        invoice,
        isOverdue,
        effectiveStatus,
        daysOverdue,
      }
    })

    const clientMap = new Map<string, {
      client: { id: string; name: string; phone: string | null; email: string | null; balance: number }
      invoices: any[]
      totalBalance: number
      totalBalanceBs: number
    }>()

    for (const item of invoicesToShow) {
      const invoice = item.invoice
      const clientId = invoice.clientId || 'SIN_CLIENTE'
      const clientInfo = invoice.client || { id: 'SIN_CLIENTE', name: 'Sin Cliente', phone: null, email: null, balance: 0 }

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client: clientInfo,
          invoices: [],
          totalBalance: 0,
          totalBalanceBs: 0,
        })
      }

      const group = clientMap.get(clientId)!
      group.invoices.push({
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        total: invoice.total,
        totalBs: invoice.totalBs,
        dollarRate: invoice.dollarRate,
        status: invoice.status,
        paymentMethod: invoice.paymentMethod,
        clientId: invoice.clientId,
        daysOverdue: item.daysOverdue,
        isOverdue: item.isOverdue,
        effectiveStatus: item.effectiveStatus,
      })
      group.totalBalance += invoice.total
      group.totalBalanceBs += invoice.totalBs
    }

    // Convert map to array
    const clients = Array.from(clientMap.values())

    // Build summary
    const overdueAmounts = clients.flatMap((group) => group.invoices.filter((inv) => inv.isOverdue))
    const summary = {
      totalOverdueAmount: overdueAmounts.reduce((sum, invoice) => sum + invoice.total, 0),
      totalOverdueAmountBs: overdueAmounts.reduce((sum, invoice) => sum + invoice.totalBs, 0),
      totalInvoiceCount: clients.reduce((sum, c) => sum + c.invoices.length, 0),
      totalClientsWithDebt: clients.length,
    }

    return NextResponse.json({ clients, summary })
  } catch (error) {
    console.error('Error getting overdue invoices:', error)
    return NextResponse.json({ error: 'Error al obtener facturas vencidas' }, { status: 500 })
  }
}
