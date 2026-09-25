const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});

app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).send("Please fill in all fields.");
  }

  console.log("New contact form submission:");
  console.log({
    name,
    email,
    message
  });

  res.send(`
    <h1>Thank you, ${name}!</h1>
    <p>Your message has been received.</p>
    <a href="/">Send another message</a>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
