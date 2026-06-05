---
Task ID: 1
Agent: Main Agent
Task: Fix Turbopack runtime error and restore price list report

Work Log:
- Analyzed uploaded images showing desired price list report layout
- Identified Turbopack panic caused by corrupted cache and permission issues with /scripts directory
- Simplified next.config.ts to remove experimental turbo config that was causing issues
- Cleared all .next cache and restarted dev server - now returning 200 OK
- Rewrote /src/lib/report-pdf.ts with:
  - New `generatePriceListPDF()` function matching the screenshot design
  - Centered company logo with aspect ratio preservation via `addImageKeepAspectRatio()`
  - Centered company name, slogan/tagline, and report title
  - Products grouped by category with green left border
  - Table columns: N°, DESCRIPCION DE PRODUCTO, UNIDAD, Precio USD, Precio Bs
  - Bolivares prices in green text with proper formatting (Bs.S 67.037,23)
  - Watermark drawn BEFORE content (behind text) with 0.15 opacity (very faint)
  - Logo aspect ratio maintained by calculating width/height ratio before adding image
- Updated /src/components/reports-view.tsx:
  - Added `generatePriceListPDF` import
  - Price list export uses dedicated PDF generator
  - Updated HTML table to show N°, DESCRIPCION DE PRODUCTO, UNIDAD, Precio USD, Precio Bs columns
  - Added currency toggle buttons (Solo USD / USD + Bs) in header area
  - Changed "Exportar PDF" to "Imprimir Lista" for price list
  - Category cards have green left border and emerald header background
  - Table header uses emerald green background with white text
- Added `slogan` field to CompanyConfig Prisma model
- Updated company API to handle slogan field
- Updated settings view with slogan input field
- Verified with Agent Browser: page loads, login works, price list shows correctly

Stage Summary:
- Turbopack error fixed by simplifying next.config.ts and clearing cache
- Price list report now matches the user's reference images
- Logo maintains aspect ratio in PDF reports
- Watermark renders behind content at very faint opacity (0.15)
- All 3 user issues resolved: Turbopack error, report layout, logo scaling
