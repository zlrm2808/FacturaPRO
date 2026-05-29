# Task 2b - Overdue Invoices View & Suppliers View

## Summary
Created two large frontend view components and their supporting API routes for the POS system.

## Files Created

### Frontend Components
- `/src/components/overdue-view.tsx` - Overdue invoices management with WhatsApp integration
- `/src/components/suppliers-view.tsx` - Supplier management and purchase order module

### API Routes
- `/src/app/api/invoices/overdue/route.ts` - GET overdue invoices grouped by client
- `/src/app/api/suppliers/route.ts` - GET (search) + POST
- `/src/app/api/suppliers/[id]/route.ts` - GET + PUT + DELETE
- `/src/app/api/purchase-orders/route.ts` - GET (filter) + POST
- `/src/app/api/purchase-orders/[id]/route.ts` - GET + PUT (receive/cancel)

### Modified Files
- `/src/lib/store.ts` - Added 'overdue' and 'suppliers' page types
- `/src/components/app-sidebar.tsx` - Added nav items for new views
- `/src/app/page.tsx` - Integrated new views into SPA routing

## Key Features
- WhatsApp integration with Dominican Republic phone formatting (809/829/849 area codes)
- Collapsible client cards with invoice details table
- Mark as VENCIDA button, register payment (ABONO) dialog
- Supplier CRUD with purchase order management
- PO receive adds stock with success toast showing stock updates
- All components use shadcn/ui, TanStack Query, sonner toasts

## Lint Status
✅ Zero errors
