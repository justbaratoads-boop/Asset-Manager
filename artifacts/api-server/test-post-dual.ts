const payload = {
  date: "2026-08-04",
  partyId: null,
  partyName: "Test Party",
  isGst: true,
  isInterstate: false,
  subtotal: 100,
  totalDiscount: 0,
  totalTaxable: 100,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalGst: 0,
  grandTotal: 100,
  amountPaid: 0,
  balanceDue: 100,
  items: [
    { isTaxLiability: true, stockItemId: 1, itemName: "Item 1", quantity: 1, rate: 100, taxableAmount: 100, total: 100, gstPct: 0, cgst: 0, sgst: 0, igst: 0, discountPct: 0, unit: "pcs" }, 
    { isTaxLiability: false, stockItemId: 1, itemName: "Item 2", quantity: 1, rate: 200, taxableAmount: 200, total: 200, gstPct: 0, cgst: 0, sgst: 0, igst: 0, discountPct: 0, unit: "pcs" }
  ],
  payments: [],
  otherCharges: "[]"
};

async function run() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoiNjU2NTVAaCIsInJvbGUiOiJzYWxlc19zdGFmZiIsImJ1c2luZXNzSWQiOjEsImlhdCI6MTc4NTgzNzMwOSwiZXhwIjoxNzg4NDI5MzA5fQ.kld-c6OzewRLGdwDMKPCYkXz_V-L0NLrzBvUQw9NrcY";
  const res = await fetch("http://localhost:3000/api/sale-invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}
run();
