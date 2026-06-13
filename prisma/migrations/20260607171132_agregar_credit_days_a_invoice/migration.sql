-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "dollarRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "paymentMethod" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("clientId", "createdAt", "date", "discount", "dollarRate", "id", "notes", "number", "paymentMethod", "status", "subtotal", "tax", "total", "totalBs", "updatedAt", "userId") SELECT "clientId", "createdAt", "date", "discount", "dollarRate", "id", "notes", "number", "paymentMethod", "status", "subtotal", "tax", "total", "totalBs", "updatedAt", "userId" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
