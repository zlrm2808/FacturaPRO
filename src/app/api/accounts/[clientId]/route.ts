import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const { id: clientId } = await params

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

    // Get pending invoices
    const pendingInvoices = await db.invoice.findMany({
      where: {
        clientId,
        status: { in: ['PENDIENTE', 'VENCIDA'] },
      },
      orderBy: { date: 'desc' },
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

    const pendingInvoicesTotal = pendingInvoices.reduce(
      (sum, inv) => sum + inv.total,
      0
    )

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
        currentBalance: client.balance,
        totalCreditos,
        totalDebitos,
        totalAbonos,
        pendingInvoicesCount: pendingInvoices.length,
        pendingInvoicesTotal,
      },
      pendingInvoices,
    })
  } catch (error) {
    console.error('Account statement GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
