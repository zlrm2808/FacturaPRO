import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { fetchAndSaveDollarRate, getEffectiveDollarRate } from '@/lib/dollar-rate'

// GET /api/dollar-rates - Get dollar rates
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || ''
    const dateStr = searchParams.get('date') || ''

    // Get effective rate for a specific date
    if (action === 'effective') {
      const targetDate = dateStr ? new Date(dateStr) : new Date()
      const rate = await getEffectiveDollarRate(targetDate)
      return NextResponse.json(rate)
    }

    // Get today's rate (try fetching fresh first)
    if (action === 'today') {
      try {
        const fresh = await fetchAndSaveDollarRate()
        return NextResponse.json({
          officialRate: fresh.officialRate,
          parallelRate: fresh.parallelRate,
          date: fresh.date,
          id: fresh.id,
        })
      } catch {
        // If API fails, fall back to stored rate
        const rate = await getEffectiveDollarRate(new Date())
        return NextResponse.json(rate)
      }
    }

    // Default: list recent rates (last 30 days)
    const limit = parseInt(searchParams.get('limit') || '30', 10)
    const rates = await db.dollarRate.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    })

    // Also get today's effective rate
    const todayRate = await getEffectiveDollarRate(new Date())

    return NextResponse.json({
      rates,
      todayRate,
    })
  } catch (error) {
    console.error('Error getting dollar rates:', error)
    return NextResponse.json({ error: 'Error al obtener tasas del dólar' }, { status: 500 })
  }
}

// POST /api/dollar-rates - Fetch and save current rates from the API
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (user.role === 'EMPLEADO') {
      return NextResponse.json({ error: 'No tiene permisos para actualizar tasas' }, { status: 403 })
    }

    const result = await fetchAndSaveDollarRate()

    await db.auditLog.create({
      data: {
        action: 'ACTUALIZAR_TASA_DOLAR',
        module: 'DOLAR',
        details: `Tasa actualizada: Oficial=${result.officialRate}, Paralelo=${result.parallelRate}`,
        userId: user.userId,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching dollar rates:', error)
    return NextResponse.json({ error: 'Error al obtener tasas del dólar desde la API' }, { status: 500 })
  }
}
