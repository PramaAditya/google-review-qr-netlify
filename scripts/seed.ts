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

  const records = [
    {
      id: "lalana",
      batch_no: "BATCH-TEST-01",
      merchant_name: "Lalana Space (Direct Test)",
      target_url: lalanaReviewUrl,
      status: "active",
    },
    {
      id: "lalana-01",
      batch_no: "BATCH-2026-09",
      merchant_name: "Lalana Space - Meja 1",
      target_url: lalanaReviewUrl,
      status: "active",
    },
    {
      id: "demo-unassigned",
      batch_no: "BATCH-2026-09",
      merchant_name: null,
      target_url: null,
      status: "unassigned",
    },
    {
      id: "demo-suspended",
      batch_no: "BATCH-TEST-01",
      merchant_name: "Sample Merchant (Suspended)",
      target_url: lalanaReviewUrl,
      status: "suspended",
    },
  ];

  for (const record of records) {
    await db.execute({
      sql: `INSERT INTO qr_links (id, batch_no, merchant_name, target_url, status, assigned_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              merchant_name = excluded.merchant_name,
              target_url = excluded.target_url,
              status = excluded.status,
              batch_no = excluded.batch_no;`,
      args: [record.id, record.batch_no, record.merchant_name, record.target_url, record.status],
    });
    console.log(`Seeded record: ID='${record.id}' -> Status='${record.status}'`);
  }

  console.log("\nSeeding finished! Test records ready.");
}

seed()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
