import { Router } from "express";
import { db } from "@workspace/db";
import {
  companySettingsTable,
  accountGroupsTable,
  ledgersTable,
  partiesTable,
  stockCategoriesTable,
  stockItemsTable,
  stockBatchesTable,
  stockTransactionsTable,
  saleInvoicesTable,
  saleInvoiceItemsTable,
  saleInvoicePaymentsTable,
  purchaseInvoicesTable,
  purchaseInvoiceItemsTable,
  purchaseInvoicePaymentsTable,
  receiptsTable,
  paymentsTable,
  journalEntriesTable,
  journalLinesTable,
  creditNotesTable,
  creditNoteItemsTable,
  debitNotesTable,
  debitNoteItemsTable,
  ordersTable,
  orderItemsTable,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  driversTable,
  vehiclesTable,
  deliveriesTable,
  deliveryInvoicesTable,
  countersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

// ==========================================
// 1. EXPORT BACKUP
// ==========================================
router.get("/backup/export", authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const isFiltered = !!(from || to);

    // 1. Query Masters sequentially to avoid node-postgres client contention
    const companySettings = await db.select().from(companySettingsTable);
    const accountGroups = await db.select().from(accountGroupsTable).where(eq(accountGroupsTable.isDeleted, "false"));
    const ledgers = await db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.isDeleted, "false"));
    const stockCategories = await db.select().from(stockCategoriesTable);
    const stockItems = await db.select().from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false"));
    const stockBatches = await db.select().from(stockBatchesTable);
    const drivers = await db.select().from(driversTable);
    const vehicles = await db.select().from(vehiclesTable);
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      permissions: usersTable.permissions,
      isActive: usersTable.isActive,
    }).from(usersTable);
    const counters = await db.select().from(countersTable);

    // Helper for date filtering
    const buildDateCond = (dateCol: any) => {
      const conds: any[] = [];
      if (from) conds.push(gte(dateCol, from));
      if (to) conds.push(lte(dateCol, to));
      return conds.length > 0 ? and(...conds) : undefined;
    };

    // 2. Query Vouchers
    const saleCond = buildDateCond(saleInvoicesTable.date);
    const saleInvoices = await db.select().from(saleInvoicesTable).where(saleCond);
    const saleInvoiceIds = saleInvoices.map((s: any) => s.id);

    let saleInvoiceItems: any[] = [];
    let saleInvoicePayments: any[] = [];
    if (saleInvoiceIds.length > 0) {
      saleInvoiceItems = await db.select().from(saleInvoiceItemsTable).where(inArray(saleInvoiceItemsTable.invoiceId, saleInvoiceIds));
      saleInvoicePayments = await db.select().from(saleInvoicePaymentsTable).where(inArray(saleInvoicePaymentsTable.invoiceId, saleInvoiceIds));
    }

    const purchCond = buildDateCond(purchaseInvoicesTable.date);
    const purchaseInvoices = await db.select().from(purchaseInvoicesTable).where(purchCond);
    const purchaseInvoiceIds = purchaseInvoices.map((p: any) => p.id);

    let purchaseInvoiceItems: any[] = [];
    let purchaseInvoicePayments: any[] = [];
    if (purchaseInvoiceIds.length > 0) {
      purchaseInvoiceItems = await db.select().from(purchaseInvoiceItemsTable).where(inArray(purchaseInvoiceItemsTable.invoiceId, purchaseInvoiceIds));
      purchaseInvoicePayments = await db.select().from(purchaseInvoicePaymentsTable).where(inArray(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoiceIds));
    }

    const receipts = await db.select().from(receiptsTable).where(buildDateCond(receiptsTable.date));
    const payments = await db.select().from(paymentsTable).where(buildDateCond(paymentsTable.date));
    const journalEntries = await db.select().from(journalEntriesTable).where(buildDateCond(journalEntriesTable.date));
    const creditNotes = await db.select().from(creditNotesTable).where(buildDateCond(creditNotesTable.date));
    const debitNotes = await db.select().from(debitNotesTable).where(buildDateCond(debitNotesTable.date));
    const orders = await db.select().from(ordersTable).where(buildDateCond(ordersTable.date));
    const purchaseOrders = await db.select().from(purchaseOrdersTable).where(buildDateCond(purchaseOrdersTable.date));
    
    const deliveries = await db.select().from(deliveriesTable).where(
      from && to ? sql`${deliveriesTable.date} >= ${from}::date AND ${deliveriesTable.date} <= ${to}::date` :
      from ? sql`${deliveriesTable.date} >= ${from}::date` :
      to ? sql`${deliveriesTable.date} <= ${to}::date` : undefined
    );

    // Query voucher children
    const journalIds = journalEntries.map((j: any) => j.id);
    const journalLines = journalIds.length > 0
      ? await db.select().from(journalLinesTable).where(inArray(journalLinesTable.entryId, journalIds))
      : [];

    const creditNoteIds = creditNotes.map((c: any) => c.id);
    const creditNoteItems = creditNoteIds.length > 0
      ? await db.select().from(creditNoteItemsTable).where(inArray(creditNoteItemsTable.noteId, creditNoteIds))
      : [];

    const debitNoteIds = debitNotes.map((d: any) => d.id);
    const debitNoteItems = debitNoteIds.length > 0
      ? await db.select().from(debitNoteItemsTable).where(inArray(debitNoteItemsTable.noteId, debitNoteIds))
      : [];

    const orderIds = orders.map((o: any) => o.id);
    const orderItems = orderIds.length > 0
      ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
      : [];

    const purchaseOrderIds = purchaseOrders.map((p: any) => p.id);
    const purchaseOrderItems = purchaseOrderIds.length > 0
      ? await db.select().from(purchaseOrderItemsTable).where(inArray(purchaseOrderItemsTable.orderId, purchaseOrderIds))
      : [];

    const deliveryIds = deliveries.map((d: any) => d.id);
    const deliveryInvoices = deliveryIds.length > 0
      ? await db.select().from(deliveryInvoicesTable).where(inArray(deliveryInvoicesTable.deliveryId, deliveryIds))
      : [];

    // Stock transactions
    const stockTxCond = from && to
      ? sql`${stockTransactionsTable.createdAt}::date >= ${from}::date AND ${stockTransactionsTable.createdAt}::date <= ${to}::date`
      : from
      ? sql`${stockTransactionsTable.createdAt}::date >= ${from}::date`
      : to
      ? sql`${stockTransactionsTable.createdAt}::date <= ${to}::date`
      : undefined;

    const stockTransactions = await db.select().from(stockTransactionsTable).where(stockTxCond);

    const company: any = companySettings[0] || {};
    const companyName = company.companyName || "Company";
    const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    const counts = {
      parties: parties.length,
      ledgers: ledgers.length,
      stockItems: stockItems.length,
      stockCategories: stockCategories.length,
      stockBatches: stockBatches.length,
      saleInvoices: saleInvoices.length,
      purchaseInvoices: purchaseInvoices.length,
      receipts: receipts.length,
      payments: payments.length,
      journalEntries: journalEntries.length,
      creditNotes: creditNotes.length,
      debitNotes: debitNotes.length,
      orders: orders.length,
      purchaseOrders: purchaseOrders.length,
      deliveries: deliveries.length,
      stockTransactions: stockTransactions.length,
    };

    const backupPayload = {
      signature: "ANTIGRAVITY_ACCOUNTING_BACKUP",
      version: "1.0",
      generatedAt: new Date().toISOString(),
      backupType: isFiltered ? "date_range" : "full",
      dateRange: {
        from: from || null,
        to: to || null,
      },
      company: {
        name: companyName,
        gstin: company.gstin || null,
        state: company.state || null,
        city: company.city || null,
      },
      counts,
      data: {
        companySettings,
        accountGroups,
        ledgers,
        parties,
        stockCategories,
        stockItems,
        stockBatches,
        drivers,
        vehicles,
        users,
        counters,
        saleInvoices,
        saleInvoiceItems,
        saleInvoicePayments,
        purchaseInvoices,
        purchaseInvoiceItems,
        purchaseInvoicePayments,
        receipts,
        payments,
        journalEntries,
        journalLines,
        creditNotes,
        creditNoteItems,
        debitNotes,
        debitNoteItems,
        orders,
        orderItems,
        purchaseOrders,
        purchaseOrderItems,
        deliveries,
        deliveryInvoices,
        stockTransactions,
      },
    };

    const dateTag = isFiltered ? `_${from || "start"}_to_${to || "now"}` : "_full";
    const filename = `backup_${companySlug}${dateTag}_${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(backupPayload);
  } catch (err: any) {
    console.error("Backup export error:", err);
    res.status(500).json({ error: err.message || "Failed to generate backup" });
  }
});

// ==========================================
// 2. INSPECT BACKUP FILE
// ==========================================
router.post("/backup/inspect", authMiddleware, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || payload.signature !== "ANTIGRAVITY_ACCOUNTING_BACKUP" || !payload.data) {
      return res.status(400).json({
        error: "Invalid backup file. Make sure you uploaded a genuine Antigravity Accounting backup file.",
      });
    }

    res.json({
      valid: true,
      signature: payload.signature,
      version: payload.version || "1.0",
      generatedAt: payload.generatedAt,
      backupType: payload.backupType || "full",
      dateRange: payload.dateRange || {},
      company: payload.company || {},
      counts: payload.counts || {},
    });
  } catch (err: any) {
    console.error("Backup inspect error:", err);
    res.status(500).json({ error: err.message || "Failed to inspect backup file" });
  }
});

// ==========================================
// 3. RESTORE BACKUP
// ==========================================
router.post("/backup/restore", authMiddleware, async (req, res) => {
  try {
    const { backupData, mode = "merge" } = req.body as {
      backupData: any;
      mode?: "merge" | "replace";
    };

    if (!backupData || backupData.signature !== "ANTIGRAVITY_ACCOUNTING_BACKUP" || !backupData.data) {
      return res.status(400).json({
        error: "Invalid backup file payload. Restoration aborted.",
      });
    }

    const d = backupData.data;

    // ID remapping dictionaries (oldId -> newId)
    const partyIdMap = new Map<number, number>();
    const ledgerIdMap = new Map<number, number>();
    const catIdMap = new Map<number, number>();
    const itemIdMap = new Map<number, number>();
    const batchIdMap = new Map<number, number>();
    const driverIdMap = new Map<number, number>();
    const vehicleIdMap = new Map<number, number>();
    const saleInvoiceIdMap = new Map<number, number>();
    const purchaseInvoiceIdMap = new Map<number, number>();
    const journalIdMap = new Map<number, number>();
    const creditNoteIdMap = new Map<number, number>();
    const debitNoteIdMap = new Map<number, number>();
    const orderIdMap = new Map<number, number>();
    const purchaseOrderIdMap = new Map<number, number>();
    const deliveryIdMap = new Map<number, number>();

    const restoredCounts: Record<string, number> = {
      parties: 0,
      ledgers: 0,
      stockCategories: 0,
      stockItems: 0,
      stockBatches: 0,
      saleInvoices: 0,
      purchaseInvoices: 0,
      receipts: 0,
      payments: 0,
      journalEntries: 0,
      creditNotes: 0,
      debitNotes: 0,
      orders: 0,
      purchaseOrders: 0,
      deliveries: 0,
      stockTransactions: 0,
    };

    // If replace mode, clear transactional tables first
    if (mode === "replace") {
      await db.delete(deliveryInvoicesTable);
      await db.delete(deliveriesTable);
      await db.delete(orderItemsTable);
      await db.delete(ordersTable);
      await db.delete(purchaseOrderItemsTable);
      await db.delete(purchaseOrdersTable);
      await db.delete(debitNoteItemsTable);
      await db.delete(debitNotesTable);
      await db.delete(creditNoteItemsTable);
      await db.delete(creditNotesTable);
      await db.delete(journalLinesTable);
      await db.delete(journalEntriesTable);
      await db.delete(receiptsTable);
      await db.delete(paymentsTable);
      await db.delete(purchaseInvoicePaymentsTable);
      await db.delete(purchaseInvoiceItemsTable);
      await db.delete(purchaseInvoicesTable);
      await db.delete(saleInvoicePaymentsTable);
      await db.delete(saleInvoiceItemsTable);
      await db.delete(saleInvoicesTable);
      await db.delete(stockTransactionsTable);
    }

    // 1. Restore Company Settings if replace mode
    if (mode === "replace" && Array.isArray(d.companySettings) && d.companySettings[0]) {
      const cs = d.companySettings[0];
      const [existingCs] = await db.select({ id: companySettingsTable.id }).from(companySettingsTable).limit(1);
      const cleanCs = { ...cs };
      delete cleanCs.id;
      delete cleanCs.createdAt;
      delete cleanCs.updatedAt;

      if (existingCs) {
        await db.update(companySettingsTable).set(cleanCs).where(eq(companySettingsTable.id, existingCs.id));
      } else {
        await db.insert(companySettingsTable).values(cleanCs);
      }
    }

    // 2. Restore Account Groups
    if (Array.isArray(d.accountGroups)) {
      for (const g of d.accountGroups) {
        const [existing] = await db.select({ id: accountGroupsTable.id })
          .from(accountGroupsTable)
          .where(eq(accountGroupsTable.name, g.name))
          .limit(1);
        if (!existing) {
          await db.insert(accountGroupsTable).values({
            name: g.name,
            nature: g.nature || "Asset",
            statement: g.statement || "Balance Sheet",
            parentGroup: g.parentGroup || "assets",
            isSystem: g.isSystem || "false",
          });
        }
      }
    }

    // 3. Restore Ledgers & build ledgerIdMap
    if (Array.isArray(d.ledgers)) {
      for (const l of d.ledgers) {
        const [existing] = await db.select({ id: ledgersTable.id })
          .from(ledgersTable)
          .where(and(eq(ledgersTable.name, l.name), eq(ledgersTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          ledgerIdMap.set(l.id, existing.id);
        } else {
          const [inserted] = await db.insert(ledgersTable).values({
            name: l.name,
            group: l.group,
            nature: l.nature || "dr",
            openingBalance: String(l.openingBalance || 0),
            isSystem: l.isSystem || "false",
            bankName: l.bankName || null,
            bankBranch: l.bankBranch || null,
            accountNumber: l.accountNumber || null,
            ifscCode: l.ifscCode || null,
            upiId: l.upiId || null,
            isGstApplicable: l.isGstApplicable || false,
            gstCalculationMethod: l.gstCalculationMethod || "none",
            gstRate: l.gstRate ? String(l.gstRate) : null,
            hsnSac: l.hsnSac || null,
          }).returning();
          ledgerIdMap.set(l.id, inserted.id);
          restoredCounts.ledgers++;
        }
      }
    }

    // 4. Restore Parties & build partyIdMap
    if (Array.isArray(d.parties)) {
      for (const p of d.parties) {
        const [existing] = await db.select({ id: partiesTable.id })
          .from(partiesTable)
          .where(and(eq(partiesTable.name, p.name), eq(partiesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          partyIdMap.set(p.id, existing.id);
        } else {
          const [inserted] = await db.insert(partiesTable).values({
            name: p.name,
            type: p.type || "customer",
            accountGroup: p.accountGroup || "Sundry Debtors",
            gstType: p.gstType || "unregistered",
            gstHistory: typeof p.gstHistory === "string" ? p.gstHistory : JSON.stringify(p.gstHistory || []),
            isOutOfState: p.isOutOfState || "false",
            address: p.address || null,
            city: p.city || null,
            state: p.state || null,
            pincode: p.pincode || null,
            gstin: p.gstin || null,
            pan: p.pan || null,
            phone: p.phone || null,
            email: p.email || null,
            creditLimitEnabled: p.creditLimitEnabled || "false",
            creditLimit: p.creditLimit ? String(p.creditLimit) : null,
            paymentTerms: p.paymentTerms || null,
            openingBalance: String(p.openingBalance || 0),
            balanceType: p.balanceType || "dr",
            interestEnabled: p.interestEnabled || "false",
            interestGracePeriod: String(p.interestGracePeriod || 0),
            interestRate: p.interestRate ? String(p.interestRate) : null,
            interestByTransaction: p.interestByTransaction || "false",
          }).returning();
          partyIdMap.set(p.id, inserted.id);
          restoredCounts.parties++;
        }
      }
    }

    // 5. Restore Stock Categories & build catIdMap
    if (Array.isArray(d.stockCategories)) {
      for (const c of d.stockCategories) {
        const [existing] = await db.select({ id: stockCategoriesTable.id })
          .from(stockCategoriesTable)
          .where(eq(stockCategoriesTable.name, c.name))
          .limit(1);

        if (existing) {
          catIdMap.set(c.id, existing.id);
        } else {
          const [inserted] = await db.insert(stockCategoriesTable).values({
            name: c.name,
          }).returning();
          catIdMap.set(c.id, inserted.id);
          restoredCounts.stockCategories++;
        }
      }
    }

    // 6. Restore Stock Items & build itemIdMap
    if (Array.isArray(d.stockItems)) {
      for (const item of d.stockItems) {
        const [existing] = await db.select({ id: stockItemsTable.id })
          .from(stockItemsTable)
          .where(and(eq(stockItemsTable.name, item.name), eq(stockItemsTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          itemIdMap.set(item.id, existing.id);
        } else {
          const newCatId = item.categoryId ? catIdMap.get(item.categoryId) || null : null;
          const [inserted] = await db.insert(stockItemsTable).values({
            name: item.name,
            categoryId: newCatId,
            hsnCode: item.hsnCode || null,
            unit: item.unit || "pcs",
            purchaseRate: String(item.purchaseRate || 0),
            saleRate: String(item.saleRate || 0),
            minStockLevel: String(item.minStockLevel || 0),
            barcode: item.barcode || null,
            brand: item.brand || null,
            physicalStock: String(item.physicalStock || 0),
            gstApplicable: item.gstApplicable || "false",
            gstRate: String(item.gstRate || 0),
            isDecimalApplicable: item.isDecimalApplicable !== undefined ? item.isDecimalApplicable : true,
            decimalPlaces: item.decimalPlaces !== undefined ? Number(item.decimalPlaces) : 2,
            isTaxLiability: item.isTaxLiability !== undefined ? item.isTaxLiability : true,
          }).returning();
          itemIdMap.set(item.id, inserted.id);
          restoredCounts.stockItems++;
        }
      }
    }

    // 7. Restore Stock Batches & build batchIdMap
    if (Array.isArray(d.stockBatches)) {
      for (const b of d.stockBatches) {
        const newItemId = b.stockItemId ? itemIdMap.get(b.stockItemId) || null : null;
        const [existing] = await db.select({ id: stockBatchesTable.id })
          .from(stockBatchesTable)
          .where(and(eq(stockBatchesTable.name, b.name), newItemId ? eq(stockBatchesTable.stockItemId, newItemId) : sql`true`))
          .limit(1);

        if (existing) {
          batchIdMap.set(b.id, existing.id);
        } else {
          const [inserted] = await db.insert(stockBatchesTable).values({
            name: b.name,
            description: b.description || null,
            expiryDate: b.expiryDate || null,
            stockItemId: newItemId,
            openingStock: String(b.openingStock || 0),
            physicalStock: String(b.physicalStock || 0),
            reservedStock: String(b.reservedStock || 0),
          }).returning();
          batchIdMap.set(b.id, inserted.id);
          restoredCounts.stockBatches++;
        }
      }
    }

    // 8. Drivers & Vehicles
    if (Array.isArray(d.drivers)) {
      for (const drv of d.drivers) {
        const [existing] = await db.select({ id: driversTable.id })
          .from(driversTable).where(eq(driversTable.name, drv.name)).limit(1);
        if (existing) {
          driverIdMap.set(drv.id, existing.id);
        } else {
          const [inserted] = await db.insert(driversTable).values({
            name: drv.name,
            phone: drv.phone || null,
            licenseNumber: drv.licenseNumber || null,
            notes: drv.notes || null,
          }).returning();
          driverIdMap.set(drv.id, inserted.id);
        }
      }
    }

    if (Array.isArray(d.vehicles)) {
      for (const v of d.vehicles) {
        const [existing] = await db.select({ id: vehiclesTable.id })
          .from(vehiclesTable).where(eq(vehiclesTable.vehicleNumber, v.vehicleNumber)).limit(1);
        if (existing) {
          vehicleIdMap.set(v.id, existing.id);
        } else {
          const [inserted] = await db.insert(vehiclesTable).values({
            vehicleNumber: v.vehicleNumber,
            name: v.name || null,
            type: v.type || null,
            ownerName: v.ownerName || null,
            driverName: v.driverName || null,
            driverPhone: v.driverPhone || null,
          }).returning();
          vehicleIdMap.set(v.id, inserted.id);
        }
      }
    }

    // 9. Restore Sale Invoices & Child items
    if (Array.isArray(d.saleInvoices)) {
      for (const inv of d.saleInvoices) {
        const [existing] = await db.select({ id: saleInvoicesTable.id })
          .from(saleInvoicesTable)
          .where(and(eq(saleInvoicesTable.invoiceNumber, inv.invoiceNumber), eq(saleInvoicesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          saleInvoiceIdMap.set(inv.id, existing.id);
        } else {
          const mappedPartyId = inv.partyId ? partyIdMap.get(inv.partyId) || null : null;
          const [inserted] = await db.insert(saleInvoicesTable).values({
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            partyId: mappedPartyId,
            partyName: inv.partyName,
            partyGstin: inv.partyGstin || null,
            billingAddress: inv.billingAddress || null,
            isGst: inv.isGst !== undefined ? inv.isGst : true,
            isInterstate: inv.isInterstate || false,
            subtotal: String(inv.subtotal || 0),
            totalDiscount: String(inv.totalDiscount || 0),
            totalTaxable: String(inv.totalTaxable || 0),
            totalCgst: String(inv.totalCgst || 0),
            totalSgst: String(inv.totalSgst || 0),
            totalIgst: String(inv.totalIgst || 0),
            totalGst: String(inv.totalGst || 0),
            grandTotal: String(inv.grandTotal || 0),
            amountPaid: String(inv.amountPaid || 0),
            balanceDue: String(inv.balanceDue || 0),
            notes: inv.notes || null,
            otherCharges: inv.otherCharges || null,
            status: inv.status || "confirmed",
            isKaccha: inv.isKaccha || false,
          }).returning();
          saleInvoiceIdMap.set(inv.id, inserted.id);
          restoredCounts.saleInvoices++;
        }
      }

      // Restore sale items
      if (Array.isArray(d.saleInvoiceItems)) {
        for (const item of d.saleInvoiceItems) {
          const newInvId = saleInvoiceIdMap.get(item.invoiceId);
          if (!newInvId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;
          const newBatchId = item.batchId ? batchIdMap.get(item.batchId) || null : null;

          await db.insert(saleInvoiceItemsTable).values({
            invoiceId: newInvId,
            stockItemId: newStockItemId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPct: String(item.discountPct || 0),
            gstPct: String(item.gstPct || 0),
            gstInclusive: item.gstInclusive || false,
            taxableAmount: String(item.taxableAmount || 0),
            cgst: String(item.cgst || 0),
            sgst: String(item.sgst || 0),
            igst: String(item.igst || 0),
            total: String(item.total || 0),
            batchId: newBatchId,
            description: item.description || null,
          });
        }
      }

      // Restore sale invoice payments
      if (Array.isArray(d.saleInvoicePayments)) {
        for (const p of d.saleInvoicePayments) {
          const newInvId = saleInvoiceIdMap.get(p.invoiceId);
          if (!newInvId) continue;
          const newLedgerId = p.ledgerId ? ledgerIdMap.get(p.ledgerId) || null : null;
          await db.insert(saleInvoicePaymentsTable).values({
            invoiceId: newInvId,
            mode: p.mode || "Cash",
            amount: String(p.amount || 0),
            reference: p.reference || null,
            notes: p.notes || null,
            ledgerId: newLedgerId,
          });
        }
      }
    }

    // 10. Restore Purchase Invoices & Child items
    if (Array.isArray(d.purchaseInvoices)) {
      for (const inv of d.purchaseInvoices) {
        const [existing] = await db.select({ id: purchaseInvoicesTable.id })
          .from(purchaseInvoicesTable)
          .where(and(eq(purchaseInvoicesTable.invoiceNumber, inv.invoiceNumber), eq(purchaseInvoicesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          purchaseInvoiceIdMap.set(inv.id, existing.id);
        } else {
          const mappedPartyId = inv.partyId ? partyIdMap.get(inv.partyId) || null : null;
          const [inserted] = await db.insert(purchaseInvoicesTable).values({
            invoiceNumber: inv.invoiceNumber,
            supplierInvoiceNumber: inv.supplierInvoiceNumber || null,
            date: inv.date,
            partyId: mappedPartyId,
            partyName: inv.partyName,
            isGst: inv.isGst !== undefined ? inv.isGst : true,
            isInterstate: inv.isInterstate || false,
            isReverseCharge: inv.isReverseCharge || false,
            subtotal: String(inv.subtotal || 0),
            totalTaxable: String(inv.totalTaxable || 0),
            totalCgst: String(inv.totalCgst || 0),
            totalSgst: String(inv.totalSgst || 0),
            totalIgst: String(inv.totalIgst || 0),
            grandTotal: String(inv.grandTotal || 0),
            amountPaid: String(inv.amountPaid || 0),
            balanceDue: String(inv.balanceDue || 0),
            status: inv.status || "confirmed",
            notes: inv.notes || null,
            otherCharges: inv.otherCharges || null,
            isKaccha: inv.isKaccha || false,
          }).returning();
          purchaseInvoiceIdMap.set(inv.id, inserted.id);
          restoredCounts.purchaseInvoices++;
        }
      }

      if (Array.isArray(d.purchaseInvoiceItems)) {
        for (const item of d.purchaseInvoiceItems) {
          const newInvId = purchaseInvoiceIdMap.get(item.invoiceId);
          if (!newInvId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;
          const newBatchId = item.batchId ? batchIdMap.get(item.batchId) || null : null;

          await db.insert(purchaseInvoiceItemsTable).values({
            invoiceId: newInvId,
            stockItemId: newStockItemId,
            batchId: newBatchId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPct: String(item.discountPct || 0),
            gstPct: String(item.gstPct || 0),
            gstInclusive: item.gstInclusive || false,
            taxableAmount: String(item.taxableAmount || 0),
            cgst: String(item.cgst || 0),
            sgst: String(item.sgst || 0),
            igst: String(item.igst || 0),
            total: String(item.total || 0),
          });
        }
      }

      if (Array.isArray(d.purchaseInvoicePayments)) {
        for (const p of d.purchaseInvoicePayments) {
          const newInvId = purchaseInvoiceIdMap.get(p.invoiceId);
          if (!newInvId) continue;
          await db.insert(purchaseInvoicePaymentsTable).values({
            invoiceId: newInvId,
            mode: p.mode || "Bank",
            amount: String(p.amount || 0),
            reference: p.reference || null,
          });
        }
      }
    }

    // 11. Receipts & Payments
    if (Array.isArray(d.receipts)) {
      for (const r of d.receipts) {
        const [existing] = await db.select({ id: receiptsTable.id })
          .from(receiptsTable)
          .where(and(eq(receiptsTable.voucherNumber, r.voucherNumber), eq(receiptsTable.isDeleted, "false")))
          .limit(1);

        if (!existing) {
          const mappedPartyId = r.partyId ? partyIdMap.get(r.partyId) || null : null;
          const mappedLedgerId = r.ledgerId ? ledgerIdMap.get(r.ledgerId) || r.ledgerId : r.ledgerId;

          // Remap allocations if present
          let allocs = r.ledgerAllocations;
          if (typeof allocs === "string") {
            try { allocs = JSON.parse(allocs); } catch { allocs = []; }
          }
          if (Array.isArray(allocs)) {
            allocs = allocs.map((a: any) => ({
              ...a,
              ledgerId: a.ledgerId ? ledgerIdMap.get(a.ledgerId) || a.ledgerId : a.ledgerId,
            }));
          }

          await db.insert(receiptsTable).values({
            voucherNumber: r.voucherNumber,
            date: r.date,
            partyId: mappedPartyId,
            partyName: r.partyName,
            ledgerId: mappedLedgerId,
            paymentMode: r.paymentMode || "cash",
            amount: String(r.amount || 0),
            narration: r.narration || null,
            reference: r.reference || null,
            ledgerAllocations: allocs ? JSON.stringify(allocs) : null,
            isKaccha: r.isKaccha || false,
          });
          restoredCounts.receipts++;
        }
      }
    }

    if (Array.isArray(d.payments)) {
      for (const p of d.payments) {
        const [existing] = await db.select({ id: paymentsTable.id })
          .from(paymentsTable)
          .where(and(eq(paymentsTable.voucherNumber, p.voucherNumber), eq(paymentsTable.isDeleted, "false")))
          .limit(1);

        if (!existing) {
          const mappedPartyId = p.partyId ? partyIdMap.get(p.partyId) || null : null;
          const mappedLedgerId = p.ledgerId ? ledgerIdMap.get(p.ledgerId) || p.ledgerId : p.ledgerId;

          let allocs = p.ledgerAllocations;
          if (typeof allocs === "string") {
            try { allocs = JSON.parse(allocs); } catch { allocs = []; }
          }
          if (Array.isArray(allocs)) {
            allocs = allocs.map((a: any) => ({
              ...a,
              ledgerId: a.ledgerId ? ledgerIdMap.get(a.ledgerId) || a.ledgerId : a.ledgerId,
            }));
          }

          await db.insert(paymentsTable).values({
            voucherNumber: p.voucherNumber,
            date: p.date,
            partyId: mappedPartyId,
            partyName: p.partyName,
            ledgerId: mappedLedgerId,
            paymentMode: p.paymentMode || "cash",
            amount: String(p.amount || 0),
            narration: p.narration || null,
            reference: p.reference || null,
            ledgerAllocations: allocs ? JSON.stringify(allocs) : null,
            isKaccha: p.isKaccha || false,
          });
          restoredCounts.payments++;
        }
      }
    }

    // 12. Journal Entries & Lines
    if (Array.isArray(d.journalEntries)) {
      for (const j of d.journalEntries) {
        const [existing] = await db.select({ id: journalEntriesTable.id })
          .from(journalEntriesTable)
          .where(and(eq(journalEntriesTable.voucherNumber, j.voucherNumber), eq(journalEntriesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          journalIdMap.set(j.id, existing.id);
        } else {
          const [inserted] = await db.insert(journalEntriesTable).values({
            voucherNumber: j.voucherNumber,
            voucherType: j.voucherType || "journal",
            date: j.date,
            narration: j.narration || "",
            totalDebit: String(j.totalDebit || 0),
            totalCredit: String(j.totalCredit || 0),
            isKaccha: j.isKaccha || false,
          }).returning();
          journalIdMap.set(j.id, inserted.id);
          restoredCounts.journalEntries++;
        }
      }

      if (Array.isArray(d.journalLines)) {
        for (const line of d.journalLines) {
          const newJId = journalIdMap.get(line.entryId);
          if (!newJId) continue;
          const newLedgerId = line.ledgerId ? ledgerIdMap.get(line.ledgerId) || line.ledgerId : line.ledgerId;
          const mappedPartyId = line.partyId ? partyIdMap.get(line.partyId) || null : null;

          await db.insert(journalLinesTable).values({
            entryId: newJId,
            ledgerId: newLedgerId,
            partyId: mappedPartyId,
            type: line.type,
            amount: String(line.amount || 0),
          });
        }
      }
    }

    // 13. Credit Notes & Items
    if (Array.isArray(d.creditNotes)) {
      for (const cn of d.creditNotes) {
        const [existing] = await db.select({ id: creditNotesTable.id })
          .from(creditNotesTable)
          .where(and(eq(creditNotesTable.noteNumber, cn.noteNumber), eq(creditNotesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          creditNoteIdMap.set(cn.id, existing.id);
        } else {
          const mappedPartyId = cn.partyId ? partyIdMap.get(cn.partyId) || null : null;
          const mappedOrigInvId = cn.saleInvoiceId ? saleInvoiceIdMap.get(cn.saleInvoiceId) || null : null;

          const [inserted] = await db.insert(creditNotesTable).values({
            noteNumber: cn.noteNumber,
            date: cn.date,
            saleInvoiceId: mappedOrigInvId,
            partyId: mappedPartyId,
            partyName: cn.partyName,
            reason: cn.reason || "Sales Return",
            amount: String(cn.amount || 0),
            otherCharges: cn.otherCharges || null,
          }).returning();
          creditNoteIdMap.set(cn.id, inserted.id);
          restoredCounts.creditNotes++;
        }
      }

      if (Array.isArray(d.creditNoteItems)) {
        for (const item of d.creditNoteItems) {
          const newCnId = creditNoteIdMap.get(item.noteId);
          if (!newCnId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;
          const newBatchId = item.batchId ? batchIdMap.get(item.batchId) || null : null;

          await db.insert(creditNoteItemsTable).values({
            noteId: newCnId,
            stockItemId: newStockItemId,
            batchId: newBatchId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPct: String(item.discountPct || 0),
            gstPct: String(item.gstPct || 0),
            gstInclusive: item.gstInclusive || false,
            taxableAmount: String(item.taxableAmount || 0),
            cgst: String(item.cgst || 0),
            sgst: String(item.sgst || 0),
            igst: String(item.igst || 0),
            total: String(item.total || 0),
          });
        }
      }
    }

    // 14. Debit Notes & Items
    if (Array.isArray(d.debitNotes)) {
      for (const dn of d.debitNotes) {
        const [existing] = await db.select({ id: debitNotesTable.id })
          .from(debitNotesTable)
          .where(and(eq(debitNotesTable.noteNumber, dn.noteNumber), eq(debitNotesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          debitNoteIdMap.set(dn.id, existing.id);
        } else {
          const mappedPartyId = dn.partyId ? partyIdMap.get(dn.partyId) || null : null;
          const mappedOrigInvId = dn.purchaseInvoiceId ? purchaseInvoiceIdMap.get(dn.purchaseInvoiceId) || null : null;

          const [inserted] = await db.insert(debitNotesTable).values({
            noteNumber: dn.noteNumber,
            date: dn.date,
            purchaseInvoiceId: mappedOrigOrigId || mappedOrigInvId,
            partyId: mappedPartyId,
            partyName: dn.partyName,
            reason: dn.reason || "Purchase Return",
            amount: String(dn.amount || 0),
            otherCharges: dn.otherCharges || null,
          }).returning();
          debitNoteIdMap.set(dn.id, inserted.id);
          restoredCounts.debitNotes++;
        }
      }

      if (Array.isArray(d.debitNoteItems)) {
        for (const item of d.debitNoteItems) {
          const newDnId = debitNoteIdMap.get(item.noteId);
          if (!newDnId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;
          const newBatchId = item.batchId ? batchIdMap.get(item.batchId) || null : null;

          await db.insert(debitNoteItemsTable).values({
            noteId: newDnId,
            stockItemId: newStockItemId,
            batchId: newBatchId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPct: String(item.discountPct || 0),
            gstPct: String(item.gstPct || 0),
            gstInclusive: item.gstInclusive || false,
            taxableAmount: String(item.taxableAmount || 0),
            cgst: String(item.cgst || 0),
            sgst: String(item.sgst || 0),
            igst: String(item.igst || 0),
            total: String(item.total || 0),
          });
        }
      }
    }

    // 15. Orders & Purchase Orders
    if (Array.isArray(d.orders)) {
      for (const ord of d.orders) {
        const [existing] = await db.select({ id: ordersTable.id })
          .from(ordersTable)
          .where(and(eq(ordersTable.orderNumber, ord.orderNumber), eq(ordersTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          orderIdMap.set(ord.id, existing.id);
        } else {
          const mappedPartyId = ord.partyId ? partyIdMap.get(ord.partyId) || null : null;
          const [inserted] = await db.insert(ordersTable).values({
            orderNumber: ord.orderNumber,
            date: ord.date,
            partyId: mappedPartyId,
            partyName: ord.partyName,
            partyPhone: ord.partyPhone || null,
            deliveryAddress: ord.deliveryAddress || null,
            notes: ord.notes || null,
            status: ord.status || "pending",
            grandTotal: String(ord.grandTotal || 0),
            driverName: ord.driverName || null,
            vehicleName: ord.vehicleName || null,
            vehicleNo: ord.vehicleNo || null,
            dispatchNotes: ord.dispatchNotes || null,
            deliveryDate: ord.deliveryDate || null,
            isKaccha: ord.isKaccha || false,
          }).returning();
          orderIdMap.set(ord.id, inserted.id);
          restoredCounts.orders++;
        }
      }

      if (Array.isArray(d.orderItems)) {
        for (const item of d.orderItems) {
          const newOrderId = orderIdMap.get(item.orderId);
          if (!newOrderId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;
          const newBatchId = item.batchId ? batchIdMap.get(item.batchId) || null : null;

          await db.insert(orderItemsTable).values({
            orderId: newOrderId,
            stockItemId: newStockItemId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPct: String(item.discountPct || 0),
            gstPct: String(item.gstPct || 0),
            gstInclusive: item.gstInclusive || false,
            taxableAmount: String(item.taxableAmount || 0),
            cgst: String(item.cgst || 0),
            sgst: String(item.sgst || 0),
            igst: String(item.igst || 0),
            total: String(item.total || 0),
            batchId: newBatchId,
            description: item.description || null,
          });
        }
      }
    }

    if (Array.isArray(d.purchaseOrders)) {
      for (const po of d.purchaseOrders) {
        const [existing] = await db.select({ id: purchaseOrdersTable.id })
          .from(purchaseOrdersTable)
          .where(and(eq(purchaseOrdersTable.poNumber, po.poNumber), eq(purchaseOrdersTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          purchaseOrderIdMap.set(po.id, existing.id);
        } else {
          const mappedPartyId = po.partyId ? partyIdMap.get(po.partyId) || null : null;
          const [inserted] = await db.insert(purchaseOrdersTable).values({
            poNumber: po.poNumber,
            date: po.date,
            partyId: mappedPartyId,
            partyName: po.partyName,
            status: po.status || "open",
            grandTotal: String(po.grandTotal || 0),
            notes: po.notes || null,
            deliveryDate: po.deliveryDate || null,
            isKaccha: po.isKaccha || false,
          }).returning();
          purchaseOrderIdMap.set(po.id, inserted.id);
          restoredCounts.purchaseOrders++;
        }
      }

      if (Array.isArray(d.purchaseOrderItems)) {
        for (const item of d.purchaseOrderItems) {
          const newPoId = purchaseOrderIdMap.get(item.orderId);
          if (!newPoId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;
          const newBatchId = item.batchId ? batchIdMap.get(item.batchId) || null : null;

          await db.insert(purchaseOrderItemsTable).values({
            orderId: newPoId,
            stockItemId: newStockItemId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPct: String(item.discountPct || 0),
            gstPct: String(item.gstPct || 0),
            gstInclusive: item.gstInclusive || false,
            taxableAmount: String(item.taxableAmount || 0),
            cgst: String(item.cgst || 0),
            sgst: String(item.sgst || 0),
            igst: String(item.igst || 0),
            batchId: newBatchId,
            total: String(item.total || 0),
            receivedQty: String(item.receivedQty || 0),
          });
        }
      }
    }

    // 16. Deliveries & Invoices
    if (Array.isArray(d.deliveries)) {
      for (const del of d.deliveries) {
        const [existing] = await db.select({ id: deliveriesTable.id })
          .from(deliveriesTable)
          .where(eq(deliveriesTable.tripNumber, del.tripNumber))
          .limit(1);

        if (existing) {
          deliveryIdMap.set(del.id, existing.id);
        } else {
          const mappedSaleInvId = del.saleInvoiceId ? saleInvoiceIdMap.get(del.saleInvoiceId) || null : null;
          const mappedDriverId = del.driverId ? driverIdMap.get(del.driverId) || null : null;
          const mappedVehicleId = del.vehicleId ? vehicleIdMap.get(del.vehicleId) || null : null;

          const [inserted] = await db.insert(deliveriesTable).values({
            challanNumber: del.challanNumber || null,
            tripNumber: del.tripNumber,
            date: del.date || null,
            saleInvoiceId: mappedSaleInvId,
            driverId: mappedDriverId,
            vehicleId: mappedVehicleId,
            invoiceNumber: del.invoiceNumber || null,
            partyName: del.partyName || null,
            destination: del.destination || null,
            status: del.status || "pending",
            totalAmount: String(del.totalAmount || 0),
            notes: del.notes || null,
          }).returning();
          deliveryIdMap.set(del.id, inserted.id);
          restoredCounts.deliveries++;
        }
      }

      if (Array.isArray(d.deliveryInvoices)) {
        for (const di of d.deliveryInvoices) {
          const newDelId = deliveryIdMap.get(di.deliveryId);
          if (!newDelId) continue;
          const mappedInvId = saleInvoiceIdMap.get(di.invoiceId) || di.invoiceId;

          await db.insert(deliveryInvoicesTable).values({
            deliveryId: newDelId,
            invoiceId: mappedInvId,
          });
        }
      }
    }

    // 17. Stock Transactions
    if (Array.isArray(d.stockTransactions)) {
      for (const tx of d.stockTransactions) {
        const newItemId = tx.itemId ? itemIdMap.get(tx.itemId) || null : null;
        if (!newItemId) continue;
        const newBatchId = tx.batchId ? batchIdMap.get(tx.batchId) || null : null;

        await db.insert(stockTransactionsTable).values({
          itemId: newItemId,
          batchId: newBatchId,
          type: tx.type,
          quantity: String(tx.quantity || 0),
          balanceAfter: String(tx.balanceAfter || 0),
          reference: tx.reference || null,
          createdAt: tx.createdAt ? new Date(tx.createdAt) : undefined,
        });
        restoredCounts.stockTransactions++;
      }
    }

    // 18. Sync sequence Counters
    if (Array.isArray(d.counters)) {
      for (const c of d.counters) {
        const [existing] = await db.select().from(countersTable).where(eq(countersTable.name, c.name)).limit(1);
        if (existing) {
          if (Number(c.value) > Number(existing.value)) {
            await db.update(countersTable).set({ value: Number(c.value) }).where(eq(countersTable.id, existing.id));
          }
        } else {
          await db.insert(countersTable).values({ name: c.name, value: Number(c.value) || 0 });
        }
      }
    }

    res.json({
      success: true,
      message: "Backup restored successfully.",
      mode,
      restoredCounts,
    });
  } catch (err: any) {
    console.error("Backup restore error:", err);
    res.status(500).json({ error: err.message || "Failed to restore backup" });
  }
});

export default router;
