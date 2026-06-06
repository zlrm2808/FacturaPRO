import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface CompanyConfig {
  name: string
  logo?: string | null
  copyright?: string
  rnc?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  slogan?: string | null
}

interface InvoicePDFData {
  invoice: {
    number: string
    date: string
    subtotal: number
    tax: number
    discount: number
    total: number
    totalBs: number
    dollarRate: number
    status: string
    paymentMethod: string
    notes?: string | null
  }
  client: {
    name: string
    rncCedula?: string | null
    address?: string | null
    phone?: string | null
  } | null
  items: {
    name: string
    code: string
    quantity: number
    unitPrice: number
    discount: number
    subtotal: number
    unitOfMeasure: string
  }[]
  user: string
  dollarRate: number
}

const UNIT_ABBREV: Record<string, string> = {
  UNIDAD: 'Und',
  KILO: 'Kg',
  LITRO: 'Lt',
  CARTON: 'Crt',
  BOLSA: 'Bls',
  CAJA: 'Cja',
  GALON: 'Gal',
  METRO: 'Mtr',
  LIBRA: 'Lb',
}

const STATUS_LABELS: Record<string, string> = {
  PAGADA: 'PAGADA',
  PENDIENTE: 'PENDIENTE',
  VENCIDA: 'VENCIDA',
  ANULADA: 'ANULADA',
}

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CREDITO: 'Crédito',
}

