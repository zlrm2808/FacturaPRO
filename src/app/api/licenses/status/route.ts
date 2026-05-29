import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const activeLicense = await db.license.findFirst({
      where: { status: 'ACTIVA' },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeLicense) {
      return NextResponse.json({
        active: false,
        license: null,
        daysRemaining: null,
      })
    }

    const now = new Date()
    const expirationDate = new Date(activeLicense.expirationDate)
    const diffTime = expirationDate.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // If expired, update status
    if (daysRemaining <= 0 && activeLicense.status === 'ACTIVA') {
      await db.license.update({
        where: { id: activeLicense.id },
        data: { status: 'VENCIDA' },
      })
      return NextResponse.json({
        active: false,
        license: { ...activeLicense, status: 'VENCIDA' },
        daysRemaining,
      })
    }

    return NextResponse.json({
      active: daysRemaining > 0,
      license: activeLicense,
      daysRemaining,
    })
  } catch (error) {
    console.error('License status GET error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
