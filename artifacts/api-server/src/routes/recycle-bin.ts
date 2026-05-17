import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, purchaseInvoicesTable,
  ordersTable, purchaseOrdersTable,
  paymentsTable, receiptsTable,
  journalEntriesTable, creditNotesTable, debitNotesTable,
  partiesTable, stockItemsTable, ledgersTable,
} from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function purgeBin() {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  await Promise.all([
    db.delete(saleInvoicesTable).where(and(eq(saleInvoicesTable.isDeleted, "true"), lt(saleInvoicesTable.updatedAt, cutoff))),
    db.delete(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, "true"), lt(purchaseInvoicesTable.updatedAt, cutoff))),
    db.delete(ordersTable).where(and(eq(ordersTable.isDeleted, "true"), lt(ordersTable.updatedAt, cutoff))),
    db.delete(purchaseOrdersTable).where(and(eq(purchaseOrdersTable.isDeleted, "true"), lt(purchaseOrdersTable.updatedAt, cutoff))),
    db.delete(paymentsTable).where(and(eq(paymentsTable.isDeleted, "true"), lt(paymentsTable.updatedAt, cutoff))),
    db.delete(receiptsTable).where(and(eq(receiptsTable.isDeleted, "true"), lt(receiptsTable.updatedAt, cutoff))),
    db.delete(journalEntriesTable).where(and(eq(journalEntriesTable.isDeleted, "true"), lt(journalEntriesTable.updatedAt, cutoff))),
    db.delete(creditNotesTable).where(and(eq(creditNotesTable.isDeleted, "true"), lt(creditNotesTable.updatedAt, cutoff))),
    db.delete(debitNotesTable).where(and(eq(debitNotesTable.isDeleted, "true"), lt(debitNotesTable.updatedAt, cutoff))),
    db.delete(partiesTable).where(and(eq(partiesTable.isDeleted, "true"), lt(partiesTable.updatedAt, cutoff))),
    db.delete(stockItemsTable).where(and(eq(stockItemsTable.isDeleted, "true"), lt(stockItemsTable.updatedAt, cutoff))),
    db.delete(ledgersTable).where(and(eq(ledgersTable.isDeleted, "true"), lt(ledgersTable.updatedAt, cutoff))),
  ]);
}

