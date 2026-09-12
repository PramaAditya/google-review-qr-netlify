import { createClient } from "@libsql/client";
import type { Config, Context } from "@netlify/functions";

// Reusable Turso client across warm serverless invocations
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function detectDeviceType(ua: string): string {
  const lower = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(lower)) return "ios";
  if (/android/.test(lower)) return "android";
  if (/windows|macintosh|linux/.test(lower)) return "desktop";
  return "other";
}

function parseVisitorCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)_gqr_vid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function renderHtmlPage(
  title: string,
  message: string,
  badge: string,
  badgeColor: string,
  statusCode: number = 200,
  extraHeaders: Record<string, string> = {}
) {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Google Review QR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background: white;
      max-width: 420px;
      width: 100%;
      padding: 2rem;
      border-radius: 16px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    .badge {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.35rem 0.8rem;
      border-radius: 9999px;
      margin-bottom: 1rem;
      background: ${badgeColor}15;
      color: ${badgeColor};
      border: 1px solid ${badgeColor}30;
    }
    h1 {
      font-size: 1.4rem;
      margin-bottom: 0.75rem;
      color: #0f172a;
    }
    p {
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .footer {
      font-size: 0.8rem;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${badge}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="footer">Google Review QR Service &bull; greview-qr</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...extraHeaders,
    },
  });
}

export default async (req: Request, context: Context) => {
  const id = context.params?.id;

  if (!id) {
    return renderHtmlPage(
      "Parameter ID Kosong",
      "Format link QR tidak valid. Pastikan URL memiliki parameter ID.",
      "Bad Request",
      "#ef4444",
      400
    );
  }

  // Extract client telemetry & device attributes
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const city = context.geo?.city || req.headers.get("x-city") || "";
  const country = context.geo?.country?.name || req.headers.get("x-country") || "";
  const userAgent = req.headers.get("user-agent") || "";
  const referer = req.headers.get("referer") || "";
  const deviceType = detectDeviceType(userAgent);

  // Extract or generate anonymous visitor cookie (180 days retention)
  const cookieHeader = req.headers.get("cookie");
  const existingVisitorId = parseVisitorCookie(cookieHeader);
  const visitorId = existingVisitorId || crypto.randomUUID();
  const isNewVisitor = !existingVisitorId;

  // Build response headers (including Set-Cookie if newly minted)
  const responseHeaders: Record<string, string> = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
  };
  if (isNewVisitor) {
    responseHeaders["Set-Cookie"] = `_gqr_vid=${visitorId}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
  }

  try {
    // Fast path: Atomic single round-trip update and telemetry insert
    const [updateResult] = await db.batch([
      {
        sql: `UPDATE qr_links 
              SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP 
              WHERE id = ? AND status = 'active' AND target_url IS NOT NULL 
              RETURNING target_url, merchant_name, mode, negative_feedback_url;`,
        args: [id],
      },
      {
        sql: `INSERT INTO qr_scans (link_id, ip, city, country, user_agent, referer, visitor_id, device_type) 
              SELECT ?, ?, ?, ?, ?, ?, ?, ? 
              WHERE EXISTS (SELECT 1 FROM qr_links WHERE id = ?);`,
        args: [id, ip, city, country, userAgent, referer, visitorId, deviceType, id],
      },
    ]);

    // If active link found and updated, issue HTTP 302 redirect immediately
    if (updateResult.rows.length > 0) {
      const row = updateResult.rows[0];
      const targetUrl = row.target_url as string;

      return new Response(null, {
        status: 302,
        headers: {
          ...responseHeaders,
          "Location": targetUrl,
        },
      });
    }

    // Fallback path: Check if ID exists but is unassigned, suspended, or missing
    const lookup = await db.execute({
      sql: `SELECT id, status, merchant_name, target_url, table_no FROM qr_links WHERE id = ? LIMIT 1;`,
      args: [id],
    });

    if (lookup.rows.length === 0) {
      return renderHtmlPage(
        "QR Code Tidak Ditemukan",
        `Stiker dengan ID <strong>"${id}"</strong> belum terdaftar di sistem.`,
        "404 Not Found",
        "#ef4444",
        404,
        responseHeaders
      );
    }

    const row = lookup.rows[0];
    const status = row.status as string;

    if (status === "unassigned" || !row.target_url) {
      return renderHtmlPage(
        "Stiker Belum Diaktifkan",
        `Stiker QR ini sudah terpasang (ID: <strong>${id}</strong>) namun belum dihubungkan ke halaman Google Review merchant. Silakan hubungi staff restoran atau representatif sales.`,
        "Belum Aktif",
        "#f59e0b",
        200,
        responseHeaders
      );
    }

    if (status === "suspended") {
      return renderHtmlPage(
        "Stiker Nonaktif",
        `Layanan review untuk stiker ID: <strong>${id}</strong> sedang dinonaktifkan sementara.`,
        "Nonaktif",
        "#64748b",
        200,
        responseHeaders
      );
    }

    return renderHtmlPage(
      "Status Tidak Dikenal",
      `Stiker ID <strong>${id}</strong> memiliki konfigurasi yang belum lengkap.`,
      "Peringatan",
      "#f59e0b",
      200,
      responseHeaders
    );
  } catch (error: any) {
    console.error("Redirect handler error:", error);
    return renderHtmlPage(
      "Terjadi Gangguan Sistem",
      "Tidak dapat memproses pengalihan review saat ini. Silakan coba beberapa saat lagi.",
      "Server Error",
      "#ef4444",
      500,
      responseHeaders
    );
  }
};

export const config: Config = {
  path: "/id/:id",
};
