import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET() {
  try {
    let config = await db.companyConfig.findFirst()
    if (!config) {
      // Create default config
      config = await db.companyConfig.create({
        data: {
          name: 'FacturaPro',
          ncfSequence: 'B0100000001',
          taxRate: 16,
          copyright: 'Zeus Rodriguez',
        },
      })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error('Company GET error:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload || (payload.role !== 'DESARROLLADOR' && payload.role !== 'ADMINISTRADOR')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, rnc, address, phone, email, logo, slogan, ncfSequence, taxRate, copyright } = body

    let config = await db.companyConfig.findFirst()

    if (config) {
      config = await db.companyConfig.update({
        where: { id: config.id },
        data: {
          ...(name !== undefined && { name }),
          ...(rnc !== undefined && { rnc }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
          ...(logo !== undefined && { logo }),
          ...(slogan !== undefined && { slogan }),
          ...(ncfSequence !== undefined && { ncfSequence }),
          ...(taxRate !== undefined && { taxRate }),
          ...(copyright !== undefined && { copyright }),
        },
      })
    } else {
      config = await db.companyConfig.create({
        data: {
          name: name || 'FacturaPro',
          rnc: rnc || null,
          address: address || null,
          phone: phone || null,
          email: email || null,
          logo: logo || null,
          ncfSequence: ncfSequence || 'B0100000001',
          taxRate: taxRate ?? 16,
          copyright: copyright || 'Zeus Rodriguez',
        },
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Company PUT error:', error)
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    )
  }
}
