import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function checkStatus() {
  console.log("=== QR LINKS REGISTRY ===");
  const links = await db.execute(`
    SELECT id, merchant_name, status, scan_count, last_scanned_at 
    FROM qr_links 
    ORDER BY created_at ASC;
  `);
  console.table(links.rows);

  console.log("\n=== RECENT SCANS TELEMETRY (LATEST 10) ===");
  const scans = await db.execute(`
    SELECT id, link_id, ip, city, scanned_at, user_agent 
    FROM qr_scans 
    ORDER BY id DESC 
    LIMIT 10;
  `);
  console.table(scans.rows);
}

checkStatus()
  .catch(console.error)
  .finally(() => db.close());
