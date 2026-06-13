import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getEffectiveDollarRate } from '@/lib/dollar-rate'

export async function POST(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }

    const body = await request.json()
    const { entryId, invoiceId, amount } = body

    if (!entryId || !invoiceId || !amount) {
      return NextResponse.json(
        { error: 'entryId, invoiceId y amount son requeridos' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser mayor a 0' },
        { status: 400 }
      )
    }

    const entry = await db.accountEntry.findUnique({
      where: { id: entryId },
      include: { client: true },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 })
    }

    if (entry.type !== 'ABONO') {
      return NextResponse.json({ error: 'Solo se pueden asignar abonos a facturas' }, { status: 400 })
    }

    if (entry.invoiceId) {
      return NextResponse.json({ error: 'Este abono ya está asociado a una factura' }, { status: 400 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        accountEntries: {
          where: { type: 'ABONO' },
          select: { amount: true },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.clientId !== entry.clientId) {
      return NextResponse.json(
        { error: 'La factura no corresponde al mismo cliente del abono' },
        { status: 400 }
      )
    }

    if (invoice.status === 'ANULADA') {
      return NextResponse.json({ error: 'No se puede asignar un abono a una factura anulada' }, { status: 400 })
    }

    const paidAmount = invoice.accountEntries.reduce((sum, item) => sum + item.amount, 0)
    const remainingAmount = Math.max(0, invoice.total - paidAmount)

    if (remainingAmount <= 0) {
      return NextResponse.json({ error: 'La factura ya está pagada' }, { status: 400 })
    }

    const assignAmount = Math.min(amount, remainingAmount, entry.amount)
    const leftoverAmount = entry.amount - assignAmount

    const dollarRateInfo = await getEffectiveDollarRate(new Date())
    const dollarRate = dollarRateInfo.officialRate

    const assignedEntry = await db.$transaction(async (tx) => {
      const updatedEntry = await tx.accountEntry.update({
        where: { id: entryId },
        data: {
          amount: assignAmount,
          amountBs: assignAmount * dollarRate,
          dollarRate,
          invoiceId,
          description: entry.description
            ? `${entry.description} - Aplicado a factura ${invoice.number}`
            : `Abono aplicado a factura ${invoice.number}`,
        },
      })

      if (leftoverAmount > 0) {
        await tx.accountEntry.create({
          data: {
            clientId: entry.clientId,
            type: 'ABONO',
            amount: leftoverAmount,
            amountBs: leftoverAmount * dollarRate,
            dollarRate,
            description: `Saldo a favor restante de abono de factura ${invoice.number}`,
            invoiceId: null,
            userId: payload.userId,
          },
        })
      }


      if (assignAmount >= remainingAmount && invoice.status !== 'PAGADA') {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: 'PAGADA' },
        })
      }

      // Recompute client balance after assignment
      const allEntries = await tx.accountEntry.findMany({ where: { clientId: entry.clientId }, select: { type: true, amount: true } })
      const computedBalance = allEntries.reduce((sum, e) => sum + (e.type === 'CREDITO' ? e.amount : -e.amount), 0)
      await tx.client.update({ where: { id: entry.clientId }, data: { balance: computedBalance } })

      return updatedEntry
    })

    return NextResponse.json({ entry: assignedEntry }, { status: 200 })
  } catch (error) {
    console.error('Account assign error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
