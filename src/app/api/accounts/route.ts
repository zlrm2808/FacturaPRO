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

    // Calculate balance change
    let balanceChange = 0
    if (type === 'CREDITO') {
      balanceChange = amount // adds to balance
    } else if (type === 'DEBITO' || type === 'ABONO') {
      balanceChange = -amount // subtracts from balance
    }

    // Create entry and update client balance in a transaction
    const entry = await db.$transaction(async (tx) => {
      const newEntry = await tx.accountEntry.create({
        data: {
          clientId,
          type,
          amount,
          description,
          invoiceId: invoiceId || null,
          userId: payload.userId,
        },
        include: {
          client: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      })

      await tx.client.update({
        where: { id: clientId },
        data: { balance: { increment: balanceChange } },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREAR_MOVIMIENTO_CUENTA',
          module: 'CUENTAS',
          details: `Movimiento ${type} por ${amount} para cliente ${client.name}`,
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
