const express = require('express');
const app = express();
app.use((req, res) => {
  res.sendFile(__dirname + "/does-not-exist.html");
});
const server = app.listen(0, async () => {
  const port = server.address().port;
  const fetch = require('node-fetch');
  const response = await fetch(`http://localhost:${port}/`);
  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Body:", text);
  server.close();
});
