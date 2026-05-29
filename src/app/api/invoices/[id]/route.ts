import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/invoices/[id] - Get single invoice with full details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
        client: true,
        user: { select: { id: true, name: true, username: true } },
        accountEntries: {
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error getting invoice:', error)
    return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 })
  }
}

// PUT /api/invoices/[id] - Update invoice status (PAGADA, ANULADA)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'El estado es requerido' }, { status: 400 })
    }

    const validStatuses = ['PAGADA', 'PENDIENTE', 'VENCIDA', 'ANULADA']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Estado inválido. Válidos: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const existing = await db.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, quantity: true } },
          },
        },
        client: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Prevent changing from ANULADA back to other statuses
    if (existing.status === 'ANULADA' && status !== 'ANULADA') {
      return NextResponse.json(
        { error: 'No se puede cambiar el estado de una factura anulada' },
        { status: 400 }
      )
    }

    // If same status, just return
    if (existing.status === status) {
      return NextResponse.json(existing)
    }

    // Handle status changes with side effects in a transaction
    const invoice = await db.$transaction(async (tx) => {
      // If marking as PAGADA
      if (status === 'PAGADA' && existing.clientId) {
        // Create account entry (ABONO)
        await tx.accountEntry.create({
          data: {
            type: 'ABONO',
            amount: existing.total,
            description: `Pago de factura ${existing.number}`,
            clientId: existing.clientId,
            invoiceId: id,
            userId: user.userId,
          },
        })

        // Update client balance (decrease)
        if (existing.client && existing.client.balance > 0) {
          const newBalance = Math.max(0, existing.client.balance - existing.total)
          await tx.client.update({
            where: { id: existing.clientId },
            data: { balance: newBalance },
          })
        }
      }

      // If marking as ANULADA
      if (status === 'ANULADA') {
        // Restore product quantities and create stock movements (ENTRADA)
        for (const item of existing.items) {
          const product = item.product
          await tx.product.update({
            where: { id: product.id },
            data: { quantity: product.quantity + item.quantity },
          })

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'ENTRADA',
              quantity: item.quantity,
              reason: `Anulación de factura ${existing.number}`,
              reference: existing.number,
            },
          })
        }

        // If it was a credit sale, reduce client balance
        if (existing.paymentMethod === 'CREDITO' && existing.clientId) {
          await tx.client.update({
            where: { id: existing.clientId },
            data: { balance: { decrement: existing.total } },
          })
        }
      }

      // Update invoice status
      const updated = await tx.invoice.update({
        where: { id },
        data: { status },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
            },
          },
          client: true,
          user: { select: { id: true, name: true } },
        },
      })

      return updated
    })

    await db.auditLog.create({
      data: {
        action: status === 'ANULADA' ? 'ANULAR_FACTURA' : 'CAMBIAR_ESTADO_FACTURA',
        module: 'FACTURAS',
        details: `Factura ${existing.number} cambió de ${existing.status} a ${status}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 })
  }
}
