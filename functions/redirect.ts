import { createClient } from "@libsql/client";
import type { Config, Context } from "@netlify/functions";

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

function renderShieldPage(
  id: string,
  merchantName: string,
  tableNo: string | null,
  targetUrl: string,
  negativeUrl: string | null,
  extraHeaders: Record<string, string> = {}
) {
  const displayTitle = merchantName || "Google Review";
  const displayTable = tableNo ? `<div class="table-tag">${tableNo}</div>` : "";
  const waUrl = negativeUrl || `https://wa.me/?text=Halo+Manager+${encodeURIComponent(displayTitle)}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ulas Pengalaman Anda - ${displayTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background: #1e293b;
      max-width: 440px;
      width: 100%;
      padding: 2.25rem 2rem;
      border-radius: 20px;
      border: 1px solid #334155;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .table-tag {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #ffffff;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .stars-container {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1.75rem;
    }
    .star-btn {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 14px;
      width: 58px;
      height: 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      color: #fbbf24;
    }
    .star-btn:hover, .star-btn:active {
      background: #334155;
      transform: scale(1.08);
      border-color: #fbbf24;
    }
    .star-icon {
      font-size: 1.6rem;
      line-height: 1;
      margin-bottom: 0.2rem;
    }
    .star-num {
      font-size: 0.75rem;
      font-weight: 600;
      color: #cbd5e1;
    }
    /* Negative Empathy View (Initially Hidden) */
    #negative-view {
      display: none;
      animation: fadeIn 0.3s ease forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .btn-wa {
      display: block;
      width: 100%;
      background: #22c55e;
      color: white;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.85rem 1rem;
      border-radius: 12px;
      text-decoration: none;
      margin-top: 1rem;
      margin-bottom: 1rem;
      transition: background 0.15s ease;
    }
    .btn-wa:hover {
      background: #16a34a;
    }
    .alt-link {
      color: #64748b;
      font-size: 0.8rem;
      text-decoration: underline;
      cursor: pointer;
    }
    .footer {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 1.5rem;
      border-top: 1px solid #334155;
      padding-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="rating-view">
      ${displayTable}
      <h1>${displayTitle}</h1>
      <p class="subtitle">Bagaimana kepuasan Anda hari ini?</p>
      
      <div class="stars-container">
        <button class="star-btn" onclick="handleLowRating(1)">
          <span class="star-icon">&#9733;</span>
          <span class="star-num">1</span>
        </button>
        <button class="star-btn" onclick="handleLowRating(2)">
          <span class="star-icon">&#9733;</span>
          <span class="star-num">2</span>
        </button>
        <button class="star-btn" onclick="handleLowRating(3)">
          <span class="star-icon">&#9733;</span>
          <span class="star-num">3</span>
        </button>
        <a href="/id/${id}?rate=4" class="star-btn">
          <span class="star-icon">&#9733;</span>
          <span class="star-num">4</span>
        </a>
        <a href="/id/${id}?rate=5" class="star-btn">
          <span class="star-icon">&#9733;</span>
          <span class="star-num">5</span>
        </a>
      </div>
      
      <p style="font-size: 0.8rem; color: #64748b;">Ketuk bintang untuk membagikan ulasan Anda</p>
    </div>

    <div id="negative-view">
      <div style="font-size: 2.2rem; margin-bottom: 0.75rem;">&#128172;</div>
      <h1 style="font-size: 1.25rem;">Mohon Maaf Atas Ketidaknyamanan</h1>
      <p class="subtitle" style="margin-bottom: 1.25rem;">
        Kenyamanan Anda adalah prioritas kami. Sampaikan masukan Anda langsung kepada Manajer agar dapat kami tangani segera di meja Anda.
      </p>
      
      <a id="wa-action-btn" href="${waUrl}" class="btn-wa">
        Hubungi Manager via WhatsApp
      </a>
      
      <div>
        <a href="/id/${id}?rate=3&force_google=1" class="alt-link">
          Tetap tulis ulasan di Google Review
        </a>
      </div>
    </div>

    <div class="footer">
      Google Review Protection &bull; greview-qr
    </div>
  </div>

  <script>
    function handleLowRating(rating) {
      document.getElementById('rating-view').style.display = 'none';
      document.getElementById('negative-view').style.display = 'block';
      // Fire-and-forget background ping to log rating
      fetch('/id/${id}?rate=' + rating + '&log_only=1').catch(function(){});
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
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

  // Parse query parameters
  const url = new URL(req.url);
  const rateParam = url.searchParams.get("rate");
  const forceGoogle = url.searchParams.get("force_google") === "1";
  const logOnly = url.searchParams.get("log_only") === "1";
  const rating = rateParam ? parseInt(rateParam, 10) : null;

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
    // 1. Fetch link details
    const lookup = await db.execute({
      sql: `SELECT id, merchant_id, merchant_name, target_url, negative_feedback_url, 
                   table_no, zone, mode, status, scan_count 
            FROM qr_links 
            WHERE id = ? 
            LIMIT 1;`,
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
    const mode = (row.mode as string) || "direct";
    const targetUrl = row.target_url as string;
    const negativeUrl = row.negative_feedback_url as string | null;
    const merchantName = (row.merchant_name as string) || "";
    const tableNo = row.table_no as string | null;

    if (status === "unassigned" || !targetUrl) {
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

    // 2. Handle SHIELD Mode: First scan without rating parameter
    if (mode === "shield" && rating === null) {
      // Record scan hit in background
      await db.batch([
        {
          sql: `UPDATE qr_links 
                SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP 
                WHERE id = ?;`,
          args: [id],
        },
        {
          sql: `INSERT INTO qr_scans (link_id, ip, city, country, user_agent, referer, visitor_id, device_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [id, ip, city, country, userAgent, referer, visitorId, deviceType],
        },
      ]);

      // Render the micro-rating screen
      return renderShieldPage(id, merchantName, tableNo, targetUrl, negativeUrl, responseHeaders);
    }

    // 3. Handle SHIELD Mode: Background rating log (from fetch)
    if (logOnly && rating !== null) {
      await db.execute({
        sql: `INSERT INTO qr_scans (link_id, ip, city, country, user_agent, referer, visitor_id, device_type, rating_given) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [id, ip, city, country, userAgent, referer, visitorId, deviceType, rating],
      });
      return new Response(JSON.stringify({ success: true, rating }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Handle Redirect: Direct Mode OR High Rating (4-5) OR Forced Google
    // Update counter and log rating
    await db.batch([
      {
        sql: `UPDATE qr_links 
              SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP 
              WHERE id = ?;`,
        args: [id],
      },
      {
        sql: `INSERT INTO qr_scans (link_id, ip, city, country, user_agent, referer, visitor_id, device_type, rating_given) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [id, ip, city, country, userAgent, referer, visitorId, deviceType, rating],
      },
    ]);

    return new Response(null, {
      status: 302,
      headers: {
        ...responseHeaders,
        "Location": targetUrl,
      },
    });
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
