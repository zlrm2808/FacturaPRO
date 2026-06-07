import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface CompanyConfig {
  name: string
  logo?: string | null
  copyright?: string
  rnc?: string | null
  address?: string | null
  phone?: string | null
  slogan?: string | null
}

interface ReportConfig {
  title: string
  subtitle?: string
  fromDate?: string
  toDate?: string
  headers: string[]
  rows: (string | number)[][]
  summaryCards?: { label: string; value: string }[]
  orientation?: 'portrait' | 'landscape'
  watermark?: boolean
  groupHeaders?: { label: string; colspan: number }[]
}

/**
 * Add image to PDF maintaining aspect ratio
 */
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
    // Get image dimensions from the jsPDF internal array
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
      // Center the image in the bounding box
      const offsetX = (maxW - w) / 2
      const offsetY = (maxH - h) / 2
      doc.addImage(imageData, format, x + offsetX, y + offsetY, w, h)
    } else {
      // Fallback: try adding with max dimensions
      doc.addImage(imageData, format, x, y, maxW, maxH)
    }
  } catch {
    // If getImageProperties fails, just add with fixed dimensions
    try {
      doc.addImage(imageData, format, x, y, maxW, maxH)
    } catch {
      // Complete fallback
    }
  }
}

export function generateReportPDF(company: CompanyConfig, report: ReportConfig): jsPDF {
  const doc = new jsPDF({
    orientation: report.orientation || 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // Draw watermark BEFORE any other content (so it's behind everything)
  if (report.watermark) {
    drawWatermark(doc, pageWidth, pageHeight, company)
  }

  // 1. Draw header with company info
  let yPos = margin

  // Company logo or initial circle
  if (company.logo) {
    try {
      addImageKeepAspectRatio(doc, company.logo, margin, yPos, 20, 20)
    } catch {
      drawCompanyInitial(doc, margin, yPos, company.name)
    }
  } else {
    drawCompanyInitial(doc, margin, yPos, company.name)
  }

  // Company name next to logo
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(company.name, margin + 25, yPos + 8)

  // Company details
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  let detailY = yPos + 14
  if (company.rnc) {
    doc.text(`RNC: ${company.rnc}`, margin + 25, detailY)
    detailY += 4
  }
  if (company.address) {
    doc.text(company.address, margin + 25, detailY)
    detailY += 4
  }
  if (company.phone) {
    doc.text(`Tel: ${company.phone}`, margin + 25, detailY)
  }

  yPos = yPos + 28

  // 2. Report title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(report.title, pageWidth / 2, yPos, { align: 'center' })
  yPos += 7

  // Date range
  if (report.fromDate && report.toDate) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Período: ${report.fromDate} al ${report.toDate}`,
      pageWidth / 2,
      yPos,
      { align: 'center' }
    )
    yPos += 6
  }

  // Subtitle
  if (report.subtitle) {
    doc.setFontSize(9)
    doc.text(report.subtitle, pageWidth / 2, yPos, { align: 'center' })
    yPos += 6
  }

  // Generation date
  doc.setFontSize(8)
  doc.setTextColor(128)
  doc.text(
    `Generado: ${new Date().toLocaleString('es-VE')}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  )
  doc.setTextColor(0)
  yPos += 8

  // 3. Summary cards (if any)
  if (report.summaryCards && report.summaryCards.length > 0) {
    const cardWidth =
      (pageWidth - margin * 2 - (report.summaryCards.length - 1) * 3) /
      report.summaryCards.length
    report.summaryCards.forEach((card, i) => {
      const x = margin + i * (cardWidth + 3)
      doc.setFillColor(240, 253, 244)
      doc.roundedRect(x, yPos, cardWidth, 16, 2, 2, 'F')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(card.label, x + cardWidth / 2, yPos + 5, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 185, 129)
      doc.text(card.value, x + cardWidth / 2, yPos + 12, { align: 'center' })
      doc.setTextColor(0)
    })
    yPos += 22
  }

  // 4. Data table using autoTable
  if (report.rows.length > 0) {
    let head: (string | { content: string; colSpan: number })[][] = [report.headers]

    if (report.groupHeaders && report.groupHeaders.length > 0) {
      const groupRow: { content: string; colSpan: number }[] = []
      report.groupHeaders.forEach((gh) => {
        groupRow.push({ content: gh.label, colSpan: gh.colspan })
      })
      head = [groupRow, report.headers]
    }

    autoTable(doc, {
      head,
      body: report.rows,
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      willDrawPage: () => {
        if (report.watermark) {
          drawWatermark(doc, pageWidth, pageHeight, company)
        }
      },
      didDrawPage: () => {
        const footerY = pageHeight - 10
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
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text(
      'No hay datos para el período seleccionado',
      pageWidth / 2,
      yPos + 20,
      { align: 'center' }
    )
    const footerY = pageHeight - 10
    doc.setFontSize(7)
    doc.setTextColor(128)
    doc.text(
      `\u00A9 ${company.copyright || 'Zeus Rodriguez'} - ${company.name}`,
      margin,
      footerY
    )
  }

  return doc
}

/**
 * Generate a dedicated Price List PDF matching the visual design from the screenshots.
 * - Centered company logo (maintaining aspect ratio)
 * - Company name + tagline centered
 * - Lista De Precios title + date + BCV rate
 * - Products grouped by category with green left border
 * - Table columns: N°, DESCRIPCION DE PRODUCTO, UNIDAD, Precio USD, Precio Bs
 */
export function generatePriceListPDF(
  company: CompanyConfig,
  data: {
    products: {
      id: string
      code: string
      name: string
      salePrice: number
      salePriceBs: number
      category: string
      unit?: string
    }[]
    byCategory: Record<string, {
      id: string
      code: string
      name: string
      salePrice: number
      salePriceBs: number
      quantity: number
      category: string
      unit?: string
    }[]>
    dollarRate: number
    totalProducts: number
    categories: number
    currency: string
    clientName?: string
  },
  options: {
    watermark?: boolean
  } = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  // Draw watermark first (behind everything)
  if (options.watermark) {
    drawWatermark(doc, pageWidth, pageHeight, company)
  }

  let yPos = margin + 5

  // === CENTERED LOGO ===
  const logoSize = 25
  const logoX = (pageWidth - logoSize) / 2
  if (company.logo) {
    try {
      addImageKeepAspectRatio(doc, company.logo, logoX, yPos, logoSize, logoSize)
    } catch {
      drawCompanyInitialCentered(doc, pageWidth / 2, yPos + logoSize / 2, company.name, logoSize)
    }
  } else {
    drawCompanyInitialCentered(doc, pageWidth / 2, yPos + logoSize / 2, company.name, logoSize)
  }
  yPos += logoSize + 3

  // === CENTERED COMPANY NAME ===
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(company.name, pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  // === CENTERED TAGLINE / SLOGAN ===
  const tagline = company.slogan || company.address || ''
  if (tagline) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(tagline.toUpperCase(), pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
  }

  // === LISTA DE PRECIOS TITLE ===
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Lista De Precios', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  // === CLIENT NAME ===
  if (data.clientName) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 120, 0)
    doc.text(`Cliente: ${data.clientName}`, pageWidth / 2, yPos, { align: 'center' })
    doc.setTextColor(0)
    yPos += 5
  }

  // === DATE ===
  const today = new Date()
  const dateStr = today.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha: ${dateStr}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 4

  // === BCV RATE ===
  if (data.dollarRate > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(16, 185, 129)
    doc.text(`Tasa BCV: Bs. ${data.dollarRate.toFixed(2)} por USD`, pageWidth / 2, yPos, { align: 'center' })
    doc.setTextColor(0)
    yPos += 4
  }

  yPos += 4

  // === SUMMARY CARDS ===
  const summaryCards = [
    { label: 'Total Productos', value: String(data.totalProducts) },
    { label: 'Categorías', value: String(data.categories) },
  ]
  if (data.dollarRate > 0) {
    summaryCards.push({ label: 'Tasa BCV', value: `Bs. ${data.dollarRate.toFixed(2)}` })
  }
  {
    const cardWidth =
      (contentWidth - (summaryCards.length - 1) * 3) / summaryCards.length
    summaryCards.forEach((card, i) => {
      const x = margin + i * (cardWidth + 3)
      doc.setFillColor(240, 253, 244)
      doc.roundedRect(x, yPos, cardWidth, 14, 2, 2, 'F')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(card.label, x + cardWidth / 2, yPos + 4, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 185, 129)
      doc.text(card.value, x + cardWidth / 2, yPos + 10, { align: 'center' })
      doc.setTextColor(0)
    })
    yPos += 20
  }

  // === PRODUCTS BY CATEGORY ===
  const isBoth = data.currency === 'both'
  const byCategory = data.byCategory || {}
  const categoryEntries = Object.entries(byCategory) as [string, {
    id: string
    code: string
    name: string
    salePrice: number
    salePriceBs: number
    quantity: number
    category: string
    unit?: string
  }[]][]

  categoryEntries.forEach(([catName, products]) => {
    // Check if we need a new page (need at least 30mm for header + a few rows)
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
      if (options.watermark) {
        drawWatermark(doc, pageWidth, pageHeight, company)
      }
    }

    // Category header with green left border
    const catHeaderH = 8
    // Green left border
    doc.setFillColor(16, 185, 129)
    doc.rect(margin, yPos, 3, catHeaderH, 'F')
    // Category name background
    doc.setFillColor(240, 253, 244)
    doc.rect(margin + 3, yPos, contentWidth - 3, catHeaderH, 'F')
    // Category text
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(catName, margin + 7, yPos + 5.5)
    yPos += catHeaderH + 1

    // Table header
    const headerH = 7
    doc.setFillColor(16, 185, 129)
    doc.rect(margin, yPos, contentWidth, headerH, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)

    if (isBoth) {
      const colWidths = [12, contentWidth - 12 - 25 - 30 - 30, 25, 30, 30]
      let colX = margin + 2
      doc.text('N°', colX, yPos + 4.5); colX += colWidths[0]
      doc.text('DESCRIPCION DE PRODUCTO', colX, yPos + 4.5); colX += colWidths[1]
      doc.text('UNIDAD', colX, yPos + 4.5); colX += colWidths[2]
      doc.text('Precio USD', colX + colWidths[3] - 2, yPos + 4.5, { align: 'right' }); colX += colWidths[3]
      doc.text('Precio Bs', colX + colWidths[4] - 2, yPos + 4.5, { align: 'right' })
    } else {
      const colWidths = [12, contentWidth - 12 - 25 - 30 - 30, 25, 30]
      let colX = margin + 2
      doc.text('N°', colX, yPos + 4.5); colX += colWidths[0]
      doc.text('DESCRIPCION DE PRODUCTO', colX, yPos + 4.5); colX += colWidths[1]
      doc.text('UNIDAD', colX, yPos + 4.5); colX += colWidths[2]
      doc.text('Precio USD', colX + colWidths[3] - 2, yPos + 4.5, { align: 'right' })
    }
    yPos += headerH

    // Product rows
    products.forEach((product, idx) => {
      // Check page break
      if (yPos > pageHeight - 20) {
        doc.addPage()
        yPos = margin
        if (options.watermark) {
          drawWatermark(doc, pageWidth, pageHeight, company)
        }
      }

      const rowH = 6
      // Alternate row background
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250)
        doc.rect(margin, yPos, contentWidth, rowH, 'F')
      }

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)

      if (isBoth) {
        const colWidths = [12, contentWidth - 12 - 25 - 30 - 30, 25, 30, 30]
        let colX = margin + 2
        doc.text(String(idx + 1), colX, yPos + 4); colX += colWidths[0]
        doc.text(product.name, colX, yPos + 4); colX += colWidths[1]
        doc.setFontSize(7)
        doc.text(product.unit || 'Unidad', colX, yPos + 4); colX += colWidths[2]
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(`USD ${product.salePrice.toFixed(2)}`, colX + colWidths[3] - 2, yPos + 4, { align: 'right' }); colX += colWidths[3]
        // Precio Bs in green
        doc.setTextColor(16, 185, 129)
        doc.text(
          product.salePriceBs > 0 ? `Bs.S ${formatBsNumber(product.salePriceBs)}` : '-',
          colX + colWidths[4] - 2,
          yPos + 4,
          { align: 'right' }
        )
      } else {
        const colWidths = [12, contentWidth - 12 - 25 - 30 - 30, 25, 30]
        let colX = margin + 2
        doc.text(String(idx + 1), colX, yPos + 4); colX += colWidths[0]
        doc.text(product.name, colX, yPos + 4); colX += colWidths[1]
        doc.setFontSize(7)
        doc.text(product.unit || 'Unidad', colX, yPos + 4); colX += colWidths[2]
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(16, 185, 129)
        doc.text(`USD ${product.salePrice.toFixed(2)}`, colX + colWidths[3] - 2, yPos + 4, { align: 'right' })
      }

      doc.setTextColor(0)
      yPos += rowH
    })

    yPos += 5 // Space between categories
  })

  // === FOOTER ON ALL PAGES ===
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const footerY = pageHeight - 10
    doc.setFontSize(7)
    doc.setTextColor(128)
    doc.text(
      `\u00A9 ${company.copyright || 'Zeus Rodriguez'} - ${company.name}`,
      margin,
      footerY
    )
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      footerY,
      { align: 'right' }
    )
  }

  return doc
}

