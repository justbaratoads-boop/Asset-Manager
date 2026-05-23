import { Router } from "express";
import { db } from "@workspace/db";
import {
  journalEntriesTable, journalLinesTable, paymentsTable, receiptsTable,
  creditNotesTable, creditNoteItemsTable, debitNotesTable, debitNoteItemsTable,
  ledgersTable, saleInvoicesTable, saleInvoicePaymentsTable,
  purchaseInvoicesTable, purchaseInvoicePaymentsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeVoucherNumber } from "../lib/counter";
import { adjustStock } from "../lib/batch-stock";

const router = Router();

// --- JOURNAL ENTRIES ---
router.get("/journals", authMiddleware, async (req, res) => {
  const { from, to, voucherType } = req.query;
  const conditions: any[] = [eq(journalEntriesTable.isDeleted, "false")];
  if (from) conditions.push(gte(journalEntriesTable.date, from as string));
  if (to) conditions.push(lte(journalEntriesTable.date, to as string));
  if (voucherType) conditions.push(eq(journalEntriesTable.voucherType, voucherType as string));

  const entries = await db.select().from(journalEntriesTable)
    .where(and(...conditions))
    .orderBy(sql`date DESC, created_at DESC`);

  res.json(entries.map(e => ({ ...e, totalDebit: Number(e.totalDebit), totalCredit: Number(e.totalCredit) })));
});

router.post("/journals", authMiddleware, async (req, res) => {
  const data = req.body;
  const prefix = data.voucherType === "contra" ? "CV" : "JV";
  const voucherNumber = await makeVoucherNumber(prefix);

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
        partyId: line.partyId || null,
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
  const lines = await db.select({
    id: journalLinesTable.id,
    entryId: journalLinesTable.entryId,
    ledgerId: journalLinesTable.ledgerId,
    ledgerName: ledgersTable.name,
    partyId: journalLinesTable.partyId,
    type: journalLinesTable.type,
    amount: journalLinesTable.amount,
  }).from(journalLinesTable)
    .leftJoin(ledgersTable, eq(journalLinesTable.ledgerId, ledgersTable.id))
    .where(eq(journalLinesTable.entryId, Number(req.params.id)));
  res.json({ ...entry, totalDebit: Number(entry.totalDebit), totalCredit: Number(entry.totalCredit), lines });
});

router.put("/journals/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const data = req.body;

  await db.update(journalEntriesTable).set({
    date: data.date,
    narration: data.narration,
    totalDebit: String(data.totalDebit || 0),
    totalCredit: String(data.totalCredit || 0),
  }).where(eq(journalEntriesTable.id, id));

  await db.delete(journalLinesTable).where(eq(journalLinesTable.entryId, id));

  if (data.lines?.length) {
    for (const line of data.lines) {
      await db.insert(journalLinesTable).values({
        entryId: id,
        ledgerId: line.ledgerId,
        partyId: line.partyId || null,
        type: line.type,
        amount: String(line.amount),
      });
    }
  }

  const [updated] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id)).limit(1);
  const lines = await db.select().from(journalLinesTable).where(eq(journalLinesTable.entryId, id));
  res.json({ ...updated, totalDebit: Number(updated.totalDebit), totalCredit: Number(updated.totalCredit), lines });
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
    ledgerId: data.ledgerId || 1,
    paymentMode: data.paymentMode || "cash",
    amount: String(data.amount),
    narration: data.narration,
    reference: data.reference,
  }).returning();

  // Bill-wise: apply each entry as a payment against the respective purchase invoice
  if (data.billWiseEntries?.length) {
    for (const entry of data.billWiseEntries) {
      const amt = Number(entry.amount);
      if (!amt || amt <= 0) continue;
      const [inv] = await db.select().from(purchaseInvoicesTable)
        .where(eq(purchaseInvoicesTable.id, Number(entry.invoiceId))).limit(1);
      if (!inv) continue;
      const newPaid = Math.min(Number(inv.amountPaid) + amt, Number(inv.grandTotal));
      const newBalance = Number(inv.grandTotal) - newPaid;
      const newStatus = newPaid >= Number(inv.grandTotal) ? "paid" : newPaid > 0 ? "partial" : "confirmed";
      await db.insert(purchaseInvoicePaymentsTable).values({
        invoiceId: Number(entry.invoiceId),
        mode: "payment_voucher",
        amount: String(amt),
        reference: voucherNumber,
      });
      await db.update(purchaseInvoicesTable).set({
        amountPaid: String(newPaid),
        balanceDue: String(newBalance),
        status: newStatus,
      }).where(eq(purchaseInvoicesTable.id, Number(entry.invoiceId)));
    }
  }

  res.status(201).json({ ...payment, amount: Number(payment.amount) });
});

router.get("/payments/:id", authMiddleware, async (req, res) => {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, Number(req.params.id))).limit(1);
  if (!payment) return res.status(404).json({ error: "Not found" });
  res.json({ ...payment, amount: Number(payment.amount) });
});

