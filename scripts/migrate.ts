import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function migrate() {
  console.log("Connecting to Turso database...");
  console.log(`Endpoint: ${url}`);

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
    `CREATE INDEX IF NOT EXISTS idx_qr_links_status ON qr_links(status);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_scans_link_id ON qr_scans(link_id);`,
    `CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans(scanned_at);`,
  ]);

  console.log("Migration completed successfully! Tables and indexes are ready.");
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
