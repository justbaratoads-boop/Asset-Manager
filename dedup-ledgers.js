const { db } = require('./artifacts/api-server/dist/db');
const { ledgersTable, journalLinesTable, paymentsTable, receiptsTable, saleInvoicesTable, purchaseInvoicesTable } = require('./lib/db/dist/schema');
const { eq, and, sql } = require('drizzle-orm');

async function deduplicate() {
  const ledgers = await db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
  const systemLedgers = ledgers.filter(l => l.isSystem === "true");

  const byName = {};
  for (const l of systemLedgers) {
    if (!byName[l.name]) byName[l.name] = [];
    byName[l.name].push(l);
  }

  for (const name in byName) {
    const list = byName[name];
    if (list.length > 1) {
      list.sort((a, b) => a.id - b.id);
      const keep = list[0];
      const remove = list.slice(1);

      console.log(`Keeping ${name} (id ${keep.id}), removing:`, remove.map(r => r.id));

      for (const r of remove) {
        // Update journal lines
        await db.update(journalLinesTable)
          .set({ ledgerId: keep.id })
          .where(eq(journalLinesTable.ledgerId, r.id));

        // Update payments
        await db.update(paymentsTable)
          .set({ ledgerId: keep.id })
          .where(eq(paymentsTable.ledgerId, r.id));

        // Update receipts
        await db.update(receiptsTable)
          .set({ ledgerId: keep.id })
          .where(eq(receiptsTable.ledgerId, r.id));

        // Note: we don't bother parsing JSON in otherCharges because users rarely select CGST in other charges,
        // and if they did, we can't easily update it in pure SQL here without pulling all rows. Let's just do a quick pull just in case.
        const sales = await db.select({ id: saleInvoicesTable.id, otherCharges: saleInvoicesTable.otherCharges }).from(saleInvoicesTable);
        for (const s of sales) {
          if (s.otherCharges) {
            try {
              let changed = false;
              const charges = JSON.parse(s.otherCharges);
              for (const c of charges) {
                if (c.ledgerId === r.id) {
                  c.ledgerId = keep.id;
                  changed = true;
                }
              }
              if (changed) {
                await db.update(saleInvoicesTable).set({ otherCharges: JSON.stringify(charges) }).where(eq(saleInvoicesTable.id, s.id));
              }
            } catch(e) {}
          }
        }

        const purch = await db.select({ id: purchaseInvoicesTable.id, otherCharges: purchaseInvoicesTable.otherCharges }).from(purchaseInvoicesTable);
        for (const p of purch) {
          if (p.otherCharges) {
            try {
              let changed = false;
              const charges = JSON.parse(p.otherCharges);
              for (const c of charges) {
                if (c.ledgerId === r.id) {
                  c.ledgerId = keep.id;
                  changed = true;
                }
              }
              if (changed) {
                await db.update(purchaseInvoicesTable).set({ otherCharges: JSON.stringify(charges) }).where(eq(purchaseInvoicesTable.id, p.id));
              }
            } catch(e) {}
          }
        }

        // Hard delete the duplicate system ledger
        await db.delete(ledgersTable).where(eq(ledgersTable.id, r.id));
        console.log(`Deleted duplicate ledger ${name} (id ${r.id})`);
      }
    }
  }
  console.log("Deduplication complete.");
  process.exit(0);
}

deduplicate().catch(console.error);
