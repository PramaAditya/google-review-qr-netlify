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
/**
 * Canonical QR ID Normalizer
 * - S-[N]: Stiker Meja Vinyl (e.g. S-0001 -> S-1)
 * - A-[N]: Akrilik Kasir (e.g. A-0012 -> A-12)
 * Leading zeroes are strictly stripped.
 */
export function normalizeQrId(rawId: string): string {
  const match = rawId.trim().match(/^([SA])-?0*(\d+)$/i);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = parseInt(match[2], 10);
    return `${prefix}-${num}`;
  }
  return rawId.trim();
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
    <div class="footer">Google Review QR Service</div>
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
      padding: 2.5rem 2rem 2rem 2rem;
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
      font-size: 1.45rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      color: #18181b;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: #52525b;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 2rem;
    }

    /* Google Review Hollow Stars Container */
    .stars-container {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.75rem;
      touch-action: manipulation;
    }
    .star-btn {
      background: transparent;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      outline: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
    }
    .star-svg {
      width: 46px;
      height: 46px;
      fill: none;
      stroke: #71717a;
      stroke-width: 1.75;
      stroke-linejoin: round;
      stroke-linecap: round;
      transition: fill 0.12s ease, stroke 0.12s ease, transform 0.12s ease;
    }
    .star-btn:hover .star-svg,
    .star-btn:active .star-svg {
      transform: scale(1.12);
    }
    .star-svg.filled {
      fill: #fbbc04;
      stroke: #e37400;
    }

    .helper-text {
      font-size: 0.85rem;
      font-weight: 500;
      color: #71717a;
      min-height: 1.25rem;
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
      width: 180px;
      height: 180px;
      object-fit: contain;
      margin: 0 auto 0.75rem auto;
      display: block;
      background: transparent;
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
  </style>
</head>
<body>
  <div class="card">
    <div id="rating-view">
      ${displayTable}
      <h1>${displayTitle}</h1>
      <p class="subtitle">Bagaimana kepuasan Anda hari ini?</p>
      
      <!-- Native Google Review Hollow Outline Stars -->
      <div class="stars-container" id="stars-group" onmouseleave="resetStars()">
        <button type="button" class="star-btn" aria-label="1 Bintang" onmouseenter="hoverStars(1)" onclick="rate(1)">
          <svg class="star-svg" id="star-1" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
        <button type="button" class="star-btn" aria-label="2 Bintang" onmouseenter="hoverStars(2)" onclick="rate(2)">
          <svg class="star-svg" id="star-2" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
        <button type="button" class="star-btn" aria-label="3 Bintang" onmouseenter="hoverStars(3)" onclick="rate(3)">
          <svg class="star-svg" id="star-3" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
        <button type="button" class="star-btn" aria-label="4 Bintang" onmouseenter="hoverStars(4)" onclick="rate(4)">
          <svg class="star-svg" id="star-4" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
        <button type="button" class="star-btn" aria-label="5 Bintang" onmouseenter="hoverStars(5)" onclick="rate(5)">
          <svg class="star-svg" id="star-5" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
      </div>
      
      <p class="helper-text" id="star-hint">Ketuk bintang untuk menilai</p>
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
        <a href="/${id}?rate=3&force_google=1" class="alt-link">
          Tetap tulis ulasan di Google Review
        </a>
      </div>
    </div>

  </div>

  <script>
    var selectedVal = 0;
    var labels = ["", "Kurang Memuaskan", "Cukup", "Bagus", "Sangat Bagus", "Luar Biasa!"];

    function setStars(count) {
      for (var i = 1; i <= 5; i++) {
        var el = document.getElementById('star-' + i);
        if (i <= count) {
          el.classList.add('filled');
        } else {
          el.classList.remove('filled');
        }
      }
      var hint = document.getElementById('star-hint');
      if (count > 0 && count <= 5) {
        hint.textContent = labels[count];
        hint.style.color = '#18181b';
        hint.style.fontWeight = '700';
      } else {
        hint.textContent = 'Ketuk bintang untuk menilai';
        hint.style.color = '#71717a';
        hint.style.fontWeight = '500';
      }
    }

    function hoverStars(count) {
      if (selectedVal === 0) setStars(count);
    }

    function resetStars() {
      if (selectedVal === 0) setStars(0);
    }

    function rate(rating) {
      selectedVal = rating;
      setStars(rating);

      if (rating <= 3) {
        // Log negative rating silently in background
        fetch('/${id}?rate=' + rating + '&log_only=1').catch(function(){});
        setTimeout(function() {
          document.getElementById('rating-view').style.display = 'none';
          document.getElementById('negative-view').style.display = 'block';
        }, 180);
      } else {
        // Positive rating: forward directly to Google Review
        setTimeout(function() {
          window.location.href = '/${id}?rate=' + rating;
        }, 180);
      }
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
  const rawId = context.params?.id || new URL(req.url).pathname.split("/").filter(Boolean).pop();

  if (!rawId) {
    return renderHtmlPage(
      "Parameter ID Kosong",
      "Format link QR tidak valid. Pastikan URL memiliki parameter ID.",
      "Bad Request",
      "#ef4444",
      400
    );
  }

  const id = normalizeQrId(rawId);

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
      sql: `SELECT l.id, l.merchant_id, l.merchant_name, l.target_url, l.negative_feedback_url, 
                   l.table_no, l.zone, l.status, l.scan_count,
                   COALESCE(NULLIF(l.mode, 'inherit'), m.default_mode, 'direct') AS effective_mode
            FROM qr_links l
            LEFT JOIN merchants m ON l.merchant_id = m.id
            WHERE l.id = ? 
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
    const mode = (row.effective_mode as string) || "direct";
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
  path: ["/:id", "/id/:id"],
  excludedPath: ["/images/*", "/icons/*", "/favicon.ico", "/", "/sales*", "/api/*", "/manifest.json", "/sw.js"],
};
