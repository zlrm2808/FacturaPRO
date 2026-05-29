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

    if (!['DESARROLLADOR', 'ADMINISTRADOR'].includes(payload.role)) {
      return NextResponse.json(
        { error: 'No tiene permisos para acceder a este recurso' },
        { status: 403 }
      )
    }

    const licenses = await db.license.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ licenses })
  } catch (error) {
    console.error('Licenses GET error:', error)
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

    if (payload.role !== 'DESARROLLADOR') {
      return NextResponse.json(
        { error: 'Solo DESARROLLADOR puede crear licencias' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { clientName, durationDays = 365 } = body

    if (!clientName) {
      return NextResponse.json(
        { error: 'clientName es requerido' },
        { status: 400 }
      )
    }

    // Auto-generate license key: "LIC-" + year + "-" + random 8 chars
    const year = new Date().getFullYear()
    const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase()
    const licenseKey = `LIC-${year}-${randomChars}`

    const now = new Date()
    const expirationDate = new Date(now)
    expirationDate.setDate(expirationDate.getDate() + durationDays)

    const license = await db.$transaction(async (tx) => {
      const newLicense = await tx.license.create({
        data: {
          licenseKey,
          clientName,
          status: 'ACTIVA',
          activationDate: now,
          expirationDate,
        },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREAR_LICENCIA',
          module: 'LICENCIAS',
          details: `Licencia creada: ${licenseKey} para ${clientName}, duración: ${durationDays} días`,
          userId: payload.userId,
        },
      })

      return newLicense
    })

    return NextResponse.json({ license }, { status: 201 })
  } catch (error) {
    console.error('License POST error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
