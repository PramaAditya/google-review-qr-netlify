import { describe, it, expect, afterAll } from "bun:test";
import { createClient } from "@libsql/client";
import salesHandler from "../functions/sales";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

describe("Sales PWA Backend APIs", () => {
  afterAll(async () => {
    // Clean up test activated items
    await db.execute("DELETE FROM qr_links WHERE id IN ('S-50', 'S-51', 'S-52', 'A-10');");
    await db.execute("DELETE FROM merchants WHERE id LIKE 'merch_test_pwa_%';");
    await db.execute("DELETE FROM qr_scans;");
    await db.execute("UPDATE qr_links SET scan_count = 0, last_scanned_at = NULL;");
  });

  it("authenticates sales rep with standardized phone and 4-digit PIN", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+62 812-3456-7890", // Raw phone format
        pin: "1234",
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.salesRep.name).toBe("Budi Santoso");
    expect(data.salesRep.phone).toBe("081234567890");
    expect(data.pricing.price_vinyl_table).toBe(10000);
    expect(data.pricing.price_acrylic_cashier).toBe(25000);
  });

  it("rejects login with incorrect PIN", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "081234567890",
        pin: "9999", // Wrong PIN
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("salah");
  });

  it("activates ranges of stickers and acrylics via POST /api/sales/activate", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "081234567890",
        pin: "1234",
        merchant_name: "Test PWA Cafe",
        maps_url: "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg",
        complaint_whatsapp: "081298765432",
        business_whatsapp: "081298765432",
        mode: "shield",
        table_start: 50,
        table_end: 52, // S-50, S-51, S-52 = 3 tables
        cashier_start: 10,
        cashier_end: 10, // A-10 = 1 cashier
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary.table_stickers).toBe(3);
    expect(data.summary.cashier_acrylics).toBe(1);
    // Bill: 3x10000 + 1x25000 = 55000
    expect(data.summary.bill_total_idr).toBe(55000);
    // Commission: 3x3000 + 1x7000 = 16000
    expect(data.summary.commission_earned_idr).toBe(16000);

    // Verify in Turso database
    const checkDb = await db.execute({
      sql: "SELECT id, status, sticker_type, mode FROM qr_links WHERE id IN ('S-50', 'S-51', 'S-52', 'A-10');",
      args: [],
    });
    expect(checkDb.rows.length).toBe(4);
    for (const row of checkDb.rows) {
      expect(row.status).toBe("active");
    }
  });
  it("rejects activation if mode is shield and complaint_whatsapp is missing", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "081234567890",
        pin: "1234",
        merchant_name: "Test No WA Cafe",
        maps_url: "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg",
        mode: "shield",
        table_start: 90,
        table_end: 91,
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Penanganan Komplain");
  });

  it("allows activation without complaint_whatsapp if mode is direct", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "081234567890",
        pin: "1234",
        merchant_name: "Test Direct Cafe",
        maps_url: "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg",
        mode: "direct",
        cashier_start: 99,
        cashier_end: 99,
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(200);

    // Cleanup
    await db.execute("DELETE FROM qr_links WHERE id = 'A-99';");
    await db.execute("DELETE FROM merchants WHERE name = 'Test Direct Cafe';");
  });
});
