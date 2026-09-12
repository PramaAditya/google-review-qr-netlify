import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function seed() {
  console.log("Seeding test records into Turso...");

  const lalanaReviewUrl = "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg";

  // 1. Seed Merchant Profile
  console.log("\n--- Seeding Merchant ---");
  await db.execute({
    sql: `INSERT INTO merchants (id, name, owner_whatsapp, plan, default_mode)
          VALUES ('merch_lalana_space', 'Lalana Space', '+6281234567890', 'pro', 'shield')
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            owner_whatsapp = excluded.owner_whatsapp,
            plan = excluded.plan,
            default_mode = excluded.default_mode;`,
    args: [],
  });
  console.log("Merchant 'merch_lalana_space' seeded.");

  // 2. Seed QR Links
  console.log("\n--- Seeding QR Links ---");
  const records = [
    {
      id: "lalana",
      merchant_id: "merch_lalana_space",
      batch_no: "BATCH-TEST-01",
      merchant_name: "Lalana Space (Direct Test)",
      table_no: "Kasir / Bar Utama",
      zone: "indoor",
      mode: "direct",
      target_url: lalanaReviewUrl,
      negative_feedback_url: "https://wa.me/6281234567890?text=Halo+Manager+Lalana+Space",
      status: "active",
    },
    {
      id: "lalana-01",
      merchant_id: "merch_lalana_space",
      batch_no: "BATCH-2026-09",
      merchant_name: "Lalana Space - Meja 1",
      table_no: "Meja 01",
      zone: "outdoor",
      mode: "inherit",
      target_url: lalanaReviewUrl,
      negative_feedback_url: "https://wa.me/6281234567890?text=Halo+Manager+Lalana+Space",
      status: "active",
    },
    {
      id: "demo-unassigned",
      merchant_id: null,
      batch_no: "BATCH-2026-09",
      merchant_name: null,
      table_no: null,
      zone: "indoor",
      mode: "direct",
      target_url: null,
      negative_feedback_url: null,
      status: "unassigned",
    },
    {
      id: "demo-suspended",
      merchant_id: null,
      batch_no: "BATCH-TEST-01",
      merchant_name: "Sample Merchant (Suspended)",
      table_no: "Meja VIP",
      zone: "indoor",
      mode: "direct",
      target_url: lalanaReviewUrl,
      negative_feedback_url: null,
      status: "suspended",
    },
  ];

  for (const record of records) {
    await db.execute({
      sql: `INSERT INTO qr_links (
              id, merchant_id, batch_no, merchant_name, table_no, zone, mode, 
              target_url, negative_feedback_url, status, assigned_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              merchant_id = excluded.merchant_id,
              batch_no = excluded.batch_no,
              merchant_name = excluded.merchant_name,
              table_no = excluded.table_no,
              zone = excluded.zone,
              mode = excluded.mode,
              target_url = excluded.target_url,
              negative_feedback_url = excluded.negative_feedback_url,
              status = excluded.status;`,
      args: [
        record.id,
        record.merchant_id,
        record.batch_no,
        record.merchant_name,
        record.table_no,
        record.zone,
        record.mode,
        record.target_url,
        record.negative_feedback_url,
        record.status,
      ],
    });
    console.log(`Seeded record: ID='${record.id}' -> Table='${record.table_no || "-"}' -> Status='${record.status}'`);
  }

  console.log("\nSeeding finished! All test records & merchant profile ready.");
}

seed()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
