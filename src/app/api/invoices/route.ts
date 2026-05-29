import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/invoices - List all invoices with filters and pagination
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const fromDate = searchParams.get('fromDate') || ''
    const toDate = searchParams.get('toDate') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate)
      where.date = dateFilter
    }

    const skip = (page - 1) * limit

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.invoice.count({ where }),
    ])

    const result = invoices.map((inv) => ({
      ...inv,
      itemCount: inv._count.items,
    }))

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error listing invoices:', error)
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 })
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { clientId, items, paymentMethod, discount, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La factura debe tener al menos un item' }, { status: 400 })
    }

    // Validate all products exist and have sufficient stock
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
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${product.name}. Disponible: ${product.quantity}, Solicitado: ${item.quantity}` },
          { status: 400 }
        )
      }
    }

    // Calculate totals
    let subtotal = 0
    const invoiceItems = items.map((item: { productId: string; quantity: number; unitPrice: number; discount?: number }) => {
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0)
      subtotal += itemSubtotal
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        subtotal: itemSubtotal,
      }
    })

    const invoiceDiscount = discount || 0
    const taxRate = 0.18
    const taxableAmount = subtotal - invoiceDiscount
    const tax = taxableAmount * taxRate
    const total = taxableAmount + tax

    // Auto-generate invoice number (FAC-XXXXXX format)
    const lastInvoice = await db.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })

    let nextNumber = 1
    if (lastInvoice) {
      const match = lastInvoice.number.match(/FAC-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    const invoiceNumber = `FAC-${String(nextNumber).padStart(6, '0')}`

    // Create invoice with items in a transaction
    const invoice = await db.$transaction(async (tx) => {
      // Create the invoice
      const inv = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          subtotal,
          tax,
          discount: invoiceDiscount,
          total,
          status: 'PENDIENTE',
          paymentMethod: paymentMethod || 'EFECTIVO',
          notes: notes?.trim() || null,
          clientId: clientId || null,
          userId: user.userId,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: true,
          client: true,
          user: { select: { id: true, name: true } },
        },
      })

      // Update product quantities and create stock movements
      for (const item of items) {
        const product = productMap.get(item.productId)!

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: product.quantity - item.quantity },
        })

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALIDA',
            quantity: item.quantity,
            reason: `Venta - Factura ${invoiceNumber}`,
            reference: invoiceNumber,
          },
        })
      }

      // If payment method is CREDITO, update client balance
      if (paymentMethod === 'CREDITO' && clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: { balance: { increment: total } },
        })

        // Create account entry for credit sale
        await tx.accountEntry.create({
          data: {
            type: 'CREDITO',
            amount: total,
            description: `Factura ${invoiceNumber} - Venta a crédito`,
            clientId: clientId,
            invoiceId: inv.id,
            userId: user.userId,
          },
        })
      }

      // Create transaction record
      await tx.transaction.create({
        data: {
          amount: total,
          paymentMethod: paymentMethod || 'EFECTIVO',
          userId: user.userId,
          clientId: clientId || null,
          invoiceId: inv.id,
        },
      })

      return inv
    })

    await db.auditLog.create({
      data: {
        action: 'CREAR_FACTURA',
        module: 'FACTURAS',
        details: `Factura creada: ${invoiceNumber} - Total: ${total.toFixed(2)}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 })
  }
}
