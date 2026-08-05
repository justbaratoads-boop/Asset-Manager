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
  items: [{
    stockItemId: 1,
    itemName: "Test Item",
    hsnCode: "1234",
    quantity: 1,
    unit: "pcs",
    rate: 100,
    discountPct: 0,
    gstPct: 0,
    taxableAmount: 100,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 100,
    isTaxLiability: true
  }],
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