function formatCurrencyPDF(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatBsPDF(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDatePDF(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

function addImageKeepAspectRatio(
  doc: jsPDF,
  imageData: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  format: string = 'PNG'
) {
  try {
    const imgProps = (doc as any).getImageProperties
      ? (doc as any).getImageProperties(imageData)
      : null

    if (imgProps && imgProps.width && imgProps.height) {
      const ratio = imgProps.width / imgProps.height
      let w = maxW
      let h = maxW / ratio
      if (h > maxH) {
        h = maxH
        w = maxH * ratio
      }
      const offsetX = (maxW - w) / 2
      const offsetY = (maxH - h) / 2
      doc.addImage(imageData, format, x + offsetX, y + offsetY, w, h)
    } else {
      doc.addImage(imageData, format, x, y, maxW, maxH)
    }
  } catch {
    try {
      doc.addImage(imageData, format, x, y, maxW, maxH)
    } catch {
      // Complete fallback
    }
  }
}

export function generateInvoiceDocumentPDF(company: CompanyConfig, data: InvoicePDFData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  let yPos = margin

  // === HEADER ===
  // Company logo or initial
  if (company.logo) {
    try {
      addImageKeepAspectRatio(doc, company.logo, margin, yPos, 20, 20)
    } catch {
      drawCompanyInitial(doc, margin, yPos, company.name)
    }
  } else {
    drawCompanyInitial(doc, margin, yPos, company.name)
  }

  // Company name
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(company.name, margin + 25, yPos + 7)

  // Company details
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  let detailY = yPos + 12
  if (company.rnc) {
    doc.text(`RNC: ${company.rnc}`, margin + 25, detailY)
    detailY += 3.5
  }
  if (company.address) {
    doc.text(company.address, margin + 25, detailY)
    detailY += 3.5
  }
  if (company.phone) {
    doc.text(`Tel: ${company.phone}`, margin + 25, detailY)
    detailY += 3.5
  }
  if (company.email) {
    doc.text(company.email, margin + 25, detailY)
  }

  // Invoice title (right side)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 185, 129)
  doc.text('FACTURA', pageWidth - margin, yPos + 7, { align: 'right' })

  // Invoice number
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(data.invoice.number, pageWidth - margin, yPos + 14, { align: 'right' })

  // Invoice date
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha: ${formatDatePDF(data.invoice.date)}`, pageWidth - margin, yPos + 19, { align: 'right' })

  // Status badge
  const statusLabel = STATUS_LABELS[data.invoice.status] || data.invoice.status
  const statusColors: Record<string, [number, number, number]> = {
    PAGADA: [16, 185, 129],
    PENDIENTE: [245, 158, 11],
    VENCIDA: [239, 68, 68],
    ANULADA: [156, 163, 175],
  }
  const statusColor = statusColors[data.invoice.status] || [156, 163, 175]
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.roundedRect(pageWidth - margin - 30, yPos + 21, 30, 6, 1, 1, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(statusLabel, pageWidth - margin - 15, yPos + 25, { align: 'center' })

  yPos = yPos + 32

  // === Separator ===
  doc.setDrawColor(16, 185, 129)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 6

  // === CLIENT INFO ===
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('DATOS DEL CLIENTE', margin, yPos)
  yPos += 5

  // Client box
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)

  if (data.client) {
    const leftCol = margin + 5
    const rightCol = margin + contentWidth / 2 + 5

    doc.setFont('helvetica', 'bold')
    doc.text('Nombre:', leftCol, yPos + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(data.client.name, leftCol + 18, yPos + 5)

    if (data.client.rncCedula) {
      doc.setFont('helvetica', 'bold')
      doc.text('RNC/Cédula:', leftCol, yPos + 10)
      doc.setFont('helvetica', 'normal')
      doc.text(data.client.rncCedula, leftCol + 22, yPos + 10)
    }

    if (data.client.address) {
      doc.setFont('helvetica', 'bold')
      doc.text('Dirección:', rightCol, yPos + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(data.client.address.substring(0, 45), rightCol + 18, yPos + 5)
    }

    if (data.client.phone) {
      doc.setFont('helvetica', 'bold')
      doc.text('Teléfono:', rightCol, yPos + 10)
      doc.setFont('helvetica', 'normal')
      doc.text(data.client.phone, rightCol + 18, yPos + 10)
    }
  } else {
    doc.setTextColor(100, 100, 100)
    doc.text('Consumidor Final', margin + 5, yPos + 8)
  }

  yPos += 22

  // === ITEMS TABLE ===
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('DETALLE DE PRODUCTOS', margin, yPos)
  yPos += 3

  const tableRows = data.items.map((item, idx) => [
    String(idx + 1),
    `${item.name}\n${item.code}`,
    `${item.quantity} ${UNIT_ABBREV[item.unitOfMeasure] || 'Und'}`,
    formatCurrencyPDF(item.unitPrice),
    item.discount > 0 ? formatCurrencyPDF(item.discount) : '—',
    formatCurrencyPDF(item.subtotal),
  ])

  autoTable(doc, {
    head: [[
      '#',
      'Producto',
      'Cant.',
      'P. Unitario',
      'Desc.',
      'Subtotal',
    ]],
    body: tableRows,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didDrawPage: () => {
      const footerY = pageHeight - 8
      doc.setFontSize(7)
      doc.setTextColor(128)
      doc.text(
        `\u00A9 ${company.copyright || 'Zeus Rodriguez'} - ${company.name}`,
        margin,
        footerY
      )
      doc.text(
        `Página ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        footerY,
        { align: 'right' }
      )
    },
  })

  // Get the Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 8

  // === TOTALS BOX (right aligned) ===
  const totalsBoxW = 85
  const totalsBoxX = pageWidth - margin - totalsBoxW

  // Subtotal
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Subtotal:', totalsBoxX, yPos)
  doc.setTextColor(30, 30, 30)
  doc.text(formatCurrencyPDF(data.invoice.subtotal), totalsBoxX + totalsBoxW, yPos, { align: 'right' })
  yPos += 5

  // IVA
  doc.setTextColor(80, 80, 80)
  doc.text('IVA (16%):', totalsBoxX, yPos)
  doc.setTextColor(30, 30, 30)
  doc.text(formatCurrencyPDF(data.invoice.tax), totalsBoxX + totalsBoxW, yPos, { align: 'right' })
  yPos += 5

  // Discount
  if (data.invoice.discount > 0) {
    doc.setTextColor(80, 80, 80)
    doc.text('Descuento:', totalsBoxX, yPos)
    doc.setTextColor(239, 68, 68)
    doc.text(`-${formatCurrencyPDF(data.invoice.discount)}`, totalsBoxX + totalsBoxW, yPos, { align: 'right' })
    yPos += 5
  }

  // Separator line
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(totalsBoxX, yPos, totalsBoxX + totalsBoxW, yPos)
  yPos += 5

  // Total USD
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Total USD:', totalsBoxX, yPos)
  doc.setTextColor(16, 185, 129)
  doc.text(formatCurrencyPDF(data.invoice.total), totalsBoxX + totalsBoxW, yPos, { align: 'right' })
  yPos += 6

  // Total Bs
  if (data.invoice.totalBs > 0) {
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text('Total Bs:', totalsBoxX, yPos)
    doc.setTextColor(16, 185, 129)
    doc.text(formatBsPDF(data.invoice.totalBs), totalsBoxX + totalsBoxW, yPos, { align: 'right' })
    yPos += 5

    // Dollar rate
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128)
    doc.text(`Tasa BCV: Bs. ${data.invoice.dollarRate.toFixed(2)}/USD`, totalsBoxX + totalsBoxW, yPos, { align: 'right' })
    yPos += 5
  }

  yPos += 5

  // === PAYMENT METHOD ===
  if (yPos < pageHeight - 40) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(`Método de Pago: `, margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(PAYMENT_LABELS[data.invoice.paymentMethod] || data.invoice.paymentMethod, margin + 32, yPos)
    yPos += 5

    // Cajero
    doc.setFont('helvetica', 'bold')
    doc.text(`Cajero: `, margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(data.user, margin + 18, yPos)
    yPos += 8
  }

  // === NOTES ===
  if (data.invoice.notes && yPos < pageHeight - 30) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('Observaciones:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    const lines = doc.splitTextToSize(data.invoice.notes, contentWidth)
    doc.text(lines, margin, yPos + 4)
  }

  // === FOOTER ===
  const footerY = pageHeight - 8
  doc.setFontSize(7)
  doc.setTextColor(128)
  doc.text(
    `\u00A9 ${company.copyright || 'Zeus Rodriguez'} - ${company.name}`,
    margin,
    footerY
  )
  doc.text(
    `Página 1 de ${doc.getNumberOfPages()}`,
    pageWidth - margin,
    footerY,
    { align: 'right' }
  )

  return doc
}

function drawCompanyInitial(
  doc: jsPDF,
  x: number,
  y: number,
  name: string
) {
  const initial = name.charAt(0).toUpperCase()
  doc.setFillColor(16, 185, 129)
  doc.circle(x + 10, y + 10, 10, 'F')
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255)
  doc.text(initial, x + 10, y + 14, { align: 'center' })
  doc.setTextColor(0)
}
