import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function checkStatus() {
  console.log("=== MERCHANTS PROFILES ===");
  const merchants = await db.execute(`
    SELECT id, name, owner_whatsapp, plan, created_at 
    FROM merchants;
  `);
  console.table(merchants.rows);

  console.log("\n=== QR LINKS REGISTRY (MULTI-TABLE READY) ===");
  const links = await db.execute(`
    SELECT id, merchant_id, table_no, zone, mode, status, scan_count, last_scanned_at 
    FROM qr_links 
    ORDER BY created_at ASC;
  `);
  console.table(links.rows);

  console.log("\n=== RATING FEEDBACK TELEMETRY ===");
  const ratings = await db.execute(`
    SELECT link_id, 
           CASE 
             WHEN rating_given IS NULL THEN 'Scan Only (No Rating)' 
             ELSE CAST(rating_given AS TEXT) || ' Bintang' 
           END as rating_label,
           COUNT(*) as total_occurrences
    FROM qr_scans 
    GROUP BY link_id, rating_given
    ORDER BY link_id, rating_given DESC;
  `);
  console.table(ratings.rows);

  console.log("\n=== RECENT SCANS TELEMETRY (LATEST 10) ===");
  const scans = await db.execute(`
    SELECT id, link_id, ip, city, device_type, 
           rating_given,
           SUBSTR(visitor_id, 1, 8) || '...' as visitor_short, 
           scanned_at 
    FROM qr_scans 
    ORDER BY id DESC 
    LIMIT 10;
  `);
  console.table(scans.rows);
}

checkStatus()
  .catch(console.error)
  .finally(() => db.close());
