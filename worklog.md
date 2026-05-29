---
Task ID: 1
Agent: Main
Task: Fix dashboard internal server error

Work Log:
- Diagnosed the error: `db.dollarRate` was undefined because Prisma client wasn't regenerated after adding the DollarRate model
- Ran `bun run db:push` to regenerate the Prisma client and sync the database
- Verified the dashboard API returns 200 with valid data (salesToday, totalClients, dollarRate, etc.)
- Fixed the WhatsApp phone format in overdue-view.tsx to use Venezuelan country code (+58) instead of Dominican Republic
- Confirmed all API routes properly use getEffectiveDollarRate for USD/VES conversion
- All views (dashboard, POS, clients, accounts, overdue, suppliers, reports) already display amounts in both USD and Bolívares

Stage Summary:
- Dashboard error fixed by regenerating Prisma client
- DollarRate model already existed in schema with proper fields (date, officialRate, parallelRate, source)
- Exchange rate API integration already complete: ve.dolarapi.com → fetchAndSaveDollarRate() → DollarRate table
- Fallback logic already implemented: if no rate for date, uses last available official rate
- All transaction views display dual currency (USD + Bs)
- WhatsApp phone format updated for Venezuela (+58)
