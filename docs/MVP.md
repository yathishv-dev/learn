# Agreed MVP

## Product

Vyapaar Voice, MakerSprint PS 06: Local-Language Business Intelligence for small shops.

## Requested behavior

1. Manage inventory and stock alerts.
2. Record sales with automatic stock changes.
3. Record and review business expenses.
4. Show daily and selected-period business summaries.
5. Provide a small, read-only AI chatbot grounded in the signed-in shop’s stored data.
6. Accept English and Kannada voice input to fill an editable business form. Nothing is saved without explicit review and Save.
7. Choose interface language and AI answer/speaking language during registration; allow changes in the app.
8. Use the reference palette: mocha brown, platinum silver and pale lavender.

## Technical decisions

TypeScript frontend and backend; React, Tailwind, Supabase and Vercel. Next.js supplies React routing and the TypeScript backend endpoints within one project. Each owner account owns one shop for the MVP. Shop data is protected with row-level security.

## Out of current scope

GST invoicing, barcode hardware, supplier management, customer credit, payments, staff roles, multiple shops per owner, offline synchronization and automated write actions by the assistant.

## Demo sequence

Register with preferred languages → add a product and its cost/price/stock → record a sale → add an expense → inspect the dashboard → ask about sales, stock and expenses → dictate an English or Kannada entry → review the populated form → save → verify the updated totals and stock.
