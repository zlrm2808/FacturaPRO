# Task 1b - Supplier and Purchase Order API Routes

## Summary
Created 5 API route files for the POS system covering Suppliers, Purchase Orders, and Overdue Invoices modules.

## Files Created

1. **`/src/app/api/suppliers/route.ts`**
   - `GET` - List all suppliers with `?search=xxx` support across name, phone, email, rncCedula, contactName; includes purchase order count
   - `POST` - Create supplier with body `{ name, phone, email, address, rncCedula, contactName }`; validates name required; creates CREAR_PROVEEDOR audit log

2. **`/src/app/api/suppliers/[id]/route.ts`**
   - `GET` - Single supplier with purchase orders (including item counts) and stock movements (with product details)
   - `PUT` - Update supplier fields; creates EDITAR_PROVEEDOR audit log
   - `DELETE` - Delete only if no purchase orders exist; creates ELIMINAR_PROVEEDOR audit log

3. **`/src/app/api/purchase-orders/route.ts`**
   - `GET` - List all purchase orders with `?status=xxx&supplierId=yyy` filters; includes supplier name, user name, items count; sorted by createdAt desc
   - `POST` - Create purchase order with body `{ supplierId, items: [{ productId, quantity, unitPrice }], notes? }`; auto-generates OC-XXXXXX number; calculates subtotal, tax (18%), total; creates CREAR_ORDEN_COMPRA audit log

4. **`/src/app/api/purchase-orders/[id]/route.ts`**
   - `GET` - Single purchase order with items (including product details), supplier, and user
   - `PUT` - Action-based update via `{ action: "receive" | "cancel" }`:
     - `receive`: adds received qty to product stock, creates StockMovement (ENTRADA) with supplierId, sets status RECIBIDA, audit log
     - `cancel`: sets status ANULADA, audit log

5. **`/src/app/api/invoices/overdue/route.ts`**
   - `GET` - Returns overdue/VENCIDA invoices plus PENDIENTE invoices older than 30 days, grouped by client
   - Each group includes client details (name, phone, email), their overdue invoices with items (including product names), and totalOverdue amount

## Patterns Used
- `import { db } from '@/lib/db'` for Prisma client
- `import { getUserFromRequest } from '@/lib/auth'` for JWT auth checks
- Next.js 16 params as Promise: `{ params }: { params: Promise<{ id: string }> }` with `const { id } = await params`
- Consistent audit logging for all mutations
- Error responses in Spanish matching existing codebase style
