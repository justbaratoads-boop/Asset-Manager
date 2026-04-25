import { Router } from "express";
import { db } from "@workspace/db";
import {
  journalEntriesTable, journalLinesTable, paymentsTable, receiptsTable,
  creditNotesTable, creditNoteItemsTable, debitNotesTable, debitNoteItemsTable,
  ledgersTable
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeVoucherNumber } from "../lib/counter";

const router = Router();

// --- JOURNAL ENTRIES ---
router.get("/journals", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(journalEntriesTable.isDeleted, "false")];
  if (from) conditions.push(gte(journalEntriesTable.date, from as string));
  if (to) conditions.push(lte(journalEntriesTable.date, to as string));

  const entries = await db.select().from(journalEntriesTable)
    .where(and(...conditions))
    .orderBy(sql`date DESC, created_at DESC`);

  res.json(entries.map(e => ({ ...e, totalDebit: Number(e.totalDebit), totalCredit: Number(e.totalCredit) })));
});

router.post("/journals", authMiddleware, async (req, res) => {
  const data = req.body;
  const voucherNumber = await makeVoucherNumber("JV");

  const [entry] = await db.insert(journalEntriesTable).values({
    date: data.date,
    voucherNumber,
    voucherType: data.voucherType || "journal",
    narration: data.narration,
    totalDebit: String(data.totalDebit || 0),
    totalCredit: String(data.totalCredit || 0),
  }).returning();

  if (data.lines?.length) {
    for (const line of data.lines) {
      await db.insert(journalLinesTable).values({
        entryId: entry.id,
        ledgerId: line.ledgerId,
        type: line.type,
        amount: String(line.amount),
      });
    }
  }

  res.status(201).json(entry);
});

router.get("/journals/:id", authMiddleware, async (req, res) => {
  const [entry] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, Number(req.params.id))).limit(1);
  if (!entry) return res.status(404).json({ error: "Not found" });
  const lines = await db.select().from(journalLinesTable).where(eq(journalLinesTable.entryId, Number(req.params.id)));
  res.json({ ...entry, totalDebit: Number(entry.totalDebit), totalCredit: Number(entry.totalCredit), lines });
});

router.delete("/journals/:id", authMiddleware, async (req, res) => {
  await db.update(journalEntriesTable).set({ isDeleted: "true" }).where(eq(journalEntriesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// --- PAYMENTS ---
router.get("/payments", authMiddleware, async (req, res) => {
  const payments = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.isDeleted, "false"))
    .orderBy(sql`date DESC, created_at DESC`);
  res.json(payments.map(p => ({ ...p, amount: Number(p.amount) })));
});

router.post("/payments", authMiddleware, async (req, res) => {
  const data = req.body;
  const voucherNumber = await makeVoucherNumber("PMT");

  const [payment] = await db.insert(paymentsTable).values({
    voucherNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    ledgerId: data.ledgerId,
    paymentMode: data.paymentMode || "cash",
    amount: String(data.amount),
    narration: data.narration,
    reference: data.reference,
  }).returning();

  res.status(201).json({ ...payment, amount: Number(payment.amount) });
});

router.get("/payments/:id", authMiddleware, async (req, res) => {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, Number(req.params.id))).limit(1);
  if (!payment) return res.status(404).json({ error: "Not found" });
  res.json({ ...payment, amount: Number(payment.amount) });
});

