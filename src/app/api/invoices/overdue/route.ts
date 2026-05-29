import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/invoices/overdue - Get all overdue/vencida invoices grouped by client
// Also includes PENDIENTE invoices older than 30 days (auto-mark as vencida concept)
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get all VENCIDA invoices + PENDIENTE invoices older than 30 days
    const overdueInvoices = await db.invoice.findMany({
      where: {
        OR: [
          { status: 'VENCIDA' },
          {
            status: 'PENDIENTE',
            date: { lte: thirtyDaysAgo },
          },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    // Group invoices by client
    const clientMap = new Map<string, {
      client: { id: string; name: string; phone: string | null; email: string | null }
      invoices: typeof overdueInvoices
      totalOverdue: number
    }>()

    for (const invoice of overdueInvoices) {
      const clientId = invoice.clientId || 'SIN_CLIENTE'
      const clientInfo = invoice.client || { id: 'SIN_CLIENTE', name: 'Sin Cliente', phone: null, email: null }

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client: clientInfo,
          invoices: [],
          totalOverdue: 0,
        })
      }

      const group = clientMap.get(clientId)!
      group.invoices.push(invoice)
      group.totalOverdue += invoice.total
    }

    // Convert map to array
    const result = Array.from(clientMap.values())

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error getting overdue invoices:', error)
    return NextResponse.json({ error: 'Error al obtener facturas vencidas' }, { status: 500 })
  }
}
