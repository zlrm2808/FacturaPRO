import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload || (payload.role !== 'DESARROLLADOR' && payload.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const clientId = body?.clientId || null

    if (clientId) {
      const clients = await db.client.findMany({ where: { id: clientId } })
      for (const client of clients) {
        const entries = await db.accountEntry.findMany({ where: { clientId: client.id }, select: { type: true, amount: true } })
        const computedBalance = entries.reduce((s, e) => s + (e.type === 'CREDITO' ? e.amount : -e.amount), 0)
        await db.client.update({ where: { id: client.id }, data: { balance: computedBalance } })
      }
      return NextResponse.json({ ok: true, clientId, message: 'Balances recalculados' })
    }

    const allClients = await db.client.findMany({ select: { id: true } })
    for (const c of allClients) {
      const entries = await db.accountEntry.findMany({ where: { clientId: c.id }, select: { type: true, amount: true } })
      const computedBalance = entries.reduce((s, e) => s + (e.type === 'CREDITO' ? e.amount : -e.amount), 0)
      await db.client.update({ where: { id: c.id }, data: { balance: computedBalance } })
    }

    return NextResponse.json({ ok: true, message: 'Balances recalculados para todos los clientes' })
  } catch (error) {
    console.error('Recompute balances error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
