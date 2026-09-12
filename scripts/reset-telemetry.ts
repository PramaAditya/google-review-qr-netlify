import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function resetTelemetry() {
  console.log("Resetting all telemetry and scan records in Turso...");

  await db.batch([
    // Reset scan counters
    `UPDATE qr_links SET scan_count = 0, last_scanned_at = NULL;`,
    // Delete all scan records and feedback logs
    `DELETE FROM qr_scans;`,
    `DELETE FROM feedback_logs;`,
    // Reset autoincrement sequence
    `DELETE FROM sqlite_sequence WHERE name IN ('qr_scans', 'feedback_logs');`,
  ]);

  console.log("Telemetry has been completely reset to 0!");
}

resetTelemetry()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
