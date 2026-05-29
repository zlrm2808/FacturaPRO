import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/clients - List all clients with search support
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const clients = await db.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
              { rncCedula: { contains: search } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { invoices: true },
        },
        invoices: {
          where: { status: { in: ['PENDIENTE', 'VENCIDA'] } },
          select: { total: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = clients.map((client) => {
      const pendingBalance = client.invoices.reduce((sum, inv) => sum + inv.total, 0)
      const { invoices, ...rest } = client
      return {
        ...rest,
        invoiceCount: client._count.invoices,
        pendingBalance,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error listing clients:', error)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

// POST /api/clients - Create a new client
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, address, email, rncCedula } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const client = await db.client.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        email: email?.trim() || null,
        rncCedula: rncCedula?.trim() || null,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'CREAR_CLIENTE',
        module: 'CLIENTES',
        details: `Cliente creado: ${client.name} (ID: ${client.id})`,
        userId: user.userId,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
  }
}
