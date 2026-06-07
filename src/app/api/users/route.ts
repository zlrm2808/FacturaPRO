import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hashPassword } from '@/lib/auth'

export async function GET(request: Request) {
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
        { error: 'No tiene permisos para acceder a este recurso' },
        { status: 403 }
      )
    }

    const users = await db.user.findMany({
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Users GET error:', error)
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

    if (!['DESARROLLADOR', 'ADMINISTRADOR'].includes(payload.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para crear usuarios' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { username, password, name, email, role } = body

    if (!username || !password || !name || !role) {
      return NextResponse.json(
        { error: 'username, password, name y role son requeridos' },
        { status: 400 }
      )
    }

    const validRoles = ['DESARROLLADOR', 'ADMINISTRADOR', 'EMPLEADO']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser: DESARROLLADOR, ADMINISTRADOR o EMPLEADO' },
        { status: 400 }
      )
    }

    // Only DESARROLLADOR can create DESARROLLADOR users
    if (role === 'DESARROLLADOR' && payload.role !== 'DESARROLLADOR') {
      return NextResponse.json(
        { error: 'Solo DESARROLLADOR puede crear usuarios con rol DESARROLLADOR' },
        { status: 403 }
      )
    }

    // Check username uniqueness
    const existingUser = await db.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya existe' },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username,
          password: hashedPassword,
          name,
          email: email || null,
          role,
        },
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
          action: 'CREAR_USUARIO',
          module: 'USUARIOS',
          details: `Usuario creado: ${username} con rol ${role}`,
          userId: payload.userId,
        },
      })

      return newUser
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('User POST error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
