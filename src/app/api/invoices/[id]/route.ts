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

    // If invoice is annulled, present amounts and item quantities as zero (do not expose original totals)
    if (invoice.status === 'ANULADA') {
      const annulled = {
        ...invoice,
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        totalBs: 0,
        items: invoice.items.map((it) => ({
          ...it,
          quantity: 0,
          subtotal: 0,
        })),
      }
      return NextResponse.json(annulled)
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

    // Additional validation: cannot annul invoices that are already paid or have abonos/pagos
    if (status === 'ANULADA') {
      if (existing.status === 'PAGADA') {
        return NextResponse.json({ error: 'No se puede anular una factura que ya está PAGADA' }, { status: 400 })
      }
      const existingAbono = await db.accountEntry.findFirst({ where: { invoiceId: id, type: 'ABONO' } })
      if (existingAbono) {
        return NextResponse.json({ error: 'No se puede anular una factura que tiene abonos/pagos' }, { status: 400 })
      }
    }

    // Handle status changes with side effects in a transaction
    const invoice = await db.$transaction(async (tx) => {
      // If marking as PAGADA
      if (status === 'PAGADA' && existing.clientId) {
        const invoiceEntries = await tx.accountEntry.findMany({
          where: { invoiceId: id, type: 'ABONO' },
          select: { amount: true },
        })
        const paidAmount = invoiceEntries.reduce((sum, entry) => sum + entry.amount, 0)
        const remainingAmount = Math.max(0, existing.total - paidAmount)

        if (remainingAmount > 0) {
          await tx.accountEntry.create({
            data: {
              type: 'ABONO',
              amount: remainingAmount,
              description: `Pago de factura ${existing.number}`,
              clientId: existing.clientId,
              invoiceId: id,
              userId: user.userId,
            },
          })
        }
      }

      // If marking as ANULADA
        if (status === 'ANULADA') {
          // Remove any transaction records linked to this invoice (sale record)
          await tx.transaction.deleteMany({ where: { invoiceId: id } })

          // Remove any credit account entry created for the invoice
          await tx.accountEntry.deleteMany({ where: { invoiceId: id, type: 'CREDITO' } })

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

          // After annulation, we'll recompute client balance below to keep it consistent
        }

      // Recompute client balance after status changes
      if (existing.clientId) {
        const allEntries = await tx.accountEntry.findMany({ where: { clientId: existing.clientId }, select: { type: true, amount: true } })
        const computedBalance = allEntries.reduce((sum, e) => sum + (e.type === 'CREDITO' ? e.amount : -e.amount), 0)
        await tx.client.update({ where: { id: existing.clientId }, data: { balance: computedBalance } })
      }

      // Update invoice status and return
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
