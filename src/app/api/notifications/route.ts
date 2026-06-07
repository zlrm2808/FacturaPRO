import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const notifications = await db.notification.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
    })

    const unreadCount = notifications.filter((n) => !n.read).length

    return NextResponse.json({
      unreadCount,
      notifications,
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, title, message, userId } = body

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title y message son requeridos' },
        { status: 400 }
      )
    }

    const validTypes = [
      'FACTURA_VENCIDA',
      'PAGO_PENDIENTE',
      'LICENCIA_VENCER',
      'INVENTARIO_BAJO',
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de notificación inválido' },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        type,
        title,
        message,
        userId: userId || null,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Notification POST error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      await db.notification.updateMany({
        where: {
          userId: payload.userId,
          read: false,
        },
        data: { read: true },
      })

      return NextResponse.json({ message: 'Todas las notificaciones marcadas como leídas' })
    }

    if (id) {
      const notification = await db.notification.findUnique({
        where: { id },
      })

      if (!notification) {
        return NextResponse.json(
          { error: 'Notificación no encontrada' },
          { status: 404 }
        )
      }

      if (notification.userId !== payload.userId) {
        return NextResponse.json(
          { error: 'No tiene permisos para esta notificación' },
          { status: 403 }
        )
      }

      await db.notification.update({
        where: { id },
        data: { read: true },
      })

      return NextResponse.json({ message: 'Notificación marcada como leída' })
    }

    return NextResponse.json(
      { error: 'Debe proporcionar id o markAll' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Notification PUT error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
