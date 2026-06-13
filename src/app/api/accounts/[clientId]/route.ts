import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const { clientId } = await params

    const client = await db.client.findUnique({
      where: { id: clientId },
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Get all account entries for this client
    const entries = await db.accountEntry.findMany({
      where: { clientId },
      include: {
        user: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true, status: true } },
      },
      orderBy: { date: 'desc' },
    })

    // Get all invoices for this client (with their ABONO entries to compute paid/remaining)
    const allInvoices = await db.invoice.findMany({
      where: { clientId },
      include: {
        accountEntries: {
          where: { type: 'ABONO' },
          select: { amount: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    const invoicesWithBalances = allInvoices.map((inv) => {
      // For annulled invoices, report all amounts as zero and ignore abonos
      if (inv.status === 'ANULADA') {
        return {
          id: inv.id,
          number: inv.number,
          date: inv.date,
          status: inv.status,
          total: 0,
          paidAmount: 0,
          remainingAmount: 0,
        }
      }

      const paidAmount = inv.accountEntries.reduce((sum, entry) => sum + entry.amount, 0)
      const remainingAmount = Math.max(0, inv.total - paidAmount)
      return {
        id: inv.id,
        number: inv.number,
        date: inv.date,
        status: inv.status,
        paymentMethod: inv.paymentMethod,
        total: inv.total,
        paidAmount,
        remainingAmount,
      }
    })

    // Calculate totals
    const totalCreditos = entries
      .filter((e) => e.type === 'CREDITO')
      .reduce((sum, e) => sum + e.amount, 0)
    const totalDebitos = entries
      .filter((e) => e.type === 'DEBITO')
      .reduce((sum, e) => sum + e.amount, 0)
    const totalAbonos = entries
      .filter((e) => e.type === 'ABONO')
      .reduce((sum, e) => sum + e.amount, 0)

    const pendingInvoicesTotal = invoicesWithBalances
      .filter((i) => i.status === 'PENDIENTE' || i.status === 'VENCIDA')
      .reduce((sum, inv) => sum + inv.remainingAmount, 0)

    const pendingNonCreditInvoicesTotal = invoicesWithBalances
      .filter((i) => i.status === 'PENDIENTE' || i.status === 'VENCIDA')
      .filter((i) => i.paymentMethod !== 'CREDITO')
      .reduce((sum, inv) => sum + inv.remainingAmount, 0)

    const balanceFromClient = client.balance ?? 0
    const missingCreditInvoiceBalance = Math.max(0, pendingInvoicesTotal - pendingNonCreditInvoicesTotal - balanceFromClient)
    const currentBalance = balanceFromClient + pendingNonCreditInvoicesTotal + missingCreditInvoiceBalance

    const totalInvoicesAmount = invoicesWithBalances.reduce((sum, inv) => sum + (inv.total || 0), 0)
    const totalInvoicesPaid = invoicesWithBalances.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
    const totalInvoicesRemaining = invoicesWithBalances.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0)

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        address: client.address,
        rncCedula: client.rncCedula,
        balance: client.balance,
      },
      entries,
      summary: {
        currentBalance,
        totalCreditos,
        totalDebitos,
        totalAbonos,
        pendingInvoicesCount: invoicesWithBalances.filter((i) => i.status === 'PENDIENTE' || i.status === 'VENCIDA').length,
        pendingInvoicesTotal,
        totalInvoicesAmount,
        totalInvoicesPaid,
        totalInvoicesRemaining,
      },
      invoices: invoicesWithBalances,
    })
  } catch (error) {
    console.error('Account statement GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
