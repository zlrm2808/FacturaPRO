import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// DELETE /api/client-prices/[id] - Remove a custom price
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

    const existing = await db.clientPrice.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        product: { select: { name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Precio personalizado no encontrado' }, { status: 404 })
    }

    await db.clientPrice.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'ELIMINAR_PRECIO_CLIENTE',
        module: 'CLIENTES',
        details: `Precio personalizado eliminado para cliente ${existing.client.name}, producto ${existing.product.name}`,
        userId: user.userId,
      },
    })

    return NextResponse.json({ message: 'Precio personalizado eliminado correctamente' })
  } catch (error) {
    console.error('Error deleting client price:', error)
    return NextResponse.json({ error: 'Error al eliminar precio del cliente' }, { status: 500 })
  }
}
