# Task 2: Fix POS Cart visibility and move dollar history to header

## Work Log

### Changes Made:

1. **Updated `/src/lib/store.ts`**:
   - Added `posHistoryOpen: boolean` to `AppState` interface (default: `false`)
   - Added `setPosHistoryOpen: (v: boolean) => void` setter to `AppState` interface
   - Added both to the `useAppStore` Zustand store implementation

2. **Updated `/src/components/pos-view.tsx`**:
   - Removed the dollar rate indicator from the POS header (already shown in top bar)
   - Removed the "Historial" button from the POS header (moved to top bar)
   - Replaced internal `showHistory` state with `posHistoryOpen` / `setPosHistoryOpen` from the Zustand store
   - Removed `DollarSign` import from lucide-react (no longer needed)
   - Added `useAppStore` import
   - Made cart section more compact and always visible:
     - Cart header: reduced padding (`pb-2 px-3 pt-3`), smaller title text (`text-sm`)
     - Cart content: reduced padding (`px-3 pb-3`)
     - Client section: tighter margins, smaller labels
     - Cart items ScrollArea: changed from `flex-1` to `max-h-[30vh]` so summary/buttons are always visible
     - Summary section: `shrink-0` class, tighter spacing (`space-y-1.5`), responsive text (`text-xs sm:text-sm`)
     - Payment method section: `shrink-0` class, smaller label
     - Action buttons: `shrink-0` class, tighter spacing, slightly smaller button height
   - Simplified POS header to just title/subtitle (no action buttons)

3. **Updated `/src/app/page.tsx`**:
   - Added `History` import from lucide-react
   - Added `posHistoryOpen` and `setPosHistoryOpen` from `useAppStore` in the Header component
   - Added a History toggle button in the header between the dollar rate indicator and the notifications button
   - Button uses `variant="default"` when `posHistoryOpen` is true, `variant="ghost"` when false
   - Button toggles `posHistoryOpen` state in the store

### Verification:
- ESLint passes with no errors
- Dev server compiles successfully (all API routes return 200)
- All changes are consistent across store, POS view, and header

## Stage Summary
- Dollar rate indicator removed from POS view (already in top bar)
- History button moved from POS view header to the global top bar header
- Cart section made compact with `max-h-[30vh]` scroll area and `shrink-0` on summary/buttons
- History state managed via Zustand store (`posHistoryOpen` / `setPosHistoryOpen`) for cross-component access
