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
      background: #f7f6f2;
      color: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      max-width: 420px;
      width: 100%;
      padding: 2.25rem 2rem;
      border-radius: 22px;
      border: 2px solid #18181b;
      box-shadow: 4px 4px 0px #18181b;
      text-align: center;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1.25rem;
      background: ${badgeColor}20;
      color: #18181b;
      border: 1.5px solid #18181b;
      box-shadow: 2px 2px 0px #18181b;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      color: #18181b;
      letter-spacing: -0.02em;
    }
    p {
      color: #52525b;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .footer {
      font-size: 0.75rem;
      font-weight: 600;
      color: #71717a;
      border-top: 1.5px dashed #e4e4e7;
      padding-top: 1rem;
      margin-top: 0.5rem;
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
  <link rel="preload" as="image" href="/images/apology.jpg">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f7f6f2;
      color: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      max-width: 440px;
      width: 100%;
      padding: 2.25rem 2rem;
      border-radius: 24px;
      border: 2px solid #18181b;
      box-shadow: 5px 5px 0px #18181b;
      text-align: center;
      position: relative;
    }
    .table-tag {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.3rem 0.85rem;
      border-radius: 9999px;
      background: #fef08a;
      color: #18181b;
      border: 1.5px solid #18181b;
      box-shadow: 2px 2px 0px #18181b;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      color: #18181b;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: #52525b;
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
      background: #ffffff;
      border: 2px solid #18181b;
      border-radius: 14px;
      width: 58px;
      height: 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 3px 3px 0px #18181b;
      transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.15s ease;
      text-decoration: none;
      color: #f59e0b;
    }
    .star-btn:hover, .star-btn:active {
      transform: translate(2px, 2px);
      box-shadow: 1px 1px 0px #18181b;
      background: #fef9c3;
    }
    .star-icon {
      font-size: 1.6rem;
      line-height: 1;
      margin-bottom: 0.2rem;
    }
    .star-num {
      font-size: 0.8rem;
      font-weight: 700;
      color: #18181b;
    }
    .helper-text {
      font-size: 0.8rem;
      font-weight: 500;
      color: #71717a;
    }

    /* Negative Empathy View with Illustration */
    #negative-view {
      display: none;
      animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.96) translateY(6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .apology-avatar {
      width: 135px;
      height: 135px;
      border-radius: 50%;
      object-fit: cover;
      border: 2.5px solid #18181b;
      box-shadow: 4px 4px 0px #18181b;
      margin: 0 auto 1.25rem auto;
      display: block;
      background: #ffffff;
    }
    .btn-wa {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      background: #22c55e;
      border: 2px solid #18181b;
      box-shadow: 3px 3px 0px #18181b;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.95rem;
      padding: 0.85rem 1rem;
      border-radius: 14px;
      text-decoration: none;
      margin-top: 1.25rem;
      margin-bottom: 1rem;
      transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.15s ease;
    }
    .btn-wa:hover, .btn-wa:active {
      background: #16a34a;
      transform: translate(2px, 2px);
      box-shadow: 1px 1px 0px #18181b;
    }
    .alt-link {
      color: #71717a;
      font-size: 0.8rem;
      text-decoration: underline;
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .alt-link:hover {
      color: #18181b;
    }
    .footer {
      font-size: 0.75rem;
      font-weight: 600;
      color: #71717a;
      margin-top: 1.75rem;
      border-top: 1.5px dashed #e4e4e7;
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
      
      <p class="helper-text">Ketuk bintang untuk membagikan ulasan Anda</p>
    </div>

    <div id="negative-view">
      <img src="/images/apology.jpg" class="apology-avatar" alt="Karakter Kartun Meminta Maaf">
      <h1 style="font-size: 1.25rem;">Mohon Maaf Atas Ketidaknyamanan</h1>
      <p class="subtitle" style="margin-bottom: 1.25rem;">
        Kenyamanan Anda adalah prioritas utama kami. Sampaikan masukan Anda langsung kepada Manajer agar dapat kami tangani segera di meja Anda.
      </p>
      
      <a id="wa-action-btn" href="${waUrl}" class="btn-wa">
        <span>Hubungi Manager via WhatsApp</span>
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