function daysLeft(updatedAt: Date): number {
  const expiresAt = new Date(updatedAt.getTime() + THIRTY_DAYS_MS);
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function expiresAt(updatedAt: Date): string {
  return new Date(updatedAt.getTime() + THIRTY_DAYS_MS).toISOString();
}

router.get("/recycle-bin", authMiddleware, async (_req, res) => {
  await purgeBin();

  const [
    saleInvoices, purchaseInvoices, saleOrders, purchaseOrders,
    payments, receipts, journals, creditNotes, debitNotes,
    parties, stockItems, ledgers,
  ] = await Promise.all([
    db.select().from(saleInvoicesTable).where(eq(saleInvoicesTable.isDeleted, "true")),
    db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.isDeleted, "true")),
    db.select().from(ordersTable).where(eq(ordersTable.isDeleted, "true")),
    db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.isDeleted, "true")),
    db.select().from(paymentsTable).where(eq(paymentsTable.isDeleted, "true")),
    db.select().from(receiptsTable).where(eq(receiptsTable.isDeleted, "true")),
    db.select().from(journalEntriesTable).where(eq(journalEntriesTable.isDeleted, "true")),
    db.select().from(creditNotesTable).where(eq(creditNotesTable.isDeleted, "true")),
    db.select().from(debitNotesTable).where(eq(debitNotesTable.isDeleted, "true")),
    db.select().from(partiesTable).where(eq(partiesTable.isDeleted, "true")),
    db.select().from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "true")),
    db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "true")),
  ]);

  const items = [
    ...saleInvoices.map(r => ({ id: r.id, type: "sale_invoice", title: r.invoiceNumber, subtitle: r.partyName, amount: Number(r.grandTotal), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...purchaseInvoices.map(r => ({ id: r.id, type: "purchase_invoice", title: r.invoiceNumber, subtitle: r.partyName, amount: Number(r.grandTotal), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...saleOrders.map(r => ({ id: r.id, type: "sale_order", title: r.orderNumber, subtitle: r.partyName, amount: Number(r.grandTotal), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...purchaseOrders.map(r => ({ id: r.id, type: "purchase_order", title: r.poNumber, subtitle: r.partyName, amount: Number(r.grandTotal), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...payments.map(r => ({ id: r.id, type: "payment", title: r.voucherNumber, subtitle: r.partyName ?? null, amount: Number(r.amount), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...receipts.map(r => ({ id: r.id, type: "receipt", title: r.voucherNumber, subtitle: r.partyName ?? null, amount: Number(r.amount), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...journals.map(r => ({ id: r.id, type: "journal", title: r.voucherNumber, subtitle: r.narration ?? null, amount: Number(r.totalDebit), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...creditNotes.map(r => ({ id: r.id, type: "credit_note", title: r.voucherNumber, subtitle: r.partyName, amount: Number(r.grandTotal), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...debitNotes.map(r => ({ id: r.id, type: "debit_note", title: r.voucherNumber, subtitle: r.partyName, amount: Number(r.grandTotal), date: r.date, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...parties.map(r => ({ id: r.id, type: "party", title: r.name, subtitle: r.type, amount: null, date: null, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...stockItems.map(r => ({ id: r.id, type: "stock_item", title: r.name, subtitle: r.unit, amount: null, date: null, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
    ...ledgers.map(r => ({ id: r.id, type: "ledger", title: r.name, subtitle: r.group, amount: null, date: null, deletedAt: r.updatedAt.toISOString(), expiresAt: expiresAt(r.updatedAt), daysLeft: daysLeft(r.updatedAt) })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  res.json({ items });
});

router.post("/recycle-bin/restore", authMiddleware, async (req, res) => {
  const { type, id } = req.body;
  if (!type || !id) return res.status(400).json({ error: "type and id required" });

  const n = Number(id);
  switch (type) {
    case "sale_invoice":     await db.update(saleInvoicesTable).set({ isDeleted: "false" }).where(eq(saleInvoicesTable.id, n)); break;
    case "purchase_invoice": await db.update(purchaseInvoicesTable).set({ isDeleted: "false" }).where(eq(purchaseInvoicesTable.id, n)); break;
    case "sale_order":       await db.update(ordersTable).set({ isDeleted: "false" }).where(eq(ordersTable.id, n)); break;
    case "purchase_order":   await db.update(purchaseOrdersTable).set({ isDeleted: "false" }).where(eq(purchaseOrdersTable.id, n)); break;
    case "payment":          await db.update(paymentsTable).set({ isDeleted: "false" }).where(eq(paymentsTable.id, n)); break;
    case "receipt":          await db.update(receiptsTable).set({ isDeleted: "false" }).where(eq(receiptsTable.id, n)); break;
    case "journal":          await db.update(journalEntriesTable).set({ isDeleted: "false" }).where(eq(journalEntriesTable.id, n)); break;
    case "credit_note":      await db.update(creditNotesTable).set({ isDeleted: "false" }).where(eq(creditNotesTable.id, n)); break;
    case "debit_note":       await db.update(debitNotesTable).set({ isDeleted: "false" }).where(eq(debitNotesTable.id, n)); break;
    case "party":            await db.update(partiesTable).set({ isDeleted: "false" }).where(eq(partiesTable.id, n)); break;
    case "stock_item":       await db.update(stockItemsTable).set({ isDeleted: "false" }).where(eq(stockItemsTable.id, n)); break;
    case "ledger":           await db.update(ledgersTable).set({ isDeleted: "false" }).where(eq(ledgersTable.id, n)); break;
    default: return res.status(400).json({ error: "Unknown type" });
  }
  res.json({ ok: true });
});

export default router;
