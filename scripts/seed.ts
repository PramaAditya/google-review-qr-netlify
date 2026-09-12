import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
  process.exit(1);
}

const db = createClient({ url, authToken });

/**
 * Standardize Indonesian phone numbers to 08xxxxxxxxxx
 * Handles: +62 812..., 62812..., 0812..., 812...
 */
export function standardizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("62")) {
    clean = "0" + clean.slice(2);
  } else if (!clean.startsWith("0")) {
    clean = "0" + clean;
  }
  return clean;
}

async function seed() {
  console.log("Seeding test records into Turso...");

  const lalanaReviewUrl = "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg";

  // 1. Seed Sales Reps (with 4-digit PIN & standardized 08xxx username)
  console.log("\n--- Seeding Sales Representatives ---");
  const salesTeam = [
    {
      name: "Budi Santoso",
      rawPhone: "+62 812-3456-7890",
      pin: "1234",
      commission_table: 3000,
      commission_cashier: 7000,
    },
    {
      name: "Andi Wijaya",
      rawPhone: "081987654321",
      pin: "8821",
      commission_table: 3000,
      commission_cashier: 7000,
    },
  ];

  for (const s of salesTeam) {
    const stdPhone = standardizePhone(s.rawPhone);
    await db.execute({
      sql: `INSERT INTO sales_reps (id, name, phone, pin, commission_table, commission_cashier, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              phone = excluded.phone,
              pin = excluded.pin,
              commission_table = excluded.commission_table,
              commission_cashier = excluded.commission_cashier;`,
      args: [stdPhone, s.name, stdPhone, s.pin, s.commission_table, s.commission_cashier],
    });
    console.log(`Sales Rep '${s.name}' seeded -> Username (Phone): ${stdPhone}, PIN: **** (Length: ${s.pin.length})`);
  }

  // 2. Seed Merchant Profile (attributed to Budi Santoso)
  console.log("\n--- Seeding Merchant ---");
  const budiPhone = standardizePhone("+62 812-3456-7890");
  await db.execute({
    sql: `INSERT INTO merchants (id, name, owner_whatsapp, plan, default_mode, sales_rep_id)
          VALUES ('merch_lalana_space', 'Lalana Space', '+6281234567890', 'pro', 'shield', ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            owner_whatsapp = excluded.owner_whatsapp,
            plan = excluded.plan,
            default_mode = excluded.default_mode,
            sales_rep_id = excluded.sales_rep_id;`,
    args: [budiPhone],
  });
  console.log(`Merchant 'merch_lalana_space' seeded (Attributed to Sales: ${budiPhone}).`);

  // 3. Seed QR Links
  console.log("Purging legacy demo records from Turso...");
  await db.execute("DELETE FROM qr_links WHERE id NOT IN ('S-1', 'S-2', 'A-1');");
  await db.execute("DELETE FROM qr_scans;");
  await db.execute("DELETE FROM feedback_logs;");
  await db.execute("DELETE FROM sqlite_sequence WHERE name IN ('qr_scans', 'feedback_logs');");

  console.log("\n--- Seeding QR Links ---");
  const records = [
    {
      id: "S-1",
      merchant_id: "merch_lalana_space",
      sales_rep_id: budiPhone,
      batch_no: "BATCH-2026-09",
      merchant_name: "Lalana Space - Meja 1",
      table_no: "Meja 01",
      zone: "indoor",
      sticker_type: "vinyl_table",
      mode: "inherit",
      target_url: lalanaReviewUrl,
      negative_feedback_url: "https://wa.me/6281234567890?text=Halo+Manager+Lalana+Space+Saya+ada+masukan+mengenai+Meja+01",
      status: "active",
    },
    {
      id: "S-2",
      merchant_id: "merch_lalana_space",
      sales_rep_id: budiPhone,
      batch_no: "BATCH-2026-09",
      merchant_name: "Lalana Space - Meja 2",
      table_no: "Meja 02",
      zone: "outdoor",
      sticker_type: "vinyl_table",
      mode: "inherit",
      target_url: lalanaReviewUrl,
      negative_feedback_url: "https://wa.me/6281234567890?text=Halo+Manager+Lalana+Space+Saya+ada+masukan+mengenai+Meja+02",
      status: "active",
    },
    {
      id: "A-1",
      merchant_id: "merch_lalana_space",
      sales_rep_id: budiPhone,
      batch_no: "BATCH-2026-09",
      merchant_name: "Lalana Space - Kasir",
      table_no: "Kasir Utama",
      zone: "cashier",
      sticker_type: "acrylic_cashier",
      mode: "direct",
      target_url: lalanaReviewUrl,
      negative_feedback_url: "https://wa.me/6281234567890?text=Halo+Manager+Lalana+Space",
      status: "active",
    },
  ];

  for (const record of records) {
    await db.execute({
      sql: `INSERT INTO qr_links (
              id, merchant_id, sales_rep_id, batch_no, merchant_name, table_no, zone, sticker_type, mode, 
              target_url, negative_feedback_url, status, assigned_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              merchant_id = excluded.merchant_id,
              sales_rep_id = excluded.sales_rep_id,
              batch_no = excluded.batch_no,
              merchant_name = excluded.merchant_name,
              table_no = excluded.table_no,
              zone = excluded.zone,
              sticker_type = excluded.sticker_type,
              mode = excluded.mode,
              target_url = excluded.target_url,
              negative_feedback_url = excluded.negative_feedback_url,
              status = excluded.status;`,
      args: [
        record.id,
        record.merchant_id,
        record.sales_rep_id,
        record.batch_no,
        record.merchant_name,
        record.table_no,
        record.zone,
        record.sticker_type,
        record.mode,
        record.target_url,
        record.negative_feedback_url,
        record.status,
      ],
    });
    console.log(`Seeded record: ID='${record.id}' -> Type='${record.sticker_type}' -> Table='${record.table_no || "-"}' -> Status='${record.status}'`);
  }

  console.log("\nSeeding finished! All test records, merchant profile & sales team ready.");
}

seed()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
