# Task ID: 8 - Clients View & Inventory View Components
**Agent**: frontend-dev
**Date**: 2026-03-04
**Status**: ✅ COMPLETED

## Summary
Created two large 'use client' view components for the POS system frontend.

## Files Created
1. `src/components/clients-view.tsx` - Full client management module (310 lines)
2. `src/components/inventory-view.tsx` - Full inventory management module (590 lines)

## Clients View Features
- Header with search (debounced 400ms) and "Nuevo Cliente" button
- Clients table with 7 columns, responsive hiding on small screens
- Balance column: red if pending > 0, green otherwise
- 3 action buttons: Edit, View Details (navigates to accounts page), Delete
- New/Edit dialog with 5 form fields (controlled inputs)
- Delete confirmation AlertDialog with invoice dependency warning
- Pagination with smart windowing (max 5 visible pages)
- TanStack Query: useQuery + useMutation with cache invalidation

## Inventory View Features
- Header with search, category filter (Select), low stock toggle (Switch), 2 buttons
- Products table with 9 columns, responsive hiding
- Stock column: color-coded (red/amber/green) with status badges
- Status column with Badge using getStatusColor
- 4 action buttons: Edit, Stock Movements, Detail, Delete
- New/Edit Product dialog with 9 fields including category Select and status Select
- Category dialog with name + description
- Stock Movement dialog (ENTRADA/SALIDA with quantity and reason)
- Product Detail dialog with info card + stock movements history table
- Delete confirmation AlertDialog with invoice association warning
- TanStack Query: useQuery for products/categories, useMutation for CRUD

## Lint Result
Clean: 0 errors, 0 warnings
