import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/categories - List all categories with product count
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const categories = await db.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = categories.map((cat) => ({
      ...cat,
      productCount: cat._count.products,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error listing categories:', error)
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }
}

// POST /api/categories - Create a new category
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'CREAR_CATEGORIA',
        module: 'CATEGORIAS',
        details: `Categoría creada: ${category.name} (ID: ${category.id})`,
        userId: user.userId,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 })
  }
}
