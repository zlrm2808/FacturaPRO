import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/purchase-orders/[id] - Get single purchase order with full details
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

    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, quantity: true } },
          },
        },
        supplier: true,
        user: { select: { id: true, name: true, username: true } },
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
    }

    return NextResponse.json(purchaseOrder)
  } catch (error) {
    console.error('Error getting purchase order:', error)
    return NextResponse.json({ error: 'Error al obtener orden de compra' }, { status: 500 })
  }
}

// PUT /api/purchase-orders/[id] - Update purchase order (receive or cancel)
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
    const { action } = body

    if (!action || !['receive', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Acción requerida. Valores válidos: receive, cancel' },
        { status: 400 }
      )
    }

    const existing = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, quantity: true } },
          },
        },
        supplier: { select: { id: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
    }

    // Validate current status allows the action
    if (existing.status === 'ANULADA') {
      return NextResponse.json(
        { error: 'No se puede modificar una orden de compra anulada' },
        { status: 400 }
      )
    }

    if (existing.status === 'RECIBIDA' && action === 'receive') {
      return NextResponse.json(
        { error: 'La orden de compra ya ha sido recibida' },
        { status: 400 }
      )
    }

    if (action === 'receive') {
      // Receive purchase order: add stock, create stock movements, calculate weighted average cost
      const purchaseOrder = await db.$transaction(async (tx) => {
        // For each item, add received quantity to product stock, calculate weighted avg cost, create stock movement
        for (const item of existing.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          })
          if (!product) continue

          const currentQty = product.quantity
          const currentAvgCost = product.averageCost
          const newQty = item.quantity
          const newUnitCost = item.unitPrice

          // Calculate weighted average cost (costo promedio ponderado)
          // Formula: (currentQty * currentAvgCost + newQty * newUnitCost) / (currentQty + newQty)
          const totalQty = currentQty + newQty
          const newAverageCost = totalQty > 0
            ? (currentQty * currentAvgCost + newQty * newUnitCost) / totalQty
            : newUnitCost

          // Update product: increment stock, update averageCost and last purchase price
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity },
              averageCost: Math.round(newAverageCost * 100) / 100,
              purchasePrice: newUnitCost, // Update last purchase price
            },
          })

          // Update purchase order item received count
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { received: item.quantity },
          })

          // Create stock movement (ENTRADA) with supplierId and unitCost
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'ENTRADA',
              quantity: item.quantity,
              unitCost: newUnitCost,
              reason: `Recepción de orden de compra ${existing.number}`,
              reference: existing.number,
              supplierId: existing.supplierId,
            },
          })
        }

        // Update purchase order status to RECIBIDA
        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: { status: 'RECIBIDA' },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, code: true, quantity: true } },
              },
            },
            supplier: true,
            user: { select: { id: true, name: true, username: true } },
          },
        })

        return updated
      })

      await db.auditLog.create({
        data: {
          action: 'RECIBIR_ORDEN_COMPRA',
          module: 'PROVEEDORES',
          details: `Orden de compra recibida: ${existing.number} - Proveedor: ${existing.supplier.name} - Total: $${existing.total.toFixed(2)} / Bs.${existing.totalBs.toFixed(2)}`,
          userId: user.userId,
        },
      })

      return NextResponse.json(purchaseOrder)
    }

    if (action === 'cancel') {
      // Cancel purchase order
      const purchaseOrder = await db.purchaseOrder.update({
        where: { id },
        data: { status: 'ANULADA' },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, code: true, quantity: true } },
            },
          },
          supplier: true,
          user: { select: { id: true, name: true, username: true } },
        },
      })

      await db.auditLog.create({
        data: {
          action: 'ANULAR_ORDEN_COMPRA',
          module: 'PROVEEDORES',
          details: `Orden de compra anulada: ${existing.number} - Proveedor: ${existing.supplier.name}`,
          userId: user.userId,
        },
      })

      return NextResponse.json(purchaseOrder)
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error) {
    console.error('Error updating purchase order:', error)
    return NextResponse.json({ error: 'Error al actualizar orden de compra' }, { status: 500 })
  }
}
