const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

// ------------------------------------
// PostgreSQL connection
// ------------------------------------

console.log("DATABASE_URL exists:", Boolean(process.env.DATABASE_URL));
console.log("DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ------------------------------------
// Middleware
// ------------------------------------

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------
// Test database connection
// ------------------------------------

async function testDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("Database connected successfully.");
    console.log("Database time:", result.rows[0].now);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error.message);
  }
}

// ------------------------------------
// Create contacts table
// ------------------------------------

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

// ------------------------------------
// Health check
// ------------------------------------

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
      database: "disconnected"
    });
  }
});

// ------------------------------------
// Submit contact form
// ------------------------------------

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <h1>Missing information</h1>
        <p>Please fill in all fields.</p>
        <a href="/">Go back</a>
      </body>
      </html>
    `);
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO contacts (name, email, message)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [name.trim(), email.trim(), message.trim()]
    );

    console.log("New contact message saved:");
    console.log({
      id: result.rows[0].id,
      name,
      email
    });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message Sent</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f4f4;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }

          .box {
            background: white;
            padding: 40px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            max-width: 450px;
          }

          h1 {
            color: #16a34a;
          }

          a {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
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
            Your message has been successfully saved.
          </p>

          <a href="/">Send another message</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Failed to save contact message:");
    console.error(error);

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
      </head>

      <body>
        <h1>Something went wrong</h1>
        <p>We couldn't save your message. Please try again later.</p>
        <a href="/">Go back</a>
      </body>
      </html>
    `);
  }
});

// ------------------------------------
// View saved messages
// ------------------------------------
// This is useful for testing.
// Do NOT leave this publicly accessible
// in a real production application.
// ------------------------------------

app.get("/messages", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, message, created_at
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

// ------------------------------------
// Simple HTML escaping
// ------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------
// Start server
// ------------------------------------

async function startServer() {
  await testDatabaseConnection();
  await createContactsTable();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