router.delete("/payments/:id", authMiddleware, async (req, res) => {
  await db.update(paymentsTable).set({ isDeleted: "true" }).where(eq(paymentsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// --- RECEIPTS ---
router.get("/receipts", authMiddleware, async (req, res) => {
  const receipts = await db.select().from(receiptsTable)
    .where(eq(receiptsTable.isDeleted, "false"))
    .orderBy(sql`date DESC, created_at DESC`);
  res.json(receipts.map(r => ({ ...r, amount: Number(r.amount) })));
});

router.post("/receipts", authMiddleware, async (req, res) => {
  const data = req.body;
  const voucherNumber = await makeVoucherNumber("RCT");

  const [receipt] = await db.insert(receiptsTable).values({
    voucherNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    ledgerId: data.ledgerId,
    paymentMode: data.paymentMode || "cash",
    amount: String(data.amount),
    narration: data.narration,
    reference: data.reference,
  }).returning();

  res.status(201).json({ ...receipt, amount: Number(receipt.amount) });
});

router.get("/receipts/:id", authMiddleware, async (req, res) => {
  const [receipt] = await db.select().from(receiptsTable).where(eq(receiptsTable.id, Number(req.params.id))).limit(1);
  if (!receipt) return res.status(404).json({ error: "Not found" });
  res.json({ ...receipt, amount: Number(receipt.amount) });
});

router.delete("/receipts/:id", authMiddleware, async (req, res) => {
  await db.update(receiptsTable).set({ isDeleted: "true" }).where(eq(receiptsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// --- CREDIT NOTES ---
router.get("/credit-notes", authMiddleware, async (req, res) => {
  const notes = await db.select().from(creditNotesTable).where(eq(creditNotesTable.isDeleted, "false")).orderBy(sql`created_at DESC`);
  res.json(notes.map(n => ({ ...n, amount: Number(n.amount) })));
});

router.post("/credit-notes", authMiddleware, async (req, res) => {
  const data = req.body;
  const noteNumber = await makeVoucherNumber("CN");
  const [note] = await db.insert(creditNotesTable).values({
    noteNumber,
    date: data.date,
    saleInvoiceId: data.saleInvoiceId,
    partyId: data.partyId,
    partyName: data.partyName,
    reason: data.reason,
    amount: String(data.amount || 0),
  }).returning();

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(creditNoteItemsTable).values({
        noteId: note.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(item.quantity),
        unit: item.unit,
        rate: String(item.rate),
        discountPct: String(item.discountPct || 0),
        gstPct: String(item.gstPct || 0),
        taxableAmount: String(item.taxableAmount),
        cgst: String(item.cgst || 0),
        sgst: String(item.sgst || 0),
        igst: String(item.igst || 0),
        total: String(item.total),
      });
    }
  }
  res.status(201).json(note);
});

router.get("/credit-notes/:id", authMiddleware, async (req, res) => {
  const [note] = await db.select().from(creditNotesTable).where(eq(creditNotesTable.id, Number(req.params.id))).limit(1);
  if (!note) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(creditNoteItemsTable).where(eq(creditNoteItemsTable.noteId, Number(req.params.id)));
  res.json({ ...note, amount: Number(note.amount), items });
});

router.delete("/credit-notes/:id", authMiddleware, async (req, res) => {
  await db.update(creditNotesTable).set({ isDeleted: "true" }).where(eq(creditNotesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// --- DEBIT NOTES ---
router.get("/debit-notes", authMiddleware, async (req, res) => {
  const notes = await db.select().from(debitNotesTable).where(eq(debitNotesTable.isDeleted, "false")).orderBy(sql`created_at DESC`);
  res.json(notes.map(n => ({ ...n, amount: Number(n.amount) })));
});

router.post("/debit-notes", authMiddleware, async (req, res) => {
  const data = req.body;
  const noteNumber = await makeVoucherNumber("DN");
  const [note] = await db.insert(debitNotesTable).values({
    noteNumber,
    date: data.date,
    purchaseInvoiceId: data.purchaseInvoiceId,
    partyId: data.partyId,
    partyName: data.partyName,
    reason: data.reason,
    amount: String(data.amount || 0),
  }).returning();
  res.status(201).json(note);
});

router.get("/debit-notes/:id", authMiddleware, async (req, res) => {
  const [note] = await db.select().from(debitNotesTable).where(eq(debitNotesTable.id, Number(req.params.id))).limit(1);
  if (!note) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(debitNoteItemsTable).where(eq(debitNoteItemsTable.noteId, Number(req.params.id)));
  res.json({ ...note, amount: Number(note.amount), items });
});

router.delete("/debit-notes/:id", authMiddleware, async (req, res) => {
  await db.update(debitNotesTable).set({ isDeleted: "true" }).where(eq(debitNotesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
