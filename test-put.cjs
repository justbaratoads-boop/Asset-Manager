const { pool } = require('pg');
fetch('http://localhost:3000/api/sale-invoices/12', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + 'dummy' }, // I don't have a token
})
