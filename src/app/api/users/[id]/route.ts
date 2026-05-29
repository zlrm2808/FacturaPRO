import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    if (!['DESARROLLADOR', 'ADMINISTRADOR'].includes(payload.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar usuarios' },
        { status: 403 }
      )
    }

    const { id } = await params

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, email, role, active } = body

    // Only DESARROLLADOR can change roles
    if (role !== undefined && payload.role !== 'DESARROLLADOR') {
      return NextResponse.json(
        { error: 'Solo DESARROLLADOR puede cambiar roles' },
        { status: 403 }
      )
    }

    // Don't allow changing own role to lower
    if (id === payload.userId && role && role !== payload.role) {
      return NextResponse.json(
        { error: 'No puede cambiar su propio rol' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (role !== undefined) {
      const validRoles = ['DESARROLLADOR', 'ADMINISTRADOR', 'EMPLEADO']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Rol inválido' },
          { status: 400 }
        )
      }
      updateData.role = role
    }
    if (active !== undefined) updateData.active = active

    const updatedUser = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      await tx.auditLog.create({
        data: {
          action: 'ACTUALIZAR_USUARIO',
          module: 'USUARIOS',
          details: `Usuario actualizado: ${user.username}. Cambios: ${JSON.stringify(updateData)}`,
          userId: payload.userId,
        },
      })

      return updated
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    if (!['DESARROLLADOR', 'ADMINISTRADOR'].includes(payload.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para desactivar usuarios' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Can't deactivate yourself
    if (id === payload.userId) {
      return NextResponse.json(
        { error: 'No puede desactivar su propio usuario' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (!user.active) {
      return NextResponse.json(
        { error: 'El usuario ya está inactivo' },
        { status: 400 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { active: false },
      })

      await tx.auditLog.create({
        data: {
          action: 'DESACTIVAR_USUARIO',
          module: 'USUARIOS',
          details: `Usuario desactivado: ${user.username}`,
          userId: payload.userId,
        },
      })
    })

    return NextResponse.json({ message: 'Usuario desactivado correctamente' })
  } catch (error) {
    console.error('User DELETE error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
