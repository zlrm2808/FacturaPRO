---
Task ID: 4
Agent: Main Agent
Task: Implement per-client price lists

Work Log:
- Read worklog.md to understand previous agents' work (Task 1-3: Turbopack fix, session validation, session bug fix)
- Read prisma/schema.prisma - confirmed ClientPrice model exists with clientId, productId, customPrice, unique constraint on clientId+productId
- Read existing clients-view.tsx and pos-view.tsx to understand current structure
- Read existing API routes pattern (clients/route.ts, clients/[id]/route.ts) for consistency

- Created /src/app/api/client-prices/route.ts:
  - GET: Accepts clientId query param, returns all custom prices including product info (name, code, salePrice, unitOfMeasure)
  - POST: Creates or updates a custom price using upsert (leveraging unique constraint on clientId+productId)
  - Validates clientId, productId, customPrice are present and customPrice is a positive number
  - Verifies client and product exist before upsert
  - Includes audit log entries for both operations

- Created /src/app/api/client-prices/[id]/route.ts:
  - DELETE: Removes a custom price by id
  - Verifies the record exists before deleting
  - Includes audit log entry

- Updated /src/components/clients-view.tsx:
  - Added new state: priceListDialogOpen, priceListClientId, priceListClientName, productSearchForPrice, newCustomPrice, newCustomProductId
  - Added "Lista de Precios" button (Tags icon, amber colored) next to Edit/View/Delete buttons for each client
  - Added Price List Dialog with:
    - Client name at top
    - Existing custom prices list (product name, normal price, custom price, delete button, ↑/↓ indicator)
    - Add Product section with product search, product selection, custom price input, add button
    - Already-added products shown with ★ badge and disabled for re-adding
  - Added useQuery for client-prices and products (for adding)
  - Added useMutation for add/delete price operations
  - Toast notifications for success/error

- Updated /src/components/pos-view.tsx:
  - Added useQuery to fetch client prices when a client is selected (enabled: !!selectedClientId)
  - Modified addToCart to check for custom price: uses clientPrice.customPrice instead of product.salePrice when available
  - Updated dependency array of addToCart to include clientPrices
  - Products with custom prices for the selected client show:
    - ★ badge (amber colored) on the product card
    - Amber border on the product card
    - Effective price (custom) displayed in bold
    - Original price shown with strikethrough
    - Bolivares conversion based on effective price

- Ran bun run lint: passed with no errors
- Removed unused Star import from clients-view.tsx

Stage Summary:
- Per-client price lists fully implemented with API endpoints and UI
- Client-price API: GET (by clientId), POST (upsert), DELETE (by id)
- Clients view: Price List dialog with search, add, delete functionality
- POS view: Custom prices automatically applied when client is selected, visual indicators for custom-priced products
- All code passes lint checks
