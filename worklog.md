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

---
Task ID: 2
Agent: Main Agent
Task: Implement session validation - close session on server restart and at midnight

Work Log:
- Analyzed current auth system: custom JWT + localStorage + Zustand (no NextAuth usage)
- Modified /src/lib/auth.ts:
  - Added SERVER_INSTANCE_ID (randomUUID) generated on module load
  - Added `sid` (server instance ID) to TokenPayload - invalidates all tokens when server restarts
  - Added `loginDate` (YYYY-MM-DD) to TokenPayload - invalidates tokens at midnight
  - Updated signToken() to automatically include sid and loginDate
  - Updated verifyToken() to check both sid matches current server instance AND loginDate is today
- Modified /src/lib/store.ts:
  - Added `loginDate` to AuthState, stored in localStorage alongside token/user
  - Updated login() to save loginDate to localStorage
  - Updated logout() to clear loginDate from localStorage
  - Updated hydrate() to check if loginDate differs from today (midnight expiry on client side)
  - Added checkMidnight() function to detect date change and auto-logout
- Modified /src/lib/api.ts:
  - Added handleUnauthorized() method that auto-logouts on 401 responses
  - All API methods (get, post, put, del) now trigger auto-logout on 401
- Created /src/app/api/auth/logout/route.ts:
  - POST endpoint that creates LOGOUT audit log entry
  - Returns success even if audit log fails (client-side logout still works)
- Modified /src/components/app-sidebar.tsx:
  - Added async handleLogout() that calls /api/auth/logout then client logout
  - Logout button now uses handleLogout instead of direct logout call
- Modified /src/app/page.tsx:
  - Added server-side token validation on hydration via /api/auth/me
  - Added midnight check timer (every 60 seconds)
  - Added visibility change listener to check midnight when tab regains focus
  - Both checks auto-logout user if session has expired
- Verified with Agent Browser: login works, JWT contains sid+loginDate, logout works with audit trail

Stage Summary:
- Server restart detection: SERVER_INSTANCE_ID in JWT changes on restart, invalidating all tokens
- Midnight detection: loginDate in JWT checked server-side AND client-side, auto-logout at midnight
- Auto-logout on 401: API client automatically logs out when any API returns 401
- Logout audit trail: /api/auth/logout endpoint creates LOGOUT audit log entries
- Client-side midnight timer: checks every 60 seconds + on tab focus
