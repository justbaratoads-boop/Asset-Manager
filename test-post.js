const http = require('http');

const payload = JSON.stringify({
  date: "2026-08-04",
  partyId: 1,
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
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sale-invoices',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    // Bypass auth or just send a dummy token if authMiddleware doesn't strictly verify it
    'Authorization': 'Bearer test'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', (e) => console.error(e));
req.write(payload);
req.end();
