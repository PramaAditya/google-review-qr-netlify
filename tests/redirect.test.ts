import { describe, it, expect } from "bun:test";
import { createClient } from "@libsql/client";
import handler, { normalizeQrId } from "../functions/redirect";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

describe("Google Review QR Redirect Function (Canonical S-[N] and A-[N])", () => {
  it("normalizes various input formats correctly", () => {
    // Stiker Meja: S-[N]
    expect(normalizeQrId("S-1")).toBe("S-1");
    expect(normalizeQrId("S-0001")).toBe("S-1");
    expect(normalizeQrId("s-01")).toBe("S-1");
    expect(normalizeQrId("s1")).toBe("S-1");
    expect(normalizeQrId("S-105")).toBe("S-105");
    expect(normalizeQrId("S-0105")).toBe("S-105");

    // Akrilik Kasir: A-[N]
    expect(normalizeQrId("A-1")).toBe("A-1");
    expect(normalizeQrId("A-0001")).toBe("A-1");
    expect(normalizeQrId("a-01")).toBe("A-1");
    expect(normalizeQrId("a1")).toBe("A-1");
    expect(normalizeQrId("A-12")).toBe("A-12");
    expect(normalizeQrId("A-0012")).toBe("A-12");
  });

  it("serves Reputation Shield micro-rating page for 'S-100' (Meja 100, inherit)", async () => {
    const req = new Request("https://grqrr.netlify.app/S-100", {
      headers: {
        "x-nf-client-connection-ip": "114.124.200.2",
        "user-agent": "Mozilla/5.0 (Android 14; Mobile)",
      },
    });

    const res = await handler(req, { params: { id: "S-100" } } as any);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Ulas Pengalaman Anda");
    expect(html).toContain("Lalana Space - Meja 100");
    expect(html).toContain("Meja 100");
    expect(html).toContain("Hubungi Manager via WhatsApp");
    expect(html).toContain("rate(5)");
    expect(html).toContain("/S-100?rate=");
  });

  it("normalizes leading zeroes from 'S-00100' and resolves to 'S-100'", async () => {
    const req = new Request("https://grqrr.netlify.app/S-00100");
    const res = await handler(req, { params: { id: "S-00100" } } as any);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Meja 100");
  });

  it("redirects active 'A-1' (Kasir Utama, direct mode) directly to Google Review", async () => {
    const req = new Request("https://grqrr.netlify.app/A-1", {
      headers: {
        "x-nf-client-connection-ip": "114.124.200.1",
        "x-city": "Bandung",
        "x-country": "Indonesia",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      },
    });

    const res = await handler(req, { params: { id: "A-1" } } as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Set-Cookie")).toContain("_gqr_vid=");
  });

  it("normalizes 'A-0001' and resolves to 'A-1'", async () => {
    const req = new Request("https://grqrr.netlify.app/A-0001");
    const res = await handler(req, { params: { id: "A-0001" } } as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");
  });

  it("redirects to Google Review when 5-star rating chosen on 'S-100'", async () => {
    const req = new Request("https://grqrr.netlify.app/S-100?rate=5", {
      headers: {
        "x-nf-client-connection-ip": "114.124.200.3",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      },
    });

    const res = await handler(req, { params: { id: "S-100" } } as any);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");

    // Verify rating logged in Turso
    const latestScan = await db.execute({
      sql: "SELECT rating_given, device_type FROM qr_scans WHERE link_id = 'S-100' AND rating_given = 5 LIMIT 1;",
      args: [],
    });
    expect(latestScan.rows.length).toBe(1);
    expect(Number(latestScan.rows[0].rating_given)).toBe(5);
    expect(latestScan.rows[0].device_type).toBe("ios");
  });

  it("logs negative rating (rate=2) via background log ping on 'S-100'", async () => {
    const req = new Request("https://grqrr.netlify.app/S-100?rate=2&log_only=1", {
      headers: {
        "user-agent": "Mozilla/5.0 (Android 14; Mobile)",
      },
    });

    const res = await handler(req, { params: { id: "S-100" } } as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.rating).toBe(2);

    // Verify logged in Turso
    const latestNegative = await db.execute({
      sql: "SELECT rating_given, device_type FROM qr_scans WHERE link_id = 'S-100' AND rating_given = 2 LIMIT 1;",
      args: [],
    });
    expect(latestNegative.rows.length).toBe(1);
    expect(Number(latestNegative.rows[0].rating_given)).toBe(2);
    expect(latestNegative.rows[0].device_type).toBe("android");
  });

  it("returns 404 custom error page for unassigned QR code 'S-1'", async () => {
    const req = new Request("https://grqrr.netlify.app/S-1");
    const res = await handler(req, { params: { id: "S-1" } } as unknown as Context);

    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("QR Code Tidak Ditemukan");
    expect(html).toContain("S-1");
  });

  it("returns 404 page for nonexistent ID", async () => {
    const req = new Request("https://grqrr.netlify.app/nonexistent-xyz");
    const res = await handler(req, { params: { id: "nonexistent-xyz" } } as any);

    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("QR Code Tidak Ditemukan");
  });
});
