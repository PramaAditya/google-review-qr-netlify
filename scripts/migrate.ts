import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function getExistingColumns(tableName: string): Promise<Set<string>> {
  const info = await db.execute(`PRAGMA table_info(${tableName});`);
  return new Set(info.rows.map((row) => String(row.name)));
}

async function addColumnIfNotExists(tableName: string, colName: string, colDef: string) {
  const cols = await getExistingColumns(tableName);
  if (!cols.has(colName)) {
    console.log(`Adding column '${colName}' to table '${tableName}'...`);
    await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};`);
  } else {
    console.log(`Column '${colName}' already exists in '${tableName}'.`);
  }
}

async function migrate() {
  console.log("Connecting to Turso database...");
  console.log(`Endpoint: ${url}`);

  // 1. Create Core Tables
  console.log("\n--- Creating / Verifying Tables ---");
  await db.batch([
    `CREATE TABLE IF NOT EXISTS qr_links (
      id TEXT PRIMARY KEY,
      batch_no TEXT,
      merchant_name TEXT,
      target_url TEXT,
      scan_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unassigned',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      assigned_at DATETIME,
      last_scanned_at DATETIME
    );`,
    `CREATE TABLE IF NOT EXISTS qr_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id TEXT NOT NULL,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip TEXT,
      city TEXT,
      country TEXT,
      user_agent TEXT,
      referer TEXT,
      FOREIGN KEY (link_id) REFERENCES qr_links(id)
    );`,
    `CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_whatsapp TEXT,
      plan TEXT DEFAULT 'free',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS feedback_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id TEXT NOT NULL,
      link_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      customer_contact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (link_id) REFERENCES qr_links(id)
    );`,
    `CREATE TABLE IF NOT EXISTS sales_reps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      commission_table INTEGER DEFAULT 3000,
      commission_cashier INTEGER DEFAULT 7000,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );`,
  ]);

  // 1.1 Add default_mode to merchants
  console.log("\n--- Expanding 'merchants' Columns ---");
  await addColumnIfNotExists("merchants", "default_mode", "TEXT DEFAULT 'direct'");

  await addColumnIfNotExists("merchants", "sales_rep_id", "TEXT");
  // 2. Expand qr_links columns for B2B SaaS
  console.log("\n--- Expanding 'qr_links' Columns ---");
  await addColumnIfNotExists("qr_links", "merchant_id", "TEXT");
  await addColumnIfNotExists("qr_links", "table_no", "TEXT");
  await addColumnIfNotExists("qr_links", "zone", "TEXT DEFAULT 'indoor'");
  await addColumnIfNotExists("qr_links", "mode", "TEXT DEFAULT 'direct'");
  await addColumnIfNotExists("qr_links", "negative_feedback_url", "TEXT");

  await addColumnIfNotExists("qr_links", "sales_rep_id", "TEXT");
  await addColumnIfNotExists("qr_links", "sticker_type", "TEXT DEFAULT 'vinyl_table'");
  // 3. Expand qr_scans columns for Advanced Telemetry
  console.log("\n--- Expanding 'qr_scans' Columns ---");
  await addColumnIfNotExists("qr_scans", "visitor_id", "TEXT");
  await addColumnIfNotExists("qr_scans", "device_type", "TEXT");
  await addColumnIfNotExists("qr_scans", "rating_given", "INTEGER");

  // 4. Create Indexes
  console.log("\n--- Creating / Verifying Indexes ---");
  await db.batch([
    `CREATE INDEX IF NOT EXISTS idx_qr_links_status ON qr_links(status);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_links_merchant ON qr_links(merchant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_scans_link_id ON qr_scans(link_id);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans(scanned_at);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_scans_visitor ON qr_scans(visitor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_feedback_logs_merchant ON feedback_logs(merchant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_merchants_sales_rep ON merchants(sales_rep_id);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_links_sales_rep ON qr_links(sales_rep_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sales_reps_phone ON sales_reps(phone);`,
  ]);

  console.log("\nMigration completed successfully! All tables, columns, and indexes are ready.");
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
