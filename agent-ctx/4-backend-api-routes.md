# Task ID: 4 - Backend API Routes - Agent Work Summary

## Created Files
1. `src/app/api/clients/route.ts` - GET (list with search) + POST (create)
2. `src/app/api/clients/[id]/route.ts` - GET + PUT + DELETE
3. `src/app/api/products/route.ts` - GET (search/category/lowStock) + POST (create with stock movement)
4. `src/app/api/products/[id]/route.ts` - GET + PUT + DELETE
5. `src/app/api/categories/route.ts` - GET (with product count) + POST
6. `src/app/api/categories/[id]/route.ts` - GET + PUT + DELETE
7. `src/app/api/invoices/route.ts` - GET (filters/pagination) + POST (complex create logic)
8. `src/app/api/invoices/[id]/route.ts` - GET + PUT (status changes with side effects)

## Fixed Issues
- `src/app/api/audit/route.ts` - Renamed `module` variable to `moduleFilter` to fix Next.js lint rule `no-assign-module-variable`
- Client DELETE: Changed from checking only pending invoices to checking all invoices (prevents FK constraint errors)

## Key Implementation Details
- All routes use `getUserFromRequest` for auth (returns 401 if unauthenticated)
- Invoice creation uses `$transaction` for atomicity (creates invoice + items + stock movements + account entries + transactions)
- Invoice ANULADA restores product quantities and creates ENTRADA stock movements
- Invoice PAGADA creates ABONO account entry and reduces client balance
- Invoice numbers auto-generated in FAC-XXXXXX format
- Tax rate: 18% on (subtotal - discount)
- All mutations create AuditLog entries
