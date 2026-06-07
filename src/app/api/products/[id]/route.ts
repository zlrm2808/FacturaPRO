import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/products/[id] - Get single product with category and stock movements
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

    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error getting product:', error)
    return NextResponse.json({ error: 'Error al obtener producto' }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update product
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
    const { code, name, description, purchasePrice, salePrice, quantity, minStock, categoryId, status, unitOfMeasure } = body

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // If code is being changed, check for duplicates
    if (code && code.trim() !== existing.code) {
      const duplicate = await db.product.findUnique({ where: { code: code.trim() } })
      if (duplicate) {
        return NextResponse.json({ error: 'Ya existe un producto con ese código' }, { status: 409 })
      }
    }

    // If quantity is being changed, create a stock movement for the difference
    if (quantity !== undefined && quantity !== existing.quantity) {
      const diff = quantity - existing.quantity
      await db.stockMovement.create({
        data: {
          productId: id,
          type: diff > 0 ? 'ENTRADA' : 'SALIDA',
          quantity: Math.abs(diff),
          reason: diff > 0 ? 'Ajuste de inventario (entrada)' : 'Ajuste de inventario (salida)',
          reference: `AJUSTE-${id}`,
        },
      })
    }

    const product = await db.product.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: code.trim() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(salePrice !== undefined && { salePrice }),
        ...(quantity !== undefined && { quantity: parseFloat(String(quantity)) }),
        ...(minStock !== undefined && { minStock: parseFloat(String(minStock)) }),
        ...(unitOfMeasure !== undefined && { unitOfMeasure }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(status !== undefined && { status }),
      },
      include: { category: { select: { id: true, name: true } } },
    })

    await db.auditLog.create({
      data: {
        action: 'EDITAR_PRODUCTO',
        module: 'PRODUCTOS',
        details: `Producto actualizado: ${product.name} (${product.code})`,
        userId: user.userId,
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Delete product (only if not in any invoice)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoiceItems: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    if (existing._count.invoiceItems > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar el producto porque está asociado a facturas' },
        { status: 400 }
      )
    }

    // Delete related stock movements first
    await db.stockMovement.deleteMany({ where: { productId: id } })
    await db.product.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'ELIMINAR_PRODUCTO',
        module: 'PRODUCTOS',
        details: `Producto eliminado: ${existing.name} (${existing.code})`,
        userId: user.userId,
      },
    })

    return NextResponse.json({ message: 'Producto eliminado correctamente' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Error al eliminar producto' }, { status: 500 })
  }
}
