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

router.get("/gst/gstr1", authMiddleware, async (req, res) => {
  const { month, year } = req.query;
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const toDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const invoices = await db.select().from(saleInvoicesTable)
    .where(and(gte(saleInvoicesTable.date, from), lte(saleInvoicesTable.date, toDate), eq(saleInvoicesTable.isDeleted, "false")));

  // B2B: Has Party GSTIN. B2C: No GSTIN.
  // B2C Large: Interstate and Taxable > 2,50,000. B2C Small: Otherwise.
  const categorized = invoices.map(i => {
    let type = "B2C Small";
    if (i.partyGstin) {
      type = "B2B";
    } else if (i.isInterstate && Number(i.totalTaxable) > 250000) {
      type = "B2C Large";
    }
    
    return {
      type,
      customerName: i.partyName,
      gstin: i.partyGstin || "",
      invoiceNumber: i.invoiceNumber,
      date: i.date,
      taxableAmount: Number(i.totalTaxable),
      cgst: Number(i.totalCgst),
      sgst: Number(i.totalSgst),
      igst: Number(i.totalIgst),
      total: Number(i.grandTotal),
    };
  });

  res.json({
    period: { month: m, year: y },
    invoices: categorized,
    summary: {
      b2b: categorized.filter(i => i.type === "B2B").reduce((s, i) => s + i.taxableAmount, 0),
      b2cLarge: categorized.filter(i => i.type === "B2C Large").reduce((s, i) => s + i.taxableAmount, 0),
      b2cSmall: categorized.filter(i => i.type === "B2C Small").reduce((s, i) => s + i.taxableAmount, 0),
      totalTaxable: categorized.reduce((s, i) => s + i.taxableAmount, 0),
      totalGst: categorized.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
    }
  });
});

router.get("/gst/hsn-summary", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (from) conditions.push(gte(saleInvoicesTable.date, from as string));
  if (to) conditions.push(lte(saleInvoicesTable.date, to as string));

  const rows = await db
    .select({
      hsnCode: saleInvoiceItemsTable.hsnCode,
      quantity: sql<string>`SUM(${saleInvoiceItemsTable.quantity}::numeric)`,
      taxable: sql<string>`SUM(${saleInvoiceItemsTable.taxableAmount}::numeric)`,
      cgst: sql<string>`SUM(${saleInvoiceItemsTable.cgst}::numeric)`,
      sgst: sql<string>`SUM(${saleInvoiceItemsTable.sgst}::numeric)`,
      igst: sql<string>`SUM(${saleInvoiceItemsTable.igst}::numeric)`,
    })
    .from(saleInvoiceItemsTable)
    .innerJoin(saleInvoicesTable, eq(saleInvoiceItemsTable.invoiceId, saleInvoicesTable.id))
    .where(and(...conditions))
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
