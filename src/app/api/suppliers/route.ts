import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/suppliers - List suppliers with search
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { rncCedula: { contains: search } },
      ]
    }

    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    })

    const result = suppliers.map((s) => ({
      ...s,
      orderCount: s._count.purchaseOrders,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error listing suppliers:', error)
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 })
  }
}

// POST /api/suppliers - Create a new supplier
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (user.role === 'EMPLEADO') {
      return NextResponse.json({ error: 'No tiene permisos para crear proveedores' }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, email, address, rncCedula, contactName, status } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const supplier = await db.supplier.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        rncCedula: rncCedula?.trim() || null,
        contactName: contactName?.trim() || null,
        status: status || 'ACTIVO',
      },
    })

    await db.auditLog.create({
      data: {
        action: 'CREAR_PROVEEDOR',
        module: 'PROVEEDORES',
        details: `Proveedor creado: ${name}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 })
  }
}
