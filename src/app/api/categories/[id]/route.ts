import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/categories/[id] - Get single category with products
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

    const category = await db.category.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error getting category:', error)
    return NextResponse.json({ error: 'Error al obtener categoría' }, { status: 500 })
  }
}

// PUT /api/categories/[id] - Update category
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
    const { name, description } = body

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    const category = await db.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    })

    await db.auditLog.create({
      data: {
        action: 'EDITAR_CATEGORIA',
        module: 'CATEGORIAS',
        details: `Categoría actualizada: ${category.name} (ID: ${id})`,
        userId: user.userId,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 })
  }
}

// DELETE /api/categories/[id] - Delete category
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

    const existing = await db.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    if (existing._count.products > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar la categoría porque tiene productos asociados' },
        { status: 400 }
      )
    }

    await db.category.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'ELIMINAR_CATEGORIA',
        module: 'CATEGORIAS',
        details: `Categoría eliminada: ${existing.name} (ID: ${id})`,
        userId: user.userId,
      },
    })

    return NextResponse.json({ message: 'Categoría eliminada correctamente' })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 })
  }
}
