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
    const userId = searchParams.get('userId')
    const clientId = searchParams.get('clientId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const paymentMethod = searchParams.get('paymentMethod')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = {}

    if (userId) where.userId = userId
    if (clientId) where.clientId = clientId
    if (paymentMethod) where.paymentMethod = paymentMethod
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, username: true } },
          client: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Transactions GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
