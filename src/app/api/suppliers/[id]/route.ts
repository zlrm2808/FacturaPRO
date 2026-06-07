import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/suppliers/[id] - Get single supplier
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

    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error getting supplier:', error)
    return NextResponse.json({ error: 'Error al obtener proveedor' }, { status: 500 })
  }
}

// PUT /api/suppliers/[id] - Update supplier
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (user.role === 'EMPLEADO') {
      return NextResponse.json({ error: 'No tiene permisos para actualizar proveedores' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, phone, email, address, rncCedula, contactName, status } = body

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(rncCedula !== undefined && { rncCedula: rncCedula?.trim() || null }),
        ...(contactName !== undefined && { contactName: contactName?.trim() || null }),
        ...(status !== undefined && { status }),
      },
    })

    await db.auditLog.create({
      data: {
        action: 'ACTUALIZAR_PROVEEDOR',
        module: 'PROVEEDORES',
        details: `Proveedor actualizado: ${supplier.name}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 })
  }
}

// DELETE /api/suppliers/[id] - Delete supplier
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (user.role === 'EMPLEADO') {
      return NextResponse.json({ error: 'No tiene permisos para eliminar proveedores' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchaseOrders: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    if (existing._count.purchaseOrders > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un proveedor con órdenes de compra asociadas' },
        { status: 400 }
      )
    }

    await db.supplier.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'ELIMINAR_PROVEEDOR',
        module: 'PROVEEDORES',
        details: `Proveedor eliminado: ${existing.name}`,
        userId: user.userId,
      },
    })

    return NextResponse.json({ message: 'Proveedor eliminado' })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 })
  }
}
