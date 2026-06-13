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

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const type = searchParams.get('type')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = {}

    if (clientId) where.clientId = clientId
    if (type) where.type = type
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const entries = await db.accountEntry.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Account entries GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { clientId, type, amount, description, invoiceId } = body

    if (!clientId || !type || !amount) {
      return NextResponse.json(
        { error: 'clientId, type y amount son requeridos' },
        { status: 400 }
      )
    }

    const validTypes = ['CREDITO', 'DEBITO', 'ABONO']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Debe ser: CREDITO, DEBITO o ABONO' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser mayor a 0' },
        { status: 400 }
      )
    }

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Get today's dollar rate
    const dollarRateInfo = await getEffectiveDollarRate(new Date())
    const dollarRate = dollarRateInfo.officialRate
    const amountBs = amount * dollarRate

    // Calculate balance change
    let balanceChange = 0
    if (type === 'CREDITO') {
      balanceChange = amount // adds to balance
    } else if (type === 'DEBITO') {
      balanceChange = -amount // subtracts from balance
    } else if (type === 'ABONO') {
      // Only affect client.balance for ABONOs that are not assigned to an invoice
      balanceChange = invoiceId ? 0 : -amount
    }

    let invoice: any = null
    let remainingAmount = amount
    let assignedAmount = amount

    if (invoiceId) {
      invoice = await db.invoice.findUnique({
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

      if (invoice.clientId !== clientId) {
        return NextResponse.json(
          { error: 'La factura no corresponde al cliente seleccionado' },
          { status: 400 }
        )
      }

      if (invoice.status === 'ANULADA') {
        return NextResponse.json(
          { error: 'No se puede aplicar un abono a una factura anulada' },
          { status: 400 }
        )
      }

      const paidAmount = invoice.accountEntries.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0)
      remainingAmount = Math.max(0, invoice.total - paidAmount)

      if (remainingAmount <= 0) {
        return NextResponse.json({ error: 'La factura ya está pagada' }, { status: 400 })
      }

      assignedAmount = Math.min(amount, remainingAmount)
    }

    const entry = await db.$transaction(async (tx) => {
      let newEntry

      if (invoiceId && invoice) {
        const leftoverAmount = amount - assignedAmount
        const assignedDescription = (description && description.trim()) || `Abono aplicado a factura ${invoice.number}`

        newEntry = await tx.accountEntry.create({
          data: {
            clientId,
            type,
            amount: assignedAmount,
            amountBs: assignedAmount * dollarRate,
            dollarRate,
            description: assignedDescription,
            invoiceId,
            userId: payload.userId,
          },
          include: {
            client: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
        })

        if (leftoverAmount > 0) {
          await tx.accountEntry.create({
            data: {
              clientId,
              type,
              amount: leftoverAmount,
              amountBs: leftoverAmount * dollarRate,
              dollarRate,
              description: `Saldo a favor restante de abono a factura ${invoice.number}`,
              invoiceId: null,
              userId: payload.userId,
            },
          })
        }

        if (assignedAmount >= remainingAmount && invoice.status !== 'PAGADA') {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: 'PAGADA' },
          })
        }
      } else {
        newEntry = await tx.accountEntry.create({
          data: {
            clientId,
            type,
            amount,
            amountBs,
            dollarRate,
            description,
            invoiceId: null,
            userId: payload.userId,
          },
          include: {
            client: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
        })
      }

      // Recompute client balance from entries to avoid incremental drift
      const allEntries = await tx.accountEntry.findMany({ where: { clientId }, select: { type: true, amount: true } })
      const computedBalance = allEntries.reduce((sum, e) => sum + (e.type === 'CREDITO' ? e.amount : -e.amount), 0)
      await tx.client.update({ where: { id: clientId }, data: { balance: computedBalance } })

      await tx.auditLog.create({
        data: {
          action: 'CREAR_MOVIMIENTO_CUENTA',
          module: 'CUENTAS',
          details: `Movimiento ${type} por $${amount.toFixed(2)} / Bs.${amountBs.toFixed(2)} para cliente ${client.name} - Tasa: ${dollarRate}`,
          userId: payload.userId,
        },
      })

      return newEntry
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('Account entry POST error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