/**
 * Format Bolivares number with dots as thousand separator and comma as decimal
 * e.g. 67037.23 → "67.037,23"
 */
function formatBsNumber(num: number): string {
  const fixed = num.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted},${decPart}`
}

/**
 * Draw a watermark on the page - company logo or first letter
 * Centered, rotated 45°, with 50% transparency so it appears behind all content
 */
function drawWatermark(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  company: CompanyConfig
) {
  const centerX = pageWidth / 2
  const centerY = pageHeight / 2

  // Use GState for 50% transparency
  try {
    const gState = new (doc as any).GState({ opacity: 0.15, strokeOpacity: 0.15 })
    ;(doc as any).setGState(gState)
  } catch {
    // If GState is not available, just use light colors as fallback
  }

  if (company.logo) {
    try {
      // Draw logo watermark maintaining aspect ratio, large and centered
      addImageKeepAspectRatio(doc, company.logo, centerX - 40, centerY - 40, 80, 80)
    } catch {
      drawTextWatermark(doc, centerX, centerY, company.name)
    }
  } else {
    drawTextWatermark(doc, centerX, centerY, company.name)
  }

  // Reset opacity
  try {
    const resetGState = new (doc as any).GState({ opacity: 1, strokeOpacity: 1 })
    ;(doc as any).setGState(resetGState)
  } catch {
    // Fallback: just continue
  }
}

function drawTextWatermark(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  name: string
) {
  const initial = name.charAt(0).toUpperCase()

  doc.setFontSize(180)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(200, 200, 200)
  doc.text(initial, centerX, centerY + 15, {
    align: 'center',
    angle: 45,
  })
  doc.setTextColor(0)
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

function drawCompanyInitialCentered(
  doc: jsPDF,
  cx: number,
  cy: number,
  name: string,
  size: number
) {
  const initial = name.charAt(0).toUpperCase()
  const radius = size / 2
  doc.setFillColor(16, 185, 129)
  doc.circle(cx, cy, radius, 'F')
  doc.setFontSize(size * 0.8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255)
  doc.text(initial, cx, cy + radius * 0.35, { align: 'center' })
  doc.setTextColor(0)
}
