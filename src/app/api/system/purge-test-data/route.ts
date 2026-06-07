import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload || payload.role !== 'DESARROLLADOR') {
      return NextResponse.json(
        { error: 'Solo el desarrollador puede ejecutar esta acción' },
        { status: 403 }
      )
    }

    // Delete all business data but keep system config
    // Order matters due to foreign key constraints

    // 1. Delete invoice items first (cascade from invoices)
    await db.invoiceItem.deleteMany({})

    // 2. Delete account entries
    await db.accountEntry.deleteMany({})

    // 3. Delete transactions
    await db.transaction.deleteMany({})

    // 4. Delete invoices
    await db.invoice.deleteMany({})

    // 5. Delete purchase order items (cascade from purchase orders)
    await db.purchaseOrderItem.deleteMany({})

    // 6. Delete purchase orders
    await db.purchaseOrder.deleteMany({})

    // 7. Delete stock movements
    await db.stockMovement.deleteMany({})

    // 8. Delete products
    await db.product.deleteMany({})

    // 9. Delete categories
    await db.category.deleteMany({})

    // 10. Delete clients
    await db.client.deleteMany({})

    // 11. Delete suppliers
    await db.supplier.deleteMany({})

    // 12. Delete notifications
    await db.notification.deleteMany({})

    // 13. Delete audit logs
    await db.auditLog.deleteMany({})

    // 14. Reset product counters on users - keep users intact
    // Users, CompanyConfig, DollarRate, and Licenses are preserved

    return NextResponse.json({
      success: true,
      message: 'Todos los datos de prueba han sido eliminados. Usuarios, licencias, tasas del dólar y configuración de la empresa se han preservado.',
    })
  } catch (error) {
    console.error('Purge test data error:', error)
    return NextResponse.json(
      { error: 'Error al eliminar datos de prueba' },
      { status: 500 }
    )
  }
}
