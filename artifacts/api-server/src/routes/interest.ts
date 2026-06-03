import { Router } from "express";
import { db } from "@workspace/db";
import { partiesTable, transactionsTable } from "@workspace/db/schema";
import { eq, and, lte, asc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/reports/interest-calculation", authMiddleware, async (req, res) => {
  try {
    const { from, to, partyId } = req.query;
    if (!partyId) return res.status(400).json({ error: "partyId is required" });

    const pId = Number(partyId);
    
    // Fetch party to get interest settings
    const [party] = await db.select().from(partiesTable).where(eq(partiesTable.id, pId)).limit(1);
    if (!party) return res.status(404).json({ error: "Party not found" });

    if (party.interestEnabled !== "true" && party.interestEnabled !== true as any) {
      return res.status(400).json({ error: "Interest calculation is not enabled for this party" });
    }

    const rate = Number(party.interestRate) || 0;
    const graceDays = Number(party.interestGracePeriod) || 0;
    const byTransaction = party.interestByTransaction === "true" || party.interestByTransaction === true as any;

    const fromDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 3, 1);
    const toDate = to ? new Date(to as string) : new Date();
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Fetch transactions
    const txns = await db.select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.partyId, pId),
          eq(transactionsTable.isDeleted, "false"),
          lte(transactionsTable.date, toDate)
        )
      )
      .orderBy(asc(transactionsTable.date));

    let calculationLines = [];
    let totalInterest = 0;

    if (byTransaction) {
      // Calculate transaction by transaction
      // Simplification: Calculate interest on each Debit transaction (Sales) that is not fully paid.
      // Or in a simpler way: calculate interest on each transaction individually up to toDate or payment date.
      // For a truly robust transaction-by-transaction, we'd match payments to invoices.
      // As a basic version: we treat each debit as an invoice, and credits reduce the oldest debits (FIFO).
      
      let debits = txns.filter(t => t.type === "dr").map(t => ({ ...t, amountLeft: Number(t.amount) }));
      let credits = txns.filter(t => t.type === "cr");
      
      for (const cr of credits) {
        let crAmount = Number(cr.amount);
        for (const dr of debits) {
          if (crAmount <= 0) break;
          if (dr.amountLeft > 0) {
            const deduct = Math.min(dr.amountLeft, crAmount);
            dr.amountLeft -= deduct;
            crAmount -= deduct;
          }
        }
      }

      for (const dr of debits) {
        if (dr.amountLeft > 0) {
          const txDate = new Date(dr.date);
          const startDate = new Date(txDate);
          startDate.setDate(startDate.getDate() + graceDays);
          
          if (startDate < toDate) {
            const msDiff = toDate.getTime() - startDate.getTime();
            const days = Math.floor(msDiff / (1000 * 60 * 60 * 24));
            if (days > 0) {
              const interest = (dr.amountLeft * rate * days) / (365 * 100);
              totalInterest += interest;
              
              calculationLines.push({
                date: dr.date,
                particulars: dr.particulars || dr.voucherType,
                amount: dr.amountLeft,
                drCr: "Dr",
                days,
                interestAmount: interest
              });
            }
          }
        }
      }
    } else {
      // Running balance calculation
      // Calculate daily balance from start of history to toDate
      
      // Group transactions by date
      const txByDate: Record<string, number> = {};
      let runningBalance = Number(party.openingBalance) || 0;
      if (party.balanceType === "cr") runningBalance = -runningBalance;

      for (const t of txns) {
        const dStr = t.date.toISOString().split("T")[0];
        if (!txByDate[dStr]) txByDate[dStr] = 0;
        txByDate[dStr] += t.type === "dr" ? Number(t.amount) : -Number(t.amount);
      }
      
      // We need to trace balance day by day from fromDate to toDate
      // First, get balance right before fromDate
      let currentDate = new Date(txns.length > 0 ? txns[0].date : fromDate);
      if (currentDate > fromDate) currentDate = new Date(fromDate);
      
      let balance = runningBalance; // At the very beginning (opening balance)
      
      while (currentDate <= toDate) {
        const dStr = currentDate.toISOString().split("T")[0];
        if (txByDate[dStr]) {
          balance += txByDate[dStr];
        }
        
        if (currentDate >= fromDate) {
           // Apply grace period conceptually? For running balance, grace period usually implies we ignore balance that's newer than grace period. 
           // For simplicity in running balance, we just apply interest on the current daily balance if it's > 0 (Debit balance).
           if (balance > 0) {
             const interest = (balance * rate * 1) / (365 * 100);
             totalInterest += interest;
             
             // We can group lines by month or just show changes.
             // To avoid thousands of lines, we group into ranges where balance was constant
             const lastLine = calculationLines[calculationLines.length - 1];
             if (lastLine && lastLine.amount === balance) {
               lastLine.days += 1;
               lastLine.interestAmount += interest;
               lastLine.toDate = dStr;
             } else {
               calculationLines.push({
                 fromDate: dStr,
                 toDate: dStr,
                 particulars: "Running Balance",
                 amount: balance,
                 drCr: "Dr",
                 days: 1,
                 interestAmount: interest
               });
             }
           }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const roundedInterest = Math.round(totalInterest);

    res.json({
      party: {
        id: party.id,
        name: party.name,
        interestEnabled: party.interestEnabled,
        interestRate: rate,
        interestGracePeriod: graceDays,
        interestByTransaction: byTransaction
      },
      calculationLines,
      totalInterest: roundedInterest,
      rawInterest: totalInterest,
      fromDate,
      toDate
    });
  } catch (err: any) {
    console.error("Interest calculation error:", err);
    res.status(500).json({ error: "Failed to calculate interest" });
  }
});

export default router;
