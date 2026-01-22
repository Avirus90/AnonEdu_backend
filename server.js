const express = require("express");
const app = express();

// simple route
app.get("/", (req, res) => {
  res.send("Server chal raha hai 🚀");
});

// server start
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
