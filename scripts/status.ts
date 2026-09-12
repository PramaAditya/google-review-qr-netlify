import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function checkStatus() {
  console.log("=== APP SETTINGS & PRICING ===");
  const settings = await db.execute(`
    SELECT key as setting_key, value as setting_value, description 
    FROM app_settings 
    ORDER BY key ASC;
  `);
  console.table(settings.rows);

  console.log("=== SALES REPRESENTATIVES ROSTER ===");
  const sales = await db.execute(`
    SELECT id as username_phone, name, pin, 
           'Rp ' || commission_table as komisi_meja, 
           'Rp ' || commission_cashier as komisi_kasir, 
           status, created_at 
    FROM sales_reps;
  `);
  console.table(sales.rows);

  console.log("\n=== SALES ATTRIBUTION & COMMISSION CALCULATION ===");
  const commissions = await db.execute(`
    SELECT 
      s.name as nama_sales,
      s.phone as login_phone,
      COUNT(DISTINCT m.id) as total_merchants,
      COUNT(CASE WHEN l.sticker_type = 'vinyl_table' THEN 1 END) as stiker_meja_terpasang,
      COUNT(CASE WHEN l.sticker_type = 'acrylic_cashier' THEN 1 END) as akrilik_kasir_terpasang,
      (COUNT(CASE WHEN l.sticker_type = 'vinyl_table' THEN 1 END) * s.commission_table) +
      (COUNT(CASE WHEN l.sticker_type = 'acrylic_cashier' THEN 1 END) * s.commission_cashier) as total_komisi_rp
    FROM sales_reps s
    LEFT JOIN merchants m ON s.id = m.sales_rep_id
    LEFT JOIN qr_links l ON m.id = l.merchant_id AND l.status = 'active'
    GROUP BY s.id;
  `);
  console.table(commissions.rows);

  console.log("\n=== MERCHANTS PROFILES ===");
  const merchants = await db.execute(`
    SELECT m.id, m.name, m.owner_whatsapp, m.plan, m.default_mode, s.name as sales_rep 
    FROM merchants m
    LEFT JOIN sales_reps s ON m.sales_rep_id = s.id;
  `);
  console.table(merchants.rows);

  console.log("\n=== QR LINKS REGISTRY (MULTI-TABLE READY) ===");
  const links = await db.execute(`
    SELECT l.id, l.merchant_id, l.table_no, l.zone, l.sticker_type, l.mode, 
           COALESCE(NULLIF(l.mode, 'inherit'), m.default_mode, 'direct') as effective_mode,
           l.status, l.scan_count, l.last_scanned_at 
    FROM qr_links l
    LEFT JOIN merchants m ON l.merchant_id = m.id
    ORDER BY l.created_at ASC;
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