router.put("/payments/:id", authMiddleware, async (req, res) => {
  const data = req.body;
  const [payment] = await db.update(paymentsTable).set({
    date: data.date,
    partyId: data.partyId ?? null,
    partyName: data.partyName ?? null,
    ledgerId: data.ledgerId,
    paymentMode: data.paymentMode,
    amount: String(data.amount),
    narration: data.narration,
    reference: data.reference,
  }).where(eq(paymentsTable.id, Number(req.params.id))).returning();
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
    ledgerId: data.ledgerId || 1,
    paymentMode: data.paymentMode || "cash",
    amount: String(data.amount),
    narration: data.narration,
    reference: data.reference,
  }).returning();

  // Bill-wise: apply each entry as a payment against the respective sale invoice
  if (data.billWiseEntries?.length) {
    for (const entry of data.billWiseEntries) {
      const amt = Number(entry.amount);
      if (!amt || amt <= 0) continue;
      const [inv] = await db.select().from(saleInvoicesTable)
        .where(eq(saleInvoicesTable.id, Number(entry.invoiceId))).limit(1);
      if (!inv) continue;
      const newPaid = Math.min(Number(inv.amountPaid) + amt, Number(inv.grandTotal));
      const newBalance = Number(inv.grandTotal) - newPaid;
      const newStatus = newPaid >= Number(inv.grandTotal) ? "paid" : newPaid > 0 ? "partial" : "confirmed";
      await db.insert(saleInvoicePaymentsTable).values({
        invoiceId: Number(entry.invoiceId),
        mode: "receipt_voucher",
        amount: String(amt),
        reference: voucherNumber,
      });
      await db.update(saleInvoicesTable).set({
        amountPaid: String(newPaid),
        balanceDue: String(newBalance),
        status: newStatus,
      }).where(eq(saleInvoicesTable.id, Number(entry.invoiceId)));
    }
  }

  res.status(201).json({ ...receipt, amount: Number(receipt.amount) });
});

router.get("/receipts/:id", authMiddleware, async (req, res) => {
  const [receipt] = await db.select().from(receiptsTable).where(eq(receiptsTable.id, Number(req.params.id))).limit(1);
  if (!receipt) return res.status(404).json({ error: "Not found" });
  res.json({ ...receipt, amount: Number(receipt.amount) });
});

router.put("/receipts/:id", authMiddleware, async (req, res) => {
  const data = req.body;
  const [receipt] = await db.update(receiptsTable).set({
    date: data.date,
    partyId: data.partyId ?? null,
    partyName: data.partyName ?? null,
    ledgerId: data.ledgerId,
    paymentMode: data.paymentMode,
    amount: String(data.amount),
    narration: data.narration,
    reference: data.reference,
  }).where(eq(receiptsTable.id, Number(req.params.id))).returning();
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
    otherCharges: data.otherCharges || null,
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

      if (item.stockItemId) {
        await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
      }
    }
  }

  res.status(201).json({ ...note, amount: Number(note.amount) });
});

router.get("/credit-notes/:id", authMiddleware, async (req, res) => {
  const [note] = await db.select().from(creditNotesTable).where(eq(creditNotesTable.id, Number(req.params.id))).limit(1);
  if (!note) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(creditNoteItemsTable).where(eq(creditNoteItemsTable.noteId, Number(req.params.id)));
  res.json({ ...note, amount: Number(note.amount), items });
});

router.put("/credit-notes/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const data = req.body;

  const oldItems = await db.select().from(creditNoteItemsTable).where(eq(creditNoteItemsTable.noteId, id));
  for (const item of oldItems) {
    if (item.stockItemId) {
      await adjustStock(item.stockItemId, (item as any).batchId || null, -Number(item.quantity));
    }
  }

  await db.delete(creditNoteItemsTable).where(eq(creditNoteItemsTable.noteId, id));

  await db.update(creditNotesTable).set({
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    reason: data.reason,
    amount: String(data.amount || 0),
    otherCharges: data.otherCharges || null,
  }).where(eq(creditNotesTable.id, id));

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(creditNoteItemsTable).values({
        noteId: id,
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
      if (item.stockItemId) {
        await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
      }
    }
  }

  const [note] = await db.select().from(creditNotesTable).where(eq(creditNotesTable.id, id)).limit(1);
  const items = await db.select().from(creditNoteItemsTable).where(eq(creditNoteItemsTable.noteId, id));
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
    otherCharges: data.otherCharges || null,
  }).returning();

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(debitNoteItemsTable).values({
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

      if (item.stockItemId) {
        await adjustStock(item.stockItemId, item.batchId || null, -Number(item.quantity));
      }
    }
  }

  res.status(201).json({ ...note, amount: Number(note.amount) });
});

router.get("/debit-notes/:id", authMiddleware, async (req, res) => {
  const [note] = await db.select().from(debitNotesTable).where(eq(debitNotesTable.id, Number(req.params.id))).limit(1);
  if (!note) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(debitNoteItemsTable).where(eq(debitNoteItemsTable.noteId, Number(req.params.id)));
  res.json({ ...note, amount: Number(note.amount), items });
});

router.put("/debit-notes/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const data = req.body;

  const oldItems = await db.select().from(debitNoteItemsTable).where(eq(debitNoteItemsTable.noteId, id));
  for (const item of oldItems) {
    if (item.stockItemId) {
      await adjustStock(item.stockItemId, (item as any).batchId || null, Number(item.quantity));
    }
  }

  await db.delete(debitNoteItemsTable).where(eq(debitNoteItemsTable.noteId, id));

  await db.update(debitNotesTable).set({
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    reason: data.reason,
    amount: String(data.amount || 0),
    otherCharges: data.otherCharges || null,
  }).where(eq(debitNotesTable.id, id));

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(debitNoteItemsTable).values({
        noteId: id,
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
      if (item.stockItemId) {
        await adjustStock(item.stockItemId, item.batchId || null, -Number(item.quantity));
      }
    }
  }

  const [note] = await db.select().from(debitNotesTable).where(eq(debitNotesTable.id, id)).limit(1);
  const items = await db.select().from(debitNoteItemsTable).where(eq(debitNoteItemsTable.noteId, id));
  res.json({ ...note, amount: Number(note.amount), items });
});

router.delete("/debit-notes/:id", authMiddleware, async (req, res) => {
  await db.update(debitNotesTable).set({ isDeleted: "true" }).where(eq(debitNotesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
