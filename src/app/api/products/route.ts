import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/products - List all products with search, category filter, and lowStock support
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('lowStock') === 'true'

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (category) {
      where.categoryId = category
    }

    if (lowStock) {
      where.quantity = { lte: db.product.fields.minStock ? undefined : 0 }
      // SQLite: use raw filter approach
      // We'll filter after fetch for the lte comparison between two fields
    }

    let products
    if (lowStock) {
      // For lowStock, we need quantity <= minStock which is a cross-field comparison
      // Prisma doesn't natively support this, so we fetch and filter
      const allProducts = await db.product.findMany({
        where: {
          ...(search
            ? {
                OR: [
                  { name: { contains: search } },
                  { code: { contains: search } },
                  { description: { contains: search } },
                ],
              }
            : {}),
          ...(category ? { categoryId: category } : {}),
        },
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      products = allProducts.filter((p) => p.quantity <= p.minStock)
    } else {
      products = await db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error listing products:', error)
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
  }
}

// POST /api/products - Create a new product
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { code, name, description, purchasePrice, salePrice, quantity, minStock, categoryId, status } = body

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'El código es requerido' }, { status: 400 })
    }
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }
    if (salePrice === undefined || salePrice === null || salePrice < 0) {
      return NextResponse.json({ error: 'El precio de venta es requerido y debe ser mayor o igual a 0' }, { status: 400 })
    }

    // Check for duplicate code
    const existing = await db.product.findUnique({ where: { code: code.trim() } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un producto con ese código' }, { status: 409 })
    }

    const productQuantity = quantity ?? 0
    const productMinStock = minStock ?? 5
    const productPurchasePrice = purchasePrice ?? 0

    const product = await db.product.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        purchasePrice: productPurchasePrice,
        averageCost: productPurchasePrice, // Initial average cost equals purchase price
        salePrice: salePrice,
        quantity: productQuantity,
        minStock: productMinStock,
        categoryId: categoryId || null,
        status: status || 'ACTIVO',
      },
    })

    // Create stock movement if initial quantity > 0
    if (productQuantity > 0) {
      await db.stockMovement.create({
        data: {
          productId: product.id,
          type: 'ENTRADA',
          quantity: productQuantity,
          unitCost: productPurchasePrice,
          reason: 'Stock inicial',
          reference: `PRODUCT-${product.id}`,
        },
      })
    }

    await db.auditLog.create({
      data: {
        action: 'CREAR_PRODUCTO',
        module: 'PRODUCTOS',
        details: `Producto creado: ${product.name} (${product.code}) - Cantidad: ${productQuantity}`,
        userId: user.userId,
      },
    })

    // Return with category info
    const result = await db.product.findUnique({
      where: { id: product.id },
      include: { category: { select: { id: true, name: true } } },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
  }
}
