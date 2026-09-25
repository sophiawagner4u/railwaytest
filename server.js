const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse form data
app.use(express.urlencoded({ extended: true }));

// Serve HTML/CSS files
app.use(express.static(path.join(__dirname, "public")));

// Handle contact form
app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).send(`
      <h1>Error</h1>
      <p>Please fill in all fields.</p>
      <a href="/">Go back</a>
    `);
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
