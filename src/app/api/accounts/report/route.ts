import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const nonZeroOnly = searchParams.get('nonZeroOnly') === 'true'

    // Fetch clients
    const clients = await db.client.findMany({
      include: {
        accountEntries: true,
        invoices: {
          include: {
            accountEntries: {
              where: { type: 'ABONO' },
              select: { amount: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const report = clients.map((client) => {
      const totalAbonos = client.accountEntries.filter((e) => e.type === 'ABONO').reduce((s, e) => s + e.amount, 0)
      const totalCreditos = client.accountEntries.filter((e) => e.type === 'CREDITO').reduce((s, e) => s + e.amount, 0)
      const invoices = client.invoices.map((inv) => {
        const paid = inv.accountEntries.reduce((s, a) => s + a.amount, 0)
        const remaining = Math.max(0, inv.total - paid)
        return { id: inv.id, number: inv.number, total: inv.total, paid, remaining, status: inv.status }
      })
      const totalInvoices = invoices.reduce((s, i) => s + i.total, 0)
      const totalInvoicesPaid = invoices.reduce((s, i) => s + i.paid, 0)
      const totalInvoicesRemaining = invoices.reduce((s, i) => s + i.remaining, 0)

      return {
        clientId: client.id,
        name: client.name,
        balance: client.balance,
        totalAbonos,
        totalCreditos,
        totalInvoices,
        totalInvoicesPaid,
        totalInvoicesRemaining,
        invoices,
      }
    })

    const filtered = nonZeroOnly ? report.filter((r) => r.balance !== 0) : report

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Accounts report GET error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
