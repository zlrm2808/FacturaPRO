import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/purchase-orders - List purchase orders
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    const orders = await db.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error listing purchase orders:', error)
    return NextResponse.json({ error: 'Error al obtener órdenes de compra' }, { status: 500 })
  }
}

// POST /api/purchase-orders - Create a new purchase order
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (user.role === 'EMPLEADO') {
      return NextResponse.json({ error: 'No tiene permisos para crear órdenes de compra' }, { status: 403 })
    }

    const body = await request.json()
    const { supplierId, items, notes } = body

    if (!supplierId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La orden debe tener al menos un item' }, { status: 400 })
    }

    // Validate supplier
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 })
    }

    // Validate products and calculate totals
    const productIds = items.map((item: { productId: string }) => item.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) {
        return NextResponse.json(
          { error: `Producto no encontrado: ${item.productId}` },
          { status: 400 }
        )
      }
    }

    let subtotal = 0
    const orderItems = items.map((item: { productId: string; quantity: number; unitPrice: number }) => {
      const itemSubtotal = item.quantity * item.unitPrice
      subtotal += itemSubtotal
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: itemSubtotal,
        received: 0,
      }
    })

    const taxRate = 0.18
    const tax = subtotal * taxRate
    const total = subtotal + tax

    // Auto-generate order number (OC-XXXXXX format)
    const lastOrder = await db.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })

    let nextNumber = 1
    if (lastOrder) {
      const match = lastOrder.number.match(/OC-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    const orderNumber = `OC-${String(nextNumber).padStart(6, '0')}`

    const order = await db.purchaseOrder.create({
      data: {
        number: orderNumber,
        subtotal,
        tax,
        total,
        status: 'PENDIENTE',
        notes: notes?.trim() || null,
        supplierId,
        userId: user.userId,
        items: {
          create: orderItems,
        },
      },
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })

    await db.auditLog.create({
      data: {
        action: 'CREAR_ORDEN_COMPRA',
        module: 'PROVEEDORES',
        details: `Orden de compra creada: ${orderNumber} - Proveedor: ${supplier.name} - Total: ${total.toFixed(2)}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return NextResponse.json({ error: 'Error al crear orden de compra' }, { status: 500 })
  }
}
