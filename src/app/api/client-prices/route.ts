import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/client-prices?clientId=XXX - Get all custom prices for a client
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId es requerido' }, { status: 400 })
    }

    const clientPrices = await db.clientPrice.findMany({
      where: { clientId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            salePrice: true,
            unitOfMeasure: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    })

    return NextResponse.json(clientPrices)
  } catch (error) {
    console.error('Error listing client prices:', error)
    return NextResponse.json({ error: 'Error al obtener precios del cliente' }, { status: 500 })
  }
}

// POST /api/client-prices - Create or update a custom price
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { clientId, productId, customPrice } = body

    if (!clientId || !productId || customPrice === undefined || customPrice === null) {
      return NextResponse.json(
        { error: 'clientId, productId y customPrice son requeridos' },
        { status: 400 }
      )
    }

    if (typeof customPrice !== 'number' || customPrice < 0) {
      return NextResponse.json(
        { error: 'customPrice debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Verify client and product exist
    const [client, product] = await Promise.all([
      db.client.findUnique({ where: { id: clientId } }),
      db.product.findUnique({ where: { id: productId } }),
    ])

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Upsert: create or update based on unique constraint (clientId + productId)
    const clientPrice = await db.clientPrice.upsert({
      where: {
        clientId_productId: { clientId, productId },
      },
      update: { customPrice },
      create: { clientId, productId, customPrice },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            salePrice: true,
            unitOfMeasure: true,
          },
        },
      },
    })

    await db.auditLog.create({
      data: {
        action: 'CREAR_PRECIO_CLIENTE',
        module: 'CLIENTES',
        details: `Precio personalizado para cliente ${client.name}, producto ${product.name}: $${customPrice}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(clientPrice, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating client price:', error)
    return NextResponse.json({ error: 'Error al guardar precio del cliente' }, { status: 500 })
  }
}
