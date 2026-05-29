import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/clients/[id] - Get single client with invoices and account entries
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

    const client = await db.client.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: { select: { id: true } },
          },
        },
        accountEntries: {
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error getting client:', error)
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 })
  }
}

// PUT /api/clients/[id] - Update client
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
    const { name, phone, address, email, rncCedula } = body

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const client = await db.client.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(rncCedula !== undefined && { rncCedula: rncCedula?.trim() || null }),
      },
    })

    await db.auditLog.create({
      data: {
        action: 'EDITAR_CLIENTE',
        module: 'CLIENTES',
        details: `Cliente actualizado: ${client.name} (ID: ${id})`,
        userId: user.userId,
      },
    })

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 })
  }
}

// DELETE /api/clients/[id] - Delete client (only if no pending invoices)
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

    const existing = await db.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    if (existing._count.invoices > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar el cliente porque tiene facturas asociadas' },
        { status: 400 }
      )
    }

    await db.client.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'ELIMINAR_CLIENTE',
        module: 'CLIENTES',
        details: `Cliente eliminado: ${existing.name} (ID: ${id})`,
        userId: user.userId,
      },
    })

    return NextResponse.json({ message: 'Cliente eliminado correctamente' })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 })
  }
}
