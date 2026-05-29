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

    if (payload.role !== 'DESARROLLADOR') {
      return NextResponse.json(
        { error: 'Solo DESARROLLADOR puede modificar licencias' },
        { status: 403 }
      )
    }

    const { id } = await params

    const license = await db.license.findUnique({ where: { id } })
    if (!license) {
      return NextResponse.json(
        { error: 'Licencia no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { action, durationDays = 365 } = body

    if (!action || !['activate', 'suspend', 'renew'].includes(action)) {
      return NextResponse.json(
        { error: 'Acción inválida. Debe ser: activate, suspend o renew' },
        { status: 400 }
      )
    }

    const now = new Date()

    const updatedLicense = await db.$transaction(async (tx) => {
      let updateData: Record<string, unknown> = {}

      if (action === 'activate') {
        const expirationDate = new Date(now)
        expirationDate.setDate(expirationDate.getDate() + durationDays)
        updateData = {
          status: 'ACTIVA',
          activationDate: now,
          expirationDate,
        }
      } else if (action === 'suspend') {
        updateData = {
          status: 'SUSPENDIDA',
        }
      } else if (action === 'renew') {
        const expirationDate = new Date(now)
        expirationDate.setDate(expirationDate.getDate() + durationDays)
        updateData = {
          status: 'ACTIVA',
          expirationDate,
        }
      }

      const updated = await tx.license.update({
        where: { id },
        data: updateData,
      })

      await tx.auditLog.create({
        data: {
          action: `LICENCIA_${action.toUpperCase()}`,
          module: 'LICENCIAS',
          details: `Licencia ${license.licenseKey} - acción: ${action}`,
          userId: payload.userId,
        },
      })

      return updated
    })

    return NextResponse.json({ license: updatedLicense })
  } catch (error) {
    console.error('License PUT error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
