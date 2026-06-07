import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ==================== USERS ====================
  console.log('Creando usuarios...')

  const devPassword = await bcrypt.hash('Zeus152804!', 10)
  const adminPassword = await bcrypt.hash('Admin123!', 10)
  const empleadoPassword = await bcrypt.hash('Empleado123!', 10)

  const desarrollador = await prisma.user.upsert({
    where: { username: 'zlrm2808' },
    update: {},
    create: {
      username: 'zlrm2808',
      password: devPassword,
      name: 'Desarrollador',
      role: 'DESARROLLADOR',
      active: true,
    },
  })

  const administrador = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: 'Administrador',
      role: 'ADMINISTRADOR',
      active: true,
    },
  })

  const empleado = await prisma.user.upsert({
    where: { username: 'empleado' },
    update: {},
    create: {
      username: 'empleado',
      password: empleadoPassword,
      name: 'Empleado Demo',
      role: 'EMPLEADO',
      active: true,
    },
  })

  console.log(`  ✅ Usuarios creados: ${desarrollador.username}, ${administrador.username}, ${empleado.username}`)

  // ==================== LICENSE ====================
  console.log('Creando licencia...')

  const now = new Date()
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

  const license = await prisma.license.upsert({
    where: { licenseKey: 'LIC-2024-DEFAULT-001' },
    update: {},
    create: {
      licenseKey: 'LIC-2024-DEFAULT-001',
      clientName: 'Sistema Principal',
      status: 'ACTIVA',
      activationDate: now,
      expirationDate: oneYearFromNow,
    },
  })

  console.log(`  ✅ Licencia creada: ${license.licenseKey}`)

  // ==================== CATEGORIES ====================
  console.log('Creando categorías...')

  const categoryNames = ['Bebidas', 'Alimentos', 'Limpieza', 'Snacks', 'Otros']
  const categories: Record<string, { id: string; name: string }> = {}

  for (const name of categoryNames) {
    let category = await prisma.category.findFirst({ where: { name } })
    if (!category) {
      category = await prisma.category.create({ data: { name } })
    }
    categories[name] = category
  }

  console.log(`  ✅ Categorías creadas: ${categoryNames.join(', ')}`)

  // ==================== PRODUCTS ====================
  console.log('Creando productos...')

  const productsData = [
    {
      code: 'PROD-001',
      name: 'Coca-Cola 2L',
      description: 'Refresco de cola botella 2 litros',
      purchasePrice: 45.00,
      salePrice: 65.00,
      quantity: 120,
      minStock: 20,
      categoryName: 'Bebidas',
    },
    {
      code: 'PROD-002',
      name: 'Agua Crystal 1.5L',
      description: 'Agua purificada botella 1.5 litros',
      purchasePrice: 20.00,
      salePrice: 35.00,
      quantity: 200,
      minStock: 30,
      categoryName: 'Bebidas',
    },
    {
      code: 'PROD-003',
      name: 'Arroz La Garza 5lbs',
      description: 'Arroz grano largo 5 libras',
      purchasePrice: 120.00,
      salePrice: 165.00,
      quantity: 80,
      minStock: 15,
      categoryName: 'Alimentos',
    },
    {
      code: 'PROD-004',
      name: 'Aceite Crisol 1L',
      description: 'Aceite vegetal botella 1 litro',
      purchasePrice: 85.00,
      salePrice: 120.00,
      quantity: 60,
      minStock: 10,
      categoryName: 'Alimentos',
    },
    {
      code: 'PROD-005',
      name: 'Detergente ACE 1.8kg',
      description: 'Detergente en polvo 1.8 kilogramos',
      purchasePrice: 180.00,
      salePrice: 245.00,
      quantity: 40,
      minStock: 8,
      categoryName: 'Limpieza',
    },
    {
      code: 'PROD-006',
      name: 'Jabón de Platos Dawn 500ml',
      description: 'Jabón líquido para platos 500ml',
      purchasePrice: 55.00,
      salePrice: 85.00,
      quantity: 70,
      minStock: 12,
      categoryName: 'Limpieza',
    },
    {
      code: 'PROD-007',
      name: 'Doritos Nacho 170g',
      description: 'Snack de tortilla sabor nacho 170 gramos',
      purchasePrice: 40.00,
      salePrice: 65.00,
      quantity: 150,
      minStock: 25,
      categoryName: 'Snacks',
    },
    {
      code: 'PROD-008',
      name: 'Galletas Oreo 6-pack',
      description: 'Galletas sándwich de chocolate paquete 6',
      purchasePrice: 50.00,
      salePrice: 75.00,
      quantity: 90,
      minStock: 15,
      categoryName: 'Snacks',
    },
  ]

  const products: Record<string, { id: string; code: string }> = {}

  for (const pData of productsData) {
    const product = await prisma.product.upsert({
      where: { code: pData.code },
      update: {},
      create: {
        code: pData.code,
        name: pData.name,
        description: pData.description,
        purchasePrice: pData.purchasePrice,
        salePrice: pData.salePrice,
        quantity: pData.quantity,
        minStock: pData.minStock,
        status: 'ACTIVO',
        categoryId: categories[pData.categoryName]?.id,
      },
    })
    products[pData.code] = product
  }

  console.log(`  ✅ Productos creados: ${productsData.length}`)

  // ==================== CLIENTS ====================
  console.log('Creando clientes...')

  const clientsData = [
    {
      name: 'Juan Pérez García',
      phone: '809-555-1234',
      address: 'Calle Duarte #45, Santo Domingo',
      email: 'juan.perez@email.com',
      rncCedula: '001-1234567-8',
      balance: 1500.00,
    },
    {
      name: 'María López Sánchez',
      phone: '829-555-5678',
      address: 'Av. Independencia #120, Santiago',
      email: 'maria.lopez@email.com',
      rncCedula: '402-0987654-3',
      balance: 3200.50,
    },
    {
      name: 'Carlos Ramírez Díaz',
      phone: '849-555-9012',
      address: 'Calle El Sol #78, La Vega',
      email: 'carlos.ramirez@email.com',
      rncCedula: '031-5678901-2',
      balance: 0,
    },
    {
      name: 'Ana Martínez Reyes',
      phone: '809-555-3456',
      address: 'Calle Las Flores #33, San Pedro de Macorís',
      email: 'ana.martinez@email.com',
      rncCedula: '002-3456789-1',
      balance: 750.00,
    },
    {
      name: 'Roberto Fernández Torres',
      phone: '829-555-7890',
      address: 'Autopista Duarte Km 15, Santo Domingo',
      email: 'roberto.fernandez@email.com',
      rncCedula: '101-234567-1',
      balance: 5600.00,
    },
  ]

  // Clean up existing demo data to make seed idempotent
  await prisma.invoiceItem.deleteMany({})
  await prisma.invoice.deleteMany({})
  await prisma.transaction.deleteMany({})
  await prisma.accountEntry.deleteMany({})
  await prisma.client.deleteMany({})

  const clients: { id: string; name: string }[] = []

  for (const cData of clientsData) {
    const client = await prisma.client.create({
      data: cData,
    })
    clients.push(client)
  }

  console.log(`  ✅ Clientes creados: ${clients.length}`)

  // ==================== INVOICES ====================
  console.log('Creando facturas...')

  // Invoice 1: Paid in cash
  const invoice1Items = [
    { productId: products['PROD-001']!.id, quantity: 3, unitPrice: 65.00, discount: 0 },
    { productId: products['PROD-003']!.id, quantity: 2, unitPrice: 165.00, discount: 0 },
    { productId: products['PROD-007']!.id, quantity: 5, unitPrice: 65.00, discount: 0 },
  ]
  const invoice1Subtotal = invoice1Items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0)
  const invoice1Tax = invoice1Subtotal * 0.18
  const invoice1Discount = 0
  const invoice1Total = invoice1Subtotal + invoice1Tax - invoice1Discount

  const invoice1 = await prisma.invoice.create({
    data: {
      number: 'FAC-000001',
      subtotal: invoice1Subtotal,
      tax: invoice1Tax,
      discount: invoice1Discount,
      total: invoice1Total,
      status: 'PAGADA',
      paymentMethod: 'EFECTIVO',
      notes: 'Venta regular',
      clientId: clients[0]!.id,
      userId: administrador.id,
      items: {
        create: invoice1Items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice - item.discount,
          discount: item.discount,
          productId: item.productId,
        })),
      },
    },
  })

  // Invoice 2: Pending with credit
  const invoice2Items = [
    { productId: products['PROD-004']!.id, quantity: 4, unitPrice: 120.00, discount: 0 },
    { productId: products['PROD-005']!.id, quantity: 2, unitPrice: 245.00, discount: 0 },
    { productId: products['PROD-002']!.id, quantity: 6, unitPrice: 35.00, discount: 0 },
  ]
  const invoice2Subtotal = invoice2Items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0)
  const invoice2Tax = invoice2Subtotal * 0.18
  const invoice2Discount = 50.00
  const invoice2Total = invoice2Subtotal + invoice2Tax - invoice2Discount

  const invoice2 = await prisma.invoice.create({
    data: {
      number: 'FAC-000002',
      subtotal: invoice2Subtotal,
      tax: invoice2Tax,
      discount: invoice2Discount,
      total: invoice2Total,
      status: 'PENDIENTE',
      paymentMethod: 'CREDITO',
      notes: 'Venta a crédito - pago en 30 días',
      clientId: clients[1]!.id,
      userId: empleado.id,
      items: {
        create: invoice2Items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice - item.discount,
          discount: item.discount,
          productId: item.productId,
        })),
      },
    },
  })

  // Invoice 3: Paid by transfer
  const invoice3Items = [
    { productId: products['PROD-006']!.id, quantity: 3, unitPrice: 85.00, discount: 0 },
    { productId: products['PROD-008']!.id, quantity: 10, unitPrice: 75.00, discount: 50.00 },
  ]
  const invoice3Subtotal = invoice3Items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0)
  const invoice3Tax = invoice3Subtotal * 0.18
  const invoice3Discount = 0
  const invoice3Total = invoice3Subtotal + invoice3Tax - invoice3Discount

  const invoice3 = await prisma.invoice.create({
    data: {
      number: 'FAC-000003',
      subtotal: invoice3Subtotal,
      tax: invoice3Tax,
      discount: invoice3Discount,
      total: invoice3Total,
      status: 'PAGADA',
      paymentMethod: 'TRANSFERENCIA',
      notes: 'Pedido especial',
      clientId: clients[4]!.id,
      userId: administrador.id,
      items: {
        create: invoice3Items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice - item.discount,
          discount: item.discount,
          productId: item.productId,
        })),
      },
    },
  })

  console.log(`  ✅ Facturas creadas: ${invoice1.number}, ${invoice2.number}, ${invoice3.number}`)

  // ==================== SUPPLIERS ====================
  console.log('Creando proveedores...')

  const suppliersData = [
    {
      name: 'Distribuidora Nacional SRL',
      phone: '809-532-1000',
      email: 'ventas@distnacional.com.do',
      address: 'Zona Industrial de Herrera, Santo Domingo',
      rncCedula: '101-234567-2',
      contactName: 'Pedro Herrera',
      status: 'ACTIVO',
    },
    {
      name: 'Importaciones La Fuente',
      phone: '829-544-2200',
      email: 'contacto@lafuente.com.do',
      address: 'Calle El Sol #12, Santiago',
      rncCedula: '102-345678-3',
      contactName: 'Ana Gómez',
      status: 'ACTIVO',
    },
    {
      name: 'Bebidas del Caribe',
      phone: '809-567-3300',
      email: 'pedidos@bebidascaribe.com.do',
      address: 'Autopista Las Américas Km 8, Santo Domingo',
      rncCedula: '103-456789-4',
      contactName: 'Ricardo Vega',
      status: 'ACTIVO',
    },
  ]

  const suppliers: { id: string; name: string }[] = []
  for (const sData of suppliersData) {
    const existing = await prisma.supplier.findFirst({ where: { name: sData.name } })
    if (!existing) {
      const supplier = await prisma.supplier.create({ data: sData })
      suppliers.push(supplier)
    } else {
      suppliers.push(existing)
    }
  }
  console.log(`  ✅ Proveedores creados: ${suppliers.length}`)

  // ==================== OVERDUE INVOICE (for WhatsApp demo) ====================
  console.log('Creando factura vencida de demostración...')

  const overdueItems = [
    { productId: products['PROD-001']!.id, quantity: 5, unitPrice: 65.00, discount: 0 },
    { productId: products['PROD-005']!.id, quantity: 1, unitPrice: 245.00, discount: 0 },
  ]
  const overdueSubtotal = overdueItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0)
  const overdueTax = overdueSubtotal * 0.18
  const overdueTotal = overdueSubtotal + overdueTax

  // Create an overdue invoice (date 45 days ago)
  const overdueDate = new Date()
  overdueDate.setDate(overdueDate.getDate() - 45)

  const existingOverdue = await prisma.invoice.findFirst({ where: { number: 'FAC-000004' } })
  if (!existingOverdue) {
    await prisma.invoice.create({
      data: {
        number: 'FAC-000004',
        date: overdueDate,
        subtotal: overdueSubtotal,
        tax: overdueTax,
        discount: 0,
        total: overdueTotal,
        status: 'VENCIDA',
        paymentMethod: 'CREDITO',
        notes: 'Factura vencida - pago a 30 días',
        clientId: clients[0]!.id, // Juan Pérez
        userId: administrador.id,
        items: {
          create: overdueItems.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice - item.discount,
            discount: item.discount,
            productId: item.productId,
          })),
        },
      },
    })
    console.log('  ✅ Factura vencida creada: FAC-000004')
  } else {
    console.log('  ⏭️  Factura vencida ya existe')
  }

  // Another overdue for a different client
  const overdue2Items = [
    { productId: products['PROD-003']!.id, quantity: 10, unitPrice: 165.00, discount: 0 },
    { productId: products['PROD-004']!.id, quantity: 5, unitPrice: 120.00, discount: 0 },
  ]
  const overdue2Subtotal = overdue2Items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0)
  const overdue2Tax = overdue2Subtotal * 0.18
  const overdue2Total = overdue2Subtotal + overdue2Tax

  const overdue2Date = new Date()
  overdue2Date.setDate(overdue2Date.getDate() - 60)

  const existingOverdue2 = await prisma.invoice.findFirst({ where: { number: 'FAC-000005' } })
  if (!existingOverdue2) {
    await prisma.invoice.create({
      data: {
        number: 'FAC-000005',
        date: overdue2Date,
        subtotal: overdue2Subtotal,
        tax: overdue2Tax,
        discount: 0,
        total: overdue2Total,
        status: 'VENCIDA',
        paymentMethod: 'CREDITO',
        notes: 'Factura vencida - pago a 30 días',
        clientId: clients[4]!.id, // Roberto Fernández (has phone 829-555-7890)
        userId: administrador.id,
        items: {
          create: overdue2Items.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice - item.discount,
            discount: item.discount,
            productId: item.productId,
          })),
        },
      },
    })
    console.log('  ✅ Factura vencida creada: FAC-000005')
  } else {
    console.log('  ⏭️  Factura vencida 2 ya existe')
  }

  console.log('\n🌱 Seed completado exitosamente')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
