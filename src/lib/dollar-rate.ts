import { db } from '@/lib/db'

/**
 * Get the effective dollar rate for a given date.
 * - If a rate exists for that date, use it
 * - If no rate exists (weekends, holidays), use the last available rate before that date
 * - If no rate exists at all, fetch from the API
 */
export async function getEffectiveDollarRate(date: Date): Promise<{ officialRate: number; parallelRate: number; dollarRateId: string | null }> {
  // Normalize date to start of day
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // Try to find rate for this exact date
  const exactRate = await db.dollarRate.findFirst({
    where: {
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  })

  if (exactRate) {
    return {
      officialRate: exactRate.officialRate,
      parallelRate: exactRate.parallelRate,
      dollarRateId: exactRate.id,
    }
  }

  // No rate for this date - find the most recent rate before this date
  const lastRate = await db.dollarRate.findFirst({
    where: {
      date: {
        lt: dayStart,
      },
    },
    orderBy: { date: 'desc' },
  })

  if (lastRate) {
    return {
      officialRate: lastRate.officialRate,
      parallelRate: lastRate.parallelRate,
      dollarRateId: lastRate.id,
    }
  }

  // No rates at all in the database - try to fetch from API
  try {
    const fetched = await fetchAndSaveDollarRate()
    return {
      officialRate: fetched.officialRate,
      parallelRate: fetched.parallelRate,
      dollarRateId: fetched.id,
    }
  } catch (error) {
    console.error('Failed to fetch dollar rate from API:', error)
    // Fallback: return a default rate (should not happen in production)
    return {
      officialRate: 0,
      parallelRate: 0,
      dollarRateId: null,
    }
  }
}

/**
 * Fetch dollar rates from ve.dolarapi.com and save to database
 */
export async function fetchAndSaveDollarRate(): Promise<{
  id: string
  officialRate: number
  parallelRate: number
  date: Date
}> {
  const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch dollar rates: ${response.status}`)
  }

  const data = await response.json()

  // Extract official and parallel rates
  const oficialEntry = data.find((item: { fuente: string }) => item.fuente === 'oficial')
  const paraleloEntry = data.find((item: { fuente: string }) => item.fuente === 'paralelo')

  const officialRate = oficialEntry?.promedio || 0
  const parallelRate = paraleloEntry?.promedio || 0

  if (officialRate === 0 && parallelRate === 0) {
    throw new Error('No valid rates found in API response')
  }

  // Use the date from the official rate's last update, or today
  const rateDate = oficialEntry?.fechaActualizacion
    ? new Date(oficialEntry.fechaActualizacion)
    : new Date()

  // Normalize to start of day
  const dayStart = new Date(rateDate.getFullYear(), rateDate.getMonth(), rateDate.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // Upsert: save or update rate for this date
  const saved = await db.dollarRate.upsert({
    where: {
      date: dayStart,
    },
    update: {
      officialRate,
      parallelRate,
    },
    create: {
      date: dayStart,
      officialRate,
      parallelRate,
      source: 've.dolarapi.com',
    },
  })

  return {
    id: saved.id,
    officialRate: saved.officialRate,
    parallelRate: saved.parallelRate,
    date: saved.date,
  }
}

/**
 * Get today's effective dollar rate (convenience function)
 */
export async function getTodayDollarRate(): Promise<{ officialRate: number; parallelRate: number }> {
  const rate = await getEffectiveDollarRate(new Date())
  return {
    officialRate: rate.officialRate,
    parallelRate: rate.parallelRate,
  }
}
