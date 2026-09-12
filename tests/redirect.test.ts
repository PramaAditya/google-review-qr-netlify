import { describe, it, expect } from "bun:test";
import { createClient } from "@libsql/client";
import handler from "../functions/redirect";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

describe("Google Review QR Redirect Function", () => {
  it("redirects active 'lalana' ID to Google Review URL and increments scan counter", async () => {
    // 1. Check initial scan count
    const initial = await db.execute({
      sql: "SELECT scan_count FROM qr_links WHERE id = 'lalana';",
      args: [],
    });
    const initialCount = Number(initial.rows[0].scan_count || 0);

    // 2. Invoke handler
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

    // 3. Assert HTTP response
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("search.google.com/local/writereview?placeid=ChIJLfa-odLpaC4ROAxQUcIh5Cg");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Set-Cookie")).toContain("_gqr_vid=");
    // 4. Verify scan count incremented in Turso
    const after = await db.execute({
      sql: "SELECT scan_count FROM qr_links WHERE id = 'lalana';",
      args: [],
    });
    const newCount = Number(after.rows[0].scan_count);
    expect(newCount).toBe(initialCount + 1);

    // 5. Verify telemetry log inserted in qr_scans
    const scanLog = await db.execute({
      sql: "SELECT * FROM qr_scans WHERE link_id = 'lalana' ORDER BY id DESC LIMIT 1;",
      args: [],
    });
    expect(scanLog.rows.length).toBe(1);
    expect(scanLog.rows[0].ip).toBe("114.124.200.1");
    expect(scanLog.rows[0].city).toBe("Bandung");
    expect(scanLog.rows[0].device_type).toBe("ios");
    expect(scanLog.rows[0].visitor_id).toBeTruthy();
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
