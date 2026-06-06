# Task 1-a: Units of Measure & Decimal Quantities

## Summary
Updated inventory view and product-related backend to support units of measure (UoM) and decimal quantities across the POS application.

## Changes Made

### 1. `/src/app/api/products/route.ts`
- Changed `parseInt` to `parseFloat` for quantity and minStock parsing
- Added `unitOfMeasure` to destructured body fields
- Added `productUnitOfMeasure` variable defaulting to "UNIDAD" if not provided
- Added `unitOfMeasure: productUnitOfMeasure` to `db.product.create()` data

### 2. `/src/app/api/products/[id]/route.ts`
- Added `unitOfMeasure` to destructured body fields
- Changed `quantity` and `minStock` spread entries to use `parseFloat(String(...))` for decimal support
- Added `unitOfMeasure` spread entry in update data

### 3. `/src/components/inventory-view.tsx`
- Added `unitOfMeasure: string` to `Product` interface
- Added `unitOfMeasure: string` to `ProductFormData` interface
- Added `unitOfMeasure: 'UNIDAD'` to `emptyProductForm`
- Added `UOM_OPTIONS` constant with 9 unit options (UNIDAD, KILO, LITRO, CARTON, BOLSA, CAJA, GALON, METRO, LIBRA)
- Added `getUnitAbbr()` helper function mapping UoM values to abbreviations
- Changed `parseInt` to `parseFloat` in `createProductMutation`, `updateProductMutation`, `stockMovementMutation`
- Added `unitOfMeasure` field to all mutation payloads
- Added UoM Select dropdown in product dialog between quantity row and category row
- Added `step="0.01"` to quantity and minStock inputs
- Updated table stock display: `{product.quantity} {getUnitAbbr(product.unitOfMeasure)}`
- Updated table minStock display: `{product.minStock} {getUnitAbbr(product.unitOfMeasure)}`
- Updated stock movement dialog description to show unit abbreviation
- Added `step="0.01"` to movement quantity input
- Changed `parseInt` to `parseFloat` in `handleMovementSubmit` validation
- Updated detail dialog stock display: `{detailProduct.quantity} {detailProduct.unitOfMeasure || 'unidades'}`
- Updated detail dialog minStock display: `{detailProduct.minStock} {detailProduct.unitOfMeasure || 'unidades'}`
- Added `unitOfMeasure: product.unitOfMeasure || 'UNIDAD'` in `openEditProductDialog`

### 4. `/src/components/pos-view.tsx`
- Added `unitOfMeasure: string` to `Product` interface
- Updated stock badge display: `${product.quantity} ${product.unitOfMeasure ? product.unitOfMeasure.substring(0, 3).toLowerCase() : 'uds'}`

## Notes
- Prisma schema already had `unitOfMeasure` field with default "UNIDAD" and `quantity`/`minStock` as `Float` - no schema changes needed
- All existing products will get "UNIDAD" as default from the schema
- Lint check passed with no errors
