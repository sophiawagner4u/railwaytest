const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

// ==================================================
// DATABASE CONNECTION
// TESTING ONLY - DO NOT COMMIT REAL CREDENTIALS
// TO A PUBLIC GITHUB REPOSITORY.
// ==================================================

const DATABASE_URL =
  "postgresql://postgres:cuTfDCCLBVdSwQHHZxRgaJEItcmdSNdv@postgres.railway.internal:5432/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ==================================================
// CREATE DATABASE TABLE
// ==================================================

async function createContactsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Contacts table is ready.");
  } catch (error) {
    console.error("Could not create contacts table:");
    console.error(error.message);
  }
}

// ==================================================
// TEST DATABASE CONNECTION
// ==================================================

async function testDatabase() {
  try {
    const result = await pool.query("SELECT NOW()");

    console.log("=================================");
    console.log("DATABASE CONNECTED");
    console.log("Database time:", result.rows[0].now);
    console.log("=================================");

    return true;
  } catch (error) {
    console.error("=================================");
    console.error("DATABASE CONNECTION FAILED");
    console.error(error.message);
    console.error("=================================");

    return false;
  }
}

// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "healthy",
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

// ==================================================
// CONTACT FORM
// ==================================================

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).send(`
      <h1>Missing information</h1>
      <p>Please fill in all fields.</p>
      <a href="/">Go back</a>
    `);
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO contacts (name, email, message)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [
        name.trim(),
        email.trim(),
        message.trim()
      ]
    );

    console.log("New contact saved:", result.rows[0]);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Message Sent</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f4f4;
            text-align: center;
            padding: 80px 20px;
          }

          .box {
            max-width: 500px;
            margin: auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,.1);
          }

          h1 {
            color: #16a34a;
          }

          a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 20px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 6px;
          }
        </style>
      </head>

      <body>

        <div class="box">

          <h1>Message Sent!</h1>

          <p>
            Thank you, ${escapeHtml(name)}.
          </p>

          <p>
            Your message has been saved successfully.
          </p>

          <a href="/">
            Send another message
          </a>

        </div>

      </body>
      </html>
    `);

  } catch (error) {
    console.error("Database insert failed:");
    console.error(error);

    res.status(500).send(`
      <h1>Database Error</h1>
      <p>Could not save your message.</p>
      <a href="/">Go back</a>
    `);
  }
});

// ==================================================
// VIEW SAVED MESSAGES
// TESTING ONLY
// ==================================================

app.get("/messages", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        email,
        message,
        created_at
      FROM contacts
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not retrieve messages"
    });
  }
});

// ==================================================
// HTML ESCAPE
// ==================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================================================
// START SERVER
// ==================================================

async function startServer() {

  const databaseConnected = await testDatabase();

  if (!databaseConnected) {
    console.error("Server will not start because the database is unavailable.");
    process.exit(1);
  }

  await createContactsTable();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Port: ${PORT}`);
  });
}

startServer();
