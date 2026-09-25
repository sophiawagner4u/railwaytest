const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

// Railway provides PORT automatically
const PORT = process.env.PORT || 3000;

// ============================================================
// DATABASE CONFIGURATION
// ============================================================

console.log("========================================");
console.log("DATABASE CONFIGURATION");
console.log("========================================");

console.log(
  "DATABASE_URL exists:",
  Boolean(process.env.DATABASE_URL)
);

console.log(
  "DATABASE_URL length:",
  process.env.DATABASE_URL
    ? process.env.DATABASE_URL.length
    : 0
);

console.log(
  "Railway environment:",
  process.env.RAILWAY_ENVIRONMENT_NAME || "unknown"
);

console.log(
  "Railway service:",
  process.env.RAILWAY_SERVICE_NAME || "unknown"
);

console.log("========================================");

// Stop if Railway did not provide DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not available.");
  console.error(
    "Add DATABASE_URL to the VARIABLES of this Node.js service."
  );

  process.exit(1);
}

// ============================================================
// POSTGRESQL CONNECTION
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  },

  // Don't wait forever if the database connection is wrong
  connectionTimeoutMillis: 10000
});

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  express.static(path.join(__dirname, "public"))
);

// ============================================================
// DATABASE TEST
// ============================================================

async function testDatabaseConnection() {
  console.log("Testing PostgreSQL connection...");

  try {
    const result = await pool.query("SELECT NOW()");

    console.log("========================================");
    console.log("DATABASE CONNECTED SUCCESSFULLY");
    console.log("Database time:", result.rows[0].now);
    console.log("========================================");

    return true;

  } catch (error) {

    console.error("========================================");
    console.error("DATABASE CONNECTION FAILED");
    console.error("Error:", error.message);
    console.error("========================================");

    return false;
  }
}

// ============================================================
// CREATE CONTACTS TABLE
// ============================================================

async function createContactsTable() {
  console.log("Checking contacts table...");

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

    console.error(
      "Could not create contacts table:"
    );

    console.error(error.message);

    throw error;
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT NOW()"
    );

    res.status(200).json({
      status: "healthy",
      database: "connected",
      time: result.rows[0].now
    });

  } catch (error) {

    console.error(
      "Health check database error:",
      error.message
    );

    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

// ============================================================
// CONTACT FORM
// ============================================================

app.post("/contact", async (req, res) => {

  const {
    name,
    email,
    message
  } = req.body;

  // ----------------------------------------
  // Validate input
  // ----------------------------------------

  if (
    !name ||
    !email ||
    !message
  ) {

    return res.status(400).send(`
      <!DOCTYPE html>

      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error</title>
      </head>

      <body>

        <h1>Missing information</h1>

        <p>
          Please fill in all fields.
        </p>

        <a href="/">
          Go back
        </a>

      </body>
      </html>
    `);
  }

  // ----------------------------------------
  // Clean input
  // ----------------------------------------

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim();
  const cleanMessage = String(message).trim();

  // ----------------------------------------
  // Save to PostgreSQL
  // ----------------------------------------

  try {

    const result = await pool.query(
      `
      INSERT INTO contacts
      (
        name,
        email,
        message
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      RETURNING id, created_at
      `,
      [
        cleanName,
        cleanEmail,
        cleanMessage
      ]
    );

    console.log(
      "New contact message saved."
    );

    console.log(
      "Contact ID:",
      result.rows[0].id
    );

    // --------------------------------------
    // Success page
    // --------------------------------------

    res.send(`
      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

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

            border-radius: 12px;

            text-align: center;

            max-width: 450px;

            box-shadow:
              0 4px 20px
              rgba(0, 0, 0, 0.1);
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

          a:hover {
            background: #1d4ed8;
          }

        </style>

      </head>

      <body>

        <div class="box">

          <h1>
            Message Sent!
          </h1>

          <p>
            Thank you,
            ${escapeHtml(cleanName)}.
          </p>

          <p>
            Your message was saved successfully.
          </p>

          <a href="/">
            Send another message
          </a>

        </div>

      </body>

      </html>
    `);

  } catch (error) {

    console.error(
      "Failed to save contact:"
    );

    console.error(
      error.message
    );

    res.status(500).send(`
      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>Database Error</title>

      </head>

      <body>

        <h1>
          Database Error
        </h1>

        <p>
          Your message could not be saved.
        </p>

        <a href="/">
          Go back
        </a>

      </body>

      </html>
    `);
  }
});

// ============================================================
// VIEW CONTACTS
// TESTING ONLY
// ============================================================

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

    console.error(
      "Could not retrieve messages:",
      error.message
    );

    res.status(500).json({
      error: "Could not retrieve messages"
    });
  }
});

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );
}

// ============================================================
// START APPLICATION
// ============================================================

async function startServer() {

  console.log("");
  console.log("Starting application...");
  console.log("");

  // ----------------------------------------
  // Test database
  // ----------------------------------------

  const databaseConnected =
    await testDatabaseConnection();

  if (!databaseConnected) {

    console.error(
      "Application cannot continue."
    );

    console.error(
      "PostgreSQL connection failed."
    );

    process.exit(1);
  }

  // ----------------------------------------
  // Create table
  // ----------------------------------------

  try {

    await createContactsTable();

  } catch (error) {

    console.error(
      "Application cannot continue because"
    );

    console.error(
      "the contacts table could not be created."
    );

    process.exit(1);
  }

  // ----------------------------------------
  // Start Express
  // ----------------------------------------

  app.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log("");
      console.log("========================================");
      console.log("APPLICATION STARTED");
      console.log("========================================");
      console.log(
        `Server listening on port ${PORT}`
      );
      console.log("========================================");
      console.log("");
    }
  );
}

// ============================================================
// RUN
// ============================================================

startServer();
