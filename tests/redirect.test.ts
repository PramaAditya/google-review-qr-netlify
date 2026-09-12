import { describe, it, expect } from "bun:test";
import { createClient } from "@libsql/client";
import handler from "../functions/redirect";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

describe("Google Review QR Redirect Function", () => {
  it("redirects active 'lalana' (direct mode) to Google Review URL", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/lalana", {
      headers: {
        "x-nf-client-connection-ip": "114.124.200.1",
        "x-city": "Bandung",
        "x-country": "Indonesia",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "referer": "https://camera.apple.com",
      },
    });

    const context: any = {
      params: { id: "lalana" },
      geo: { city: "Bandung", country: { name: "Indonesia" } },
    };

    const res = await handler(req, context);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Set-Cookie")).toContain("_gqr_vid=");
  });

  it("serves Reputation Shield micro-rating page for 'lalana-01' on initial scan", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/lalana-01", {
      headers: {
        "x-nf-client-connection-ip": "114.124.200.2",
        "user-agent": "Mozilla/5.0 (Android 14; Mobile)",
      },
    });

    const context: any = {
      params: { id: "lalana-01" },
    };

    const res = await handler(req, context);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Ulas Pengalaman Anda");
    expect(html).toContain("Lalana Space - Meja 1");
    expect(html).toContain("Meja 01");
    expect(html).toContain("Hubungi Manager via WhatsApp");
    expect(html).toContain("rate(5)");
    expect(html).toContain("/id/lalana-01?rate=");
  });

  it("redirects to Google Review when 5-star rating chosen on 'lalana-01'", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/lalana-01?rate=5", {
      headers: {
        "x-nf-client-connection-ip": "114.124.200.3",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      },
    });

    const context: any = {
      params: { id: "lalana-01" },
    };

    const res = await handler(req, context);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");

    // Verify rating logged
    const latestScan = await db.execute({
      sql: "SELECT rating_given, device_type FROM qr_scans WHERE link_id = 'lalana-01' AND rating_given = 5 LIMIT 1;",
      args: [],
    });
    expect(latestScan.rows.length).toBe(1);
    expect(Number(latestScan.rows[0].rating_given)).toBe(5);
    expect(latestScan.rows[0].device_type).toBe("ios");
  });

  it("logs negative rating (rate=2) via background log ping on 'lalana-01'", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/lalana-01?rate=2&log_only=1", {
      headers: {
        "user-agent": "Mozilla/5.0 (Android 14; Mobile)",
      },
    });

    const context: any = {
      params: { id: "lalana-01" },
    };

    const res = await handler(req, context);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.rating).toBe(2);

    // Verify logged in Turso
    const latestNegative = await db.execute({
      sql: "SELECT rating_given, device_type FROM qr_scans WHERE link_id = 'lalana-01' AND rating_given = 2 LIMIT 1;",
      args: [],
    });
    expect(latestNegative.rows.length).toBe(1);
    expect(Number(latestNegative.rows[0].rating_given)).toBe(2);
    expect(latestNegative.rows[0].device_type).toBe("android");
  });

  it("handles unassigned stickers gracefully with HTML status page", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/demo-unassigned");
    const context: any = { params: { id: "demo-unassigned" } };

    const res = await handler(req, context);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Stiker Belum Diaktifkan");
  });

  it("handles suspended stickers gracefully with notice", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/demo-suspended");
    const context: any = { params: { id: "demo-suspended" } };

    const res = await handler(req, context);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Stiker Nonaktif");
  });

  it("returns 404 page for nonexistent ID", async () => {
    const req = new Request("https://greview-qr.netlify.app/id/nonexistent-xyz");
    const context: any = { params: { id: "nonexistent-xyz" } };

    const res = await handler(req, context);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("QR Code Tidak Ditemukan");
  });
});
