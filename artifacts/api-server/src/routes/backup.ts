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
  stockItemGstHistoryTable,
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

    // 1. Query Masters (always included)
    const [
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
    ] = await Promise.all([
      db.select().from(companySettingsTable),
      db.select().from(accountGroupsTable).where(eq(accountGroupsTable.isDeleted, "false")),
      db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false")),
      db.select().from(partiesTable).where(eq(partiesTable.isDeleted, "false")),
      db.select().from(stockCategoriesTable).where(eq(stockCategoriesTable.isDeleted, "false")),
      db.select().from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false")),
      db.select().from(stockBatchesTable),
      db.select().from(driversTable),
      db.select().from(vehiclesTable),
      db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        permissions: usersTable.permissions,
        passwordHash: usersTable.passwordHash,
        isDeleted: usersTable.isDeleted,
      }).from(usersTable).where(eq(usersTable.isDeleted, "false")),
      db.select().from(countersTable),
    ]);

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
    const saleInvoiceIds = saleInvoices.map(s => s.id);

    let saleInvoiceItems: any[] = [];
    let saleInvoicePayments: any[] = [];
    if (saleInvoiceIds.length > 0) {
      [saleInvoiceItems, saleInvoicePayments] = await Promise.all([
        db.select().from(saleInvoiceItemsTable).where(inArray(saleInvoiceItemsTable.invoiceId, saleInvoiceIds)),
        db.select().from(saleInvoicePaymentsTable).where(inArray(saleInvoicePaymentsTable.invoiceId, saleInvoiceIds)),
      ]);
    }

    const purchCond = buildDateCond(purchaseInvoicesTable.date);
    const purchaseInvoices = await db.select().from(purchaseInvoicesTable).where(purchCond);
    const purchaseInvoiceIds = purchaseInvoices.map(p => p.id);

    let purchaseInvoiceItems: any[] = [];
    let purchaseInvoicePayments: any[] = [];
    if (purchaseInvoiceIds.length > 0) {
      [purchaseInvoiceItems, purchaseInvoicePayments] = await Promise.all([
        db.select().from(purchaseInvoiceItemsTable).where(inArray(purchaseInvoiceItemsTable.invoiceId, purchaseInvoiceIds)),
        db.select().from(purchaseInvoicePaymentsTable).where(inArray(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoiceIds)),
      ]);
    }

    const [
      receipts,
      payments,
      journalEntries,
      creditNotes,
      debitNotes,
      orders,
      purchaseOrders,
      deliveries,
    ] = await Promise.all([
      db.select().from(receiptsTable).where(buildDateCond(receiptsTable.date)),
      db.select().from(paymentsTable).where(buildDateCond(paymentsTable.date)),
      db.select().from(journalEntriesTable).where(buildDateCond(journalEntriesTable.date)),
      db.select().from(creditNotesTable).where(buildDateCond(creditNotesTable.date)),
      db.select().from(debitNotesTable).where(buildDateCond(debitNotesTable.date)),
      db.select().from(ordersTable).where(buildDateCond(ordersTable.date)),
      db.select().from(purchaseOrdersTable).where(buildDateCond(purchaseOrdersTable.date)),
      db.select().from(deliveriesTable).where(
        from && to ? sql`${deliveriesTable.date} >= ${from}::date AND ${deliveriesTable.date} <= ${to}::date` :
        from ? sql`${deliveriesTable.date} >= ${from}::date` :
        to ? sql`${deliveriesTable.date} <= ${to}::date` : undefined
      ),
    ]);

    // Query voucher children
    const journalIds = journalEntries.map(j => j.id);
    const journalLines = journalIds.length > 0
      ? await db.select().from(journalLinesTable).where(inArray(journalLinesTable.journalEntryId, journalIds))
      : [];

    const creditNoteIds = creditNotes.map(c => c.id);
    const creditNoteItems = creditNoteIds.length > 0
      ? await db.select().from(creditNoteItemsTable).where(inArray(creditNoteItemsTable.creditNoteId, creditNoteIds))
      : [];

    const debitNoteIds = debitNotes.map(d => d.id);
    const debitNoteItems = debitNoteIds.length > 0
      ? await db.select().from(debitNoteItemsTable).where(inArray(debitNoteItemsTable.debitNoteId, debitNoteIds))
      : [];

    const orderIds = orders.map(o => o.id);
    const orderItems = orderIds.length > 0
      ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
      : [];

    const purchaseOrderIds = purchaseOrders.map(p => p.id);
    const purchaseOrderItems = purchaseOrderIds.length > 0
      ? await db.select().from(purchaseOrderItemsTable).where(inArray(purchaseOrderItemsTable.purchaseOrderId, purchaseOrderIds))
      : [];

    const deliveryIds = deliveries.map(d => d.id);
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

    const company = companySettings[0] || {};
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

    // 1. Restore Company Settings if available and replace mode
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
            bankName: l.bankName || null,
            bankBranch: l.bankBranch || null,
            accountNumber: l.accountNumber || null,
            ifscCode: l.ifscCode || null,
            upiId: l.upiId || null,
            isGstApplicable: l.isGstApplicable || false,
            gstCalculationMethod: l.gstCalculationMethod || "none",
            gstRate: l.gstRate || null,
            hsnSac: l.hsnSac || null,
            isSystem: l.isSystem || "false",
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
            gstHistory: p.gstHistory || "[]",
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
          .where(and(eq(stockCategoriesTable.name, c.name), eq(stockCategoriesTable.isDeleted, "false")))
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
    const saleInvoiceIdMap = new Map<number, number>();
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
            dueDate: inv.dueDate || null,
            partyId: mappedPartyId,
            partyName: inv.partyName,
            partyGstin: inv.partyGstin || null,
            partyState: inv.partyState || null,
            isOutOfState: inv.isOutOfState || "false",
            subtotal: String(inv.subtotal || 0),
            taxAmount: String(inv.taxAmount || 0),
            discountAmount: String(inv.discountAmount || 0),
            roundOff: String(inv.roundOff || 0),
            totalAmount: String(inv.totalAmount || 0),
            status: inv.status || "unpaid",
            notes: inv.notes || null,
            terms: inv.terms || null,
            isKaccha: inv.isKaccha || false,
            otherExpenses: inv.otherExpenses ? JSON.stringify(inv.otherExpenses) : null,
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
            batchId: newBatchId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPercent: String(item.discountPercent || 0),
            discountAmount: String(item.discountAmount || 0),
            taxRate: String(item.taxRate || 0),
            taxAmount: String(item.taxAmount || 0),
            cgstRate: String(item.cgstRate || 0),
            cgstAmount: String(item.cgstAmount || 0),
            sgstRate: String(item.sgstRate || 0),
            sgstAmount: String(item.sgstAmount || 0),
            igstRate: String(item.igstRate || 0),
            igstAmount: String(item.igstAmount || 0),
            totalAmount: String(item.totalAmount || 0),
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
            paymentDate: p.paymentDate,
            amount: String(p.amount || 0),
            paymentMode: p.paymentMode || "Cash",
            referenceNumber: p.referenceNumber || null,
            notes: p.notes || null,
            ledgerId: newLedgerId,
          });
        }
      }
    }

    // 10. Restore Purchase Invoices & Child items
    const purchaseInvoiceIdMap = new Map<number, number>();
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
            dueDate: inv.dueDate || null,
            partyId: mappedPartyId,
            partyName: inv.partyName,
            partyGstin: inv.partyGstin || null,
            partyState: inv.partyState || null,
            isOutOfState: inv.isOutOfState || "false",
            subtotal: String(inv.subtotal || 0),
            taxAmount: String(inv.taxAmount || 0),
            discountAmount: String(inv.discountAmount || 0),
            roundOff: String(inv.roundOff || 0),
            totalAmount: String(inv.totalAmount || 0),
            status: inv.status || "unpaid",
            notes: inv.notes || null,
            otherExpenses: inv.otherExpenses ? JSON.stringify(inv.otherExpenses) : null,
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
            discountPercent: String(item.discountPercent || 0),
            discountAmount: String(item.discountAmount || 0),
            taxRate: String(item.taxRate || 0),
            taxAmount: String(item.taxAmount || 0),
            cgstRate: String(item.cgstRate || 0),
            cgstAmount: String(item.cgstAmount || 0),
            sgstRate: String(item.sgstRate || 0),
            sgstAmount: String(item.sgstAmount || 0),
            igstRate: String(item.igstRate || 0),
            igstAmount: String(item.igstAmount || 0),
            totalAmount: String(item.totalAmount || 0),
          });
        }
      }

      if (Array.isArray(d.purchaseInvoicePayments)) {
        for (const p of d.purchaseInvoicePayments) {
          const newInvId = purchaseInvoiceIdMap.get(p.invoiceId);
          if (!newInvId) continue;
          const newLedgerId = p.ledgerId ? ledgerIdMap.get(p.ledgerId) || null : null;
          await db.insert(purchaseInvoicePaymentsTable).values({
            invoiceId: newInvId,
            paymentDate: p.paymentDate,
            amount: String(p.amount || 0),
            paymentMode: p.paymentMode || "Bank",
            referenceNumber: p.referenceNumber || null,
            notes: p.notes || null,
            ledgerId: newLedgerId,
          });
        }
      }
    }

    // 11. Receipts & Payments
    if (Array.isArray(d.receipts)) {
      for (const r of d.receipts) {
        const [existing] = await db.select({ id: receiptsTable.id })
          .from(receiptsTable)
          .where(and(eq(receiptsTable.receiptNumber, r.receiptNumber), eq(receiptsTable.isDeleted, "false")))
          .limit(1);

        if (!existing) {
          const mappedPartyId = r.partyId ? partyIdMap.get(r.partyId) || null : null;
          const mappedLedgerId = r.ledgerId ? ledgerIdMap.get(r.ledgerId) || null : null;

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
            receiptNumber: r.receiptNumber,
            date: r.date,
            partyId: mappedPartyId,
            partyName: r.partyName,
            amount: String(r.amount || 0),
            paymentMode: r.paymentMode || "Cash",
            referenceNumber: r.referenceNumber || null,
            notes: r.notes || null,
            ledgerId: mappedLedgerId,
            ledgerAllocations: allocs ? JSON.stringify(allocs) : null,
          });
          restoredCounts.receipts++;
        }
      }
    }

    if (Array.isArray(d.payments)) {
      for (const p of d.payments) {
        const [existing] = await db.select({ id: paymentsTable.id })
          .from(paymentsTable)
          .where(and(eq(paymentsTable.paymentNumber, p.paymentNumber), eq(paymentsTable.isDeleted, "false")))
          .limit(1);

        if (!existing) {
          const mappedPartyId = p.partyId ? partyIdMap.get(p.partyId) || null : null;
          const mappedLedgerId = p.ledgerId ? ledgerIdMap.get(p.ledgerId) || null : null;

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
            paymentNumber: p.paymentNumber,
            date: p.date,
            partyId: mappedPartyId,
            partyName: p.partyName,
            amount: String(p.amount || 0),
            paymentMode: p.paymentMode || "Cash",
            referenceNumber: p.referenceNumber || null,
            notes: p.notes || null,
            ledgerId: mappedLedgerId,
            ledgerAllocations: allocs ? JSON.stringify(allocs) : null,
          });
          restoredCounts.payments++;
        }
      }
    }

    // 12. Journal Entries & Lines
    const journalIdMap = new Map<number, number>();
    if (Array.isArray(d.journalEntries)) {
      for (const j of d.journalEntries) {
        const [existing] = await db.select({ id: journalEntriesTable.id })
          .from(journalEntriesTable)
          .where(and(eq(journalEntriesTable.entryNumber, j.entryNumber), eq(journalEntriesTable.isDeleted, "false")))
          .limit(1);

        if (existing) {
          journalIdMap.set(j.id, existing.id);
        } else {
          const [inserted] = await db.insert(journalEntriesTable).values({
            entryNumber: j.entryNumber,
            date: j.date,
            narration: j.narration || null,
            totalDebit: String(j.totalDebit || 0),
            totalCredit: String(j.totalCredit || 0),
            isSystem: j.isSystem || "false",
          }).returning();
          journalIdMap.set(j.id, inserted.id);
          restoredCounts.journalEntries++;
        }
      }

      if (Array.isArray(d.journalLines)) {
        for (const line of d.journalLines) {
          const newJId = journalIdMap.get(line.journalEntryId);
          if (!newJId) continue;
          const newLedgerId = line.ledgerId ? ledgerIdMap.get(line.ledgerId) || line.ledgerId : null;

          await db.insert(journalLinesTable).values({
            journalEntryId: newJId,
            ledgerId: newLedgerId,
            ledgerName: line.ledgerName,
            type: line.type,
            amount: String(line.amount || 0),
            narration: line.narration || null,
          });
        }
      }
    }

    // 13. Credit Notes & Items
    const creditNoteIdMap = new Map<number, number>();
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
          const mappedOrigInvId = cn.originalInvoiceId ? saleInvoiceIdMap.get(cn.originalInvoiceId) || null : null;

          const [inserted] = await db.insert(creditNotesTable).values({
            noteNumber: cn.noteNumber,
            originalInvoiceId: mappedOrigInvId,
            originalInvoiceNumber: cn.originalInvoiceNumber || null,
            date: cn.date,
            partyId: mappedPartyId,
            partyName: cn.partyName,
            partyGstin: cn.partyGstin || null,
            partyState: cn.partyState || null,
            isOutOfState: cn.isOutOfState || "false",
            subtotal: String(cn.subtotal || 0),
            taxAmount: String(cn.taxAmount || 0),
            totalAmount: String(cn.totalAmount || 0),
            reason: cn.reason || null,
            notes: cn.notes || null,
            otherExpenses: cn.otherExpenses ? JSON.stringify(cn.otherExpenses) : null,
            otherExpensesGstRate: cn.otherExpensesGstRate ? String(cn.otherExpensesGstRate) : null,
            otherExpensesTaxAmount: cn.otherExpensesTaxAmount ? String(cn.otherExpensesTaxAmount) : null,
            isKaccha: cn.isKaccha || false,
          }).returning();
          creditNoteIdMap.set(cn.id, inserted.id);
          restoredCounts.creditNotes++;
        }
      }

      if (Array.isArray(d.creditNoteItems)) {
        for (const item of d.creditNoteItems) {
          const newCnId = creditNoteIdMap.get(item.creditNoteId);
          if (!newCnId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;

          await db.insert(creditNoteItemsTable).values({
            creditNoteId: newCnId,
            stockItemId: newStockItemId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPercent: String(item.discountPercent || 0),
            discountAmount: String(item.discountAmount || 0),
            taxRate: String(item.taxRate || 0),
            taxAmount: String(item.taxAmount || 0),
            cgstRate: String(item.cgstRate || 0),
            cgstAmount: String(item.cgstAmount || 0),
            sgstRate: String(item.sgstRate || 0),
            sgstAmount: String(item.sgstAmount || 0),
            igstRate: String(item.igstRate || 0),
            igstAmount: String(item.igstAmount || 0),
            totalAmount: String(item.totalAmount || 0),
          });
        }
      }
    }

    // 14. Debit Notes & Items
    const debitNoteIdMap = new Map<number, number>();
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
          const mappedOrigInvId = dn.originalInvoiceId ? purchaseInvoiceIdMap.get(dn.originalInvoiceId) || null : null;

          const [inserted] = await db.insert(debitNotesTable).values({
            noteNumber: dn.noteNumber,
            originalInvoiceId: mappedOrigInvId,
            originalInvoiceNumber: dn.originalInvoiceNumber || null,
            date: dn.date,
            partyId: mappedPartyId,
            partyName: dn.partyName,
            partyGstin: dn.partyGstin || null,
            partyState: dn.partyState || null,
            isOutOfState: dn.isOutOfState || "false",
            subtotal: String(dn.subtotal || 0),
            taxAmount: String(dn.taxAmount || 0),
            totalAmount: String(dn.totalAmount || 0),
            reason: dn.reason || null,
            notes: dn.notes || null,
            otherExpenses: dn.otherExpenses ? JSON.stringify(dn.otherExpenses) : null,
            otherExpensesGstRate: dn.otherExpensesGstRate ? String(dn.otherExpensesGstRate) : null,
            otherExpensesTaxAmount: dn.otherExpensesTaxAmount ? String(dn.otherExpensesTaxAmount) : null,
          }).returning();
          debitNoteIdMap.set(dn.id, inserted.id);
          restoredCounts.debitNotes++;
        }
      }

      if (Array.isArray(d.debitNoteItems)) {
        for (const item of d.debitNoteItems) {
          const newDnId = debitNoteIdMap.get(item.debitNoteId);
          if (!newDnId) continue;
          const newStockItemId = item.stockItemId ? itemIdMap.get(item.stockItemId) || null : null;

          await db.insert(debitNoteItemsTable).values({
            debitNoteId: newDnId,
            stockItemId: newStockItemId,
            itemName: item.itemName,
            hsnCode: item.hsnCode || null,
            quantity: String(item.quantity || 1),
            unit: item.unit || "pcs",
            rate: String(item.rate || 0),
            discountPercent: String(item.discountPercent || 0),
            discountAmount: String(item.discountAmount || 0),
            taxRate: String(item.taxRate || 0),
            taxAmount: String(item.taxAmount || 0),
            cgstRate: String(item.cgstRate || 0),
            cgstAmount: String(item.cgstAmount || 0),
            sgstRate: String(item.sgstRate || 0),
            sgstAmount: String(item.sgstAmount || 0),
            igstRate: String(item.igstRate || 0),
            igstAmount: String(item.igstAmount || 0),
            totalAmount: String(item.totalAmount || 0),
          });
        }
      }
    }

    // 15. Stock Transactions
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

    // 16. Sync sequence Counters
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
