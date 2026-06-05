import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const payload = getUserFromRequest(request)

    if (payload) {
      // Create audit log for logout
      await db.auditLog.create({
        data: {
          action: 'LOGOUT',
          module: 'AUTH',
          details: 'Cierre de sesión',
          userId: payload.userId,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    // Even if audit log fails, still return success so client can clear session
    return NextResponse.json({ success: true })
  }
}
