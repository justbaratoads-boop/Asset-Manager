const jwt = require("jsonwebtoken");
const JWT_SECRET = "dev-secret-fallback";
const token = jwt.sign({ userId: 1, email: "test@test.com", role: "admin", businessId: 1 }, JWT_SECRET, { expiresIn: "30d" });

const payload = {
  date: "2026-08-03",
  partyName: "test",
  isGst: true,
  isInterstate: false,
  subtotal: 2252.85,
  totalDiscount: 0,
  totalTaxable: 2252.85,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalGst: 0,
  grandTotal: 2252.85,
  amountPaid: 0,
  balanceDue: 2252.85,
  kacchaAmountPaid: 0,
  kacchaBalanceDue: 0,
  items: [
    {
      itemName: "Hero Activa",
      unit: "bag",
      quantity: ".",
      rate: 4,
      discountPct: 0,
      gstPct: 0,
      taxableAmount: 2019.6,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 2019.6
    },
    {
      itemName: "bura",
      unit: "kg",
      quantity: 233.25,
      rate: 1,
      discountPct: 0,
      gstPct: 0,
      taxableAmount: 233.25,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 233.25
    }
  ],
  payments: [],
  kacchaPayments: [],
  otherCharges: null
};

fetch("http://localhost:3000/api/sale-invoices", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify(payload)
}).then(res => res.text()).then(console.log).catch(console.error);
