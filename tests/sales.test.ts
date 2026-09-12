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
  it("activates loose non-sequential items from camera bulk scan (body.items)", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "081234567890",
        pin: "1234",
        merchant_name: "Test Loose Scanner Cafe",
        maps_url: "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg",
        complaint_whatsapp: "081298765432",
        mode: "shield",
        items: ["S-81", "S-12", "A-5"],
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary.table_stickers).toBe(2);
    expect(data.summary.cashier_acrylics).toBe(1);
    expect(data.summary.bill_total_idr).toBe(45000);
    expect(data.summary.commission_earned_idr).toBe(13000);

    const checkDb = await db.execute({
      sql: "SELECT id, status, sticker_type, mode FROM qr_links WHERE id IN ('S-81', 'S-12', 'A-5');",
      args: [],
    });
    expect(checkDb.rows.length).toBe(3);

    await db.execute("DELETE FROM qr_links WHERE id IN ('S-81', 'S-12', 'A-5');");
    await db.execute("DELETE FROM merchants WHERE name = 'Test Loose Scanner Cafe';");
  });
  it("checks code status via GET /api/sales/check?id=...", async () => {
    // Active code S-1
    const reqActive = new Request("https://grqrr.netlify.app/api/sales/check?id=S-1");
    const resActive = await salesHandler(reqActive, {} as any);
    expect(resActive.status).toBe(200);
    const dataActive = await resActive.json();
    expect(dataActive.exists).toBe(true);
    expect(dataActive.is_active).toBe(true);
    expect(dataActive.merchant_name).toContain("Lalana");

    // Fresh nonexistent code
    const reqFresh = new Request("https://grqrr.netlify.app/api/sales/check?id=S-9999");
    const resFresh = await salesHandler(reqFresh, {} as any);
    expect(resFresh.status).toBe(200);
    const dataFresh = await resFresh.json();
    expect(dataFresh.exists).toBe(false);
    expect(dataFresh.is_active).toBe(false);
  });

  it("strictly prevents overriding already activated QR codes with 409 Conflict", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "081234567890",
        pin: "1234",
        merchant_name: "Test Hacker Cafe",
        maps_url: "https://search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg",
        mode: "direct",
        items: ["S-1"], // S-1 is already active in Lalana Space!
      }),
    });

    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(409); // Conflict!
    const data = await res.json();
    expect(data.error).toContain("tidak dapat ditimpa");
    expect(data.conflicts).toContain("S-1");
  });
  it("resolves Google Maps URL to Place ID and direct review URL", async () => {
    const fullUrl = "https://www.google.com/maps/place/Lalana+Space/@-6.9905221,107.6614287,17z/data=!3m1!4b1!4m6!3m5!1s0x2e68e9d2a1bef62d:0x28e421c251500c38!8m2!3d-6.9905221!4d107.6640036!16s%2Fg%2F11y1zl89vx?entry=ttu";
    const req = new Request(`https://grqrr.netlify.app/api/sales/resolve-maps?url=${encodeURIComponent(fullUrl)}`);
    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.placeId).toBe("ChIJLfa-odLpaC4ROAxQUcIh5Cg");
    expect(data.data.name).toBe("Lalana Space");
    expect(data.data.directReviewUrl).toContain("placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");
  });
  it("resolves mobile Google Maps app short link (maps.app.goo.gl) and extracts place name", async () => {
    const shortUrl = "https://maps.app.goo.gl/XwVCbUhgzRmT333aA?g_st=ic";
    const req = new Request(`https://grqrr.netlify.app/api/sales/resolve-maps?url=${encodeURIComponent(shortUrl)}`);
    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.placeId).toBe("ChIJLfa-odLpaC4ROAxQUcIh5Cg");
    expect(data.data.name).toBe("Lalana Space");
    expect(data.data.address).toContain("Cikoneng");
    expect(data.data.directReviewUrl).toContain("placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");
  }, 15000);


  it("returns 422 for invalid Google Maps URL without location ID", async () => {
    const req = new Request("https://grqrr.netlify.app/api/sales/resolve-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://google.com/search?q=not-a-map" }),
    });
    const res = await salesHandler(req, {} as any);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toContain("tidak memuat ID lokasi");
  });
});
