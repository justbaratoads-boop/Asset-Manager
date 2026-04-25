import { Router } from "express";
import { db } from "@workspace/db";
import { saleInvoicesTable, saleInvoiceItemsTable, purchaseInvoicesTable, purchaseInvoiceItemsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/gst/gstr3b", authMiddleware, async (req, res) => {
  const { month, year } = req.query;
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const toDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const [sales] = await db.select({
    taxable: sql<string>`COALESCE(SUM(total_taxable), 0)`,
    cgst: sql<string>`COALESCE(SUM(total_cgst), 0)`,
    sgst: sql<string>`COALESCE(SUM(total_sgst), 0)`,
    igst: sql<string>`COALESCE(SUM(total_igst), 0)`,
  }).from(saleInvoicesTable)
    .where(and(gte(saleInvoicesTable.date, from), lte(saleInvoicesTable.date, toDate), eq(saleInvoicesTable.isDeleted, "false")));

  const [interstate] = await db.select({
    taxable: sql<string>`COALESCE(SUM(total_taxable), 0)`,
    igst: sql<string>`COALESCE(SUM(total_igst), 0)`,
  }).from(saleInvoicesTable)
    .where(and(gte(saleInvoicesTable.date, from), lte(saleInvoicesTable.date, toDate), eq(saleInvoicesTable.isDeleted, "false"), eq(saleInvoicesTable.isInterstate, true)));

  const [purchases] = await db.select({
    taxable: sql<string>`COALESCE(SUM(total_taxable), 0)`,
    cgst: sql<string>`COALESCE(SUM(total_cgst), 0)`,
    sgst: sql<string>`COALESCE(SUM(total_sgst), 0)`,
    igst: sql<string>`COALESCE(SUM(total_igst), 0)`,
  }).from(purchaseInvoicesTable)
    .where(and(gte(purchaseInvoicesTable.date, from), lte(purchaseInvoicesTable.date, toDate), eq(purchaseInvoicesTable.isDeleted, "false")));

  res.json({
    period: { month: m, year: y },
    outwardSupplies: {
      taxable: Number(sales.taxable),
      cgst: Number(sales.cgst),
      sgst: Number(sales.sgst),
      igst: Number(sales.igst),
      total: Number(sales.cgst) + Number(sales.sgst) + Number(sales.igst),
    },
    inwardSupplies: {
      taxable: Number(purchases.taxable),
      cgst: Number(purchases.cgst),
      sgst: Number(purchases.sgst),
      igst: Number(purchases.igst),
      itcEligible: Number(purchases.cgst) + Number(purchases.sgst) + Number(purchases.igst),
    },
    netTaxLiability: (Number(sales.cgst) + Number(sales.sgst) + Number(sales.igst)) - (Number(purchases.cgst) + Number(purchases.sgst) + Number(purchases.igst)),
  });
});

router.get("/gst/gstr2b", authMiddleware, async (req, res) => {
  const { month, year } = req.query;
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const toDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const invoices = await db.select().from(purchaseInvoicesTable)
    .where(and(gte(purchaseInvoicesTable.date, from), lte(purchaseInvoicesTable.date, toDate), eq(purchaseInvoicesTable.isDeleted, "false")));

  res.json({
    period: { month: m, year: y },
    invoices: invoices.map(i => ({
      supplierName: i.partyName,
      invoiceNumber: i.supplierInvoiceNumber || i.invoiceNumber,
      date: i.date,
      taxableAmount: Number(i.totalTaxable),
      cgst: Number(i.totalCgst),
      sgst: Number(i.totalSgst),
      igst: Number(i.totalIgst),
      isReverseCharge: i.isReverseCharge,
    })),
    totalITC: invoices.reduce((s, i) => s + Number(i.totalCgst) + Number(i.totalSgst) + Number(i.totalIgst), 0),
  });
});

router.get("/gst/hsn-summary", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(saleInvoiceItemsTable.hsnCode, saleInvoiceItemsTable.hsnCode)];

  const rows = await db
    .select({
      hsnCode: saleInvoiceItemsTable.hsnCode,
      quantity: sql<string>`SUM(quantity::numeric)`,
      taxable: sql<string>`SUM(taxable_amount::numeric)`,
      cgst: sql<string>`SUM(cgst::numeric)`,
      sgst: sql<string>`SUM(sgst::numeric)`,
      igst: sql<string>`SUM(igst::numeric)`,
    })
    .from(saleInvoiceItemsTable)
    .groupBy(saleInvoiceItemsTable.hsnCode)
    .orderBy(saleInvoiceItemsTable.hsnCode);

  res.json(rows.map(r => ({
    hsnCode: r.hsnCode || "N/A",
    quantity: Number(r.quantity),
    taxable: Number(r.taxable),
    cgst: Number(r.cgst),
    sgst: Number(r.sgst),
    igst: Number(r.igst),
    totalGst: Number(r.cgst) + Number(r.sgst) + Number(r.igst),
  })));
});

export default router;
