import { createClient } from "@libsql/client";
import type { Config, Context } from "@netlify/functions";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function standardizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("62")) {
    clean = "0" + clean.slice(2);
  } else if (!clean.startsWith("0")) {
    clean = "0" + clean;
  }
  return clean;
}
function normalizeQrId(rawId: string): string {
  const match = rawId.trim().match(/^([SA])-?0*(\d+)$/i);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = parseInt(match[2], 10);
    return `${prefix}-${num}`;
  }
  return rawId.trim();
}


function formatWhatsAppUrlNumber(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  } else if (!clean.startsWith("62")) {
    clean = "62" + clean;
  }
  return clean;
}

function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  // 0. GET /api/sales/check?id=... (Check if QR ID is valid or already active)
  if (path.endsWith("/check") && req.method === "GET") {
    const idParam = url.searchParams.get("id");
    if (!idParam) {
      return jsonResponse({ error: "Parameter id wajib disertakan." }, 400);
    }
    const checkId = normalizeQrId(idParam);
    const checkRes = await db.execute({
      sql: `SELECT id, merchant_name, status FROM qr_links WHERE id = ? LIMIT 1;`,
      args: [checkId],
    });

    if (checkRes.rows.length === 0) {
      return jsonResponse({ id: checkId, exists: false, is_active: false });
    }

    const row = checkRes.rows[0];
    return jsonResponse({
      id: checkId,
      exists: true,
      status: row.status,
      is_active: row.status === "active",
      merchant_name: row.merchant_name || null,
    });
  }


  // 1. POST /api/sales/login
  if (path.endsWith("/login") && req.method === "POST") {
    try {
      const body = await req.json();
      const rawPhone = String(body.phone || "");
      const inputPin = String(body.pin || "").trim();

      if (!rawPhone || !inputPin) {
        return jsonResponse({ error: "Nomor WhatsApp dan PIN 4 digit wajib diisi." }, 400);
      }

      const stdPhone = standardizePhone(rawPhone);

      const result = await db.execute({
        sql: `SELECT id, name, phone, pin, commission_table, commission_cashier, status 
              FROM sales_reps 
              WHERE phone = ? LIMIT 1;`,
        args: [stdPhone],
      });

      if (result.rows.length === 0) {
        return jsonResponse({ error: "Nomor WhatsApp sales tidak terdaftar." }, 401);
      }

      const rep = result.rows[0];
      if (String(rep.pin) !== inputPin) {
        return jsonResponse({ error: "PIN yang Anda masukkan salah." }, 401);
      }

      if (rep.status !== "active") {
        return jsonResponse({ error: "Akun sales Anda sedang dinonaktifkan." }, 403);
      }

      // Update last login
      await db.execute({
        sql: `UPDATE sales_reps SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        args: [stdPhone],
      });

      // Fetch pricing settings
      const settingsResult = await db.execute(`
        SELECT key, value FROM app_settings 
        WHERE key IN ('price_vinyl_table', 'price_acrylic_cashier');
      `);
      const pricing: Record<string, number> = {
        price_vinyl_table: 10000,
        price_acrylic_cashier: 25000,
      };
      for (const row of settingsResult.rows) {
        pricing[String(row.key)] = parseInt(String(row.value), 10) || pricing[String(row.key)];
      }

      // Fetch sales performance summary
      const summaryResult = await db.execute({
        sql: `SELECT 
                COUNT(DISTINCT m.id) as total_merchants,
                COUNT(CASE WHEN l.sticker_type = 'vinyl_table' THEN 1 END) as table_count,
                COUNT(CASE WHEN l.sticker_type = 'acrylic_cashier' THEN 1 END) as cashier_count
              FROM merchants m
              LEFT JOIN qr_links l ON m.id = l.merchant_id AND l.status = 'active'
              WHERE m.sales_rep_id = ?;`,
        args: [stdPhone],
      });

      const summaryRow = summaryResult.rows[0];
      const tableCount = Number(summaryRow.table_count || 0);
      const cashierCount = Number(summaryRow.cashier_count || 0);
      const commTable = Number(rep.commission_table || 3000);
      const commCashier = Number(rep.commission_cashier || 7000);
      const totalCommission = (tableCount * commTable) + (cashierCount * commCashier);

      return jsonResponse({
        success: true,
        salesRep: {
          id: rep.id,
          name: rep.name,
          phone: rep.phone,
          commission_table: commTable,
          commission_cashier: commCashier,
        },
        pricing,
        summary: {
          total_merchants: Number(summaryRow.total_merchants || 0),
          table_stickers: tableCount,
          cashier_acrylics: cashierCount,
          total_commission_idr: totalCommission,
        },
      });
    } catch (e: any) {
      console.error("Login error:", e);
      return jsonResponse({ error: "Gagal memproses login." }, 500);
    }
  }

  // 2. POST /api/sales/activate (Range-based activation)
  if (path.endsWith("/activate") && req.method === "POST") {
    try {
      const body = await req.json();
      const rawPhone = String(body.phone || "");
      const inputPin = String(body.pin || "").trim();
      const merchantName = String(body.merchant_name || "").trim();
      const mapsUrl = String(body.maps_url || "").trim();
      const ownerWa = body.owner_whatsapp ? standardizePhone(String(body.owner_whatsapp)) : null;

      const tableStart = body.table_start ? parseInt(String(body.table_start), 10) : null;
      const tableEnd = body.table_end ? parseInt(String(body.table_end), 10) : null;
      const cashierStart = body.cashier_start ? parseInt(String(body.cashier_start), 10) : null;
      const cashierEnd = body.cashier_end ? parseInt(String(body.cashier_end), 10) : null;
      const selectedMode = (body.mode === "direct") ? "direct" : "shield";

      const complaintWa = (body.complaint_whatsapp || body.manager_whatsapp) ? standardizePhone(String(body.complaint_whatsapp || body.manager_whatsapp)) : null;
      const businessWa = (body.business_whatsapp || body.owner_whatsapp) ? standardizePhone(String(body.business_whatsapp || body.owner_whatsapp)) : complaintWa;
      if (!rawPhone || !inputPin) {
        return jsonResponse({ error: "Autentikasi sales diperlukan." }, 401);
      }
      if (!merchantName) {
        return jsonResponse({ error: "Nama bisnis / toko wajib diisi." }, 400);
      }
      if (!mapsUrl) {
        return jsonResponse({ error: "Link Google Maps / Google Review wajib diisi." }, 400);
      }
      if (selectedMode === "shield" && !complaintWa) {
        return jsonResponse({ 
          error: "WhatsApp Penanganan Komplain (complaint_whatsapp) wajib diisi jika mode Reputation Shield aktif agar tamu dapat menyampaikan keluhan." 
        }, 400);
      }
      // Verify sales rep credentials
      const stdPhone = standardizePhone(rawPhone);
      const repCheck = await db.execute({
        sql: `SELECT id, name, pin, commission_table, commission_cashier, status 
              FROM sales_reps 
              WHERE phone = ? AND pin = ? AND status = 'active' LIMIT 1;`,
        args: [stdPhone, inputPin],
      });

      if (repCheck.rows.length === 0) {
        return jsonResponse({ error: "Autentikasi sales tidak valid atau akun dinonaktifkan." }, 403);
      }

      const rep = repCheck.rows[0];
      // Pre-check for conflicts: strictly prevent overriding existing activated QR codes
      const allTargetIds: string[] = [];
      if (Array.isArray(body.items)) {
        for (const it of body.items) {
          const norm = normalizeQrId(String(it));
          if (norm && !allTargetIds.includes(norm)) allTargetIds.push(norm);
        }
      }
      if (tableStart !== null && tableEnd !== null && tableStart <= tableEnd) {
        for (let i = tableStart; i <= tableEnd; i++) {
          const id = `S-${i}`;
          if (!allTargetIds.includes(id)) allTargetIds.push(id);
        }
      }
      if (cashierStart !== null && cashierEnd !== null && cashierStart <= cashierEnd) {
        for (let i = cashierStart; i <= cashierEnd; i++) {
          const id = `A-${i}`;
          if (!allTargetIds.includes(id)) allTargetIds.push(id);
        }
      }

      if (allTargetIds.length > 0) {
        const placeholders = allTargetIds.map(() => "?").join(", ");
        const conflictRes = await db.execute({
          sql: `SELECT id, merchant_name FROM qr_links WHERE id IN (${placeholders}) AND status = 'active';`,
          args: allTargetIds,
        });

        if (conflictRes.rows.length > 0) {
          const list = conflictRes.rows.map(r => `${r.id} (di ${r.merchant_name || 'Merchant lain'})`).join(", ");
          return jsonResponse({
            error: `Item berikut sudah aktif dan tidak dapat ditimpa: ${list}. Harap gunakan stiker fisik baru.`,
            conflicts: conflictRes.rows.map(r => String(r.id)),
          }, 409);
        }
      }


      // Generate merchant ID from slug
      const merchantSlug = "merch_" + merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32);
      const merchantId = `${merchantSlug}_${Date.now().toString(36)}`;

      // Setup negative feedback WhatsApp destination
      const waTarget = complaintWa ? formatWhatsAppUrlNumber(complaintWa) : "6281234567890";
      const negativeFeedbackUrl = `https://wa.me/${waTarget}?text=Halo+Manager+${encodeURIComponent(merchantName)}+Saya+ada+masukan`;

      // 1. Insert Merchant
      await db.execute({
        sql: `INSERT INTO merchants (id, name, owner_whatsapp, manager_whatsapp, complaint_whatsapp, business_whatsapp, plan, default_mode, sales_rep_id)
              VALUES (?, ?, ?, ?, ?, ?, 'pro', ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                owner_whatsapp = excluded.owner_whatsapp,
                manager_whatsapp = excluded.manager_whatsapp,
                complaint_whatsapp = excluded.complaint_whatsapp,
                business_whatsapp = excluded.business_whatsapp,
                default_mode = excluded.default_mode,
                sales_rep_id = excluded.sales_rep_id;`,
        args: [merchantId, merchantName, businessWa, complaintWa, complaintWa, businessWa, selectedMode, stdPhone],
      });

      const batchStatements = [];
      const activatedStickers: string[] = [];
      let sCount = 0;
      let aCount = 0;

      // 1. Process explicit individual items (from Camera Bulk Scanner)
      const rawItems: string[] = Array.isArray(body.items) ? body.items : [];
      for (const item of rawItems) {
        const cleanId = String(item).trim().toUpperCase();
        if (!cleanId || activatedStickers.includes(cleanId)) continue;
        const isCashier = cleanId.startsWith("A-");
        const stickerType = isCashier ? "acrylic_cashier" : "vinyl_table";
        const zone = isCashier ? "cashier" : "indoor";
        const mode = isCashier ? "direct" : "inherit";
        const tableNo = isCashier ? "Kasir Utama" : `Titik ${cleanId}`;

        if (isCashier) aCount++;
        else sCount++;

        activatedStickers.push(cleanId);
        batchStatements.push({
          sql: `INSERT INTO qr_links (
                  id, merchant_id, sales_rep_id, merchant_name, table_no, zone, 
                  sticker_type, mode, target_url, negative_feedback_url, status, assigned_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                  merchant_id = excluded.merchant_id,
                  sales_rep_id = excluded.sales_rep_id,
                  merchant_name = excluded.merchant_name,
                  table_no = excluded.table_no,
                  zone = excluded.zone,
                  sticker_type = excluded.sticker_type,
                  mode = excluded.mode,
                  target_url = excluded.target_url,
                  negative_feedback_url = excluded.negative_feedback_url,
                  status = excluded.status,
                  assigned_at = CURRENT_TIMESTAMP;`,
          args: [cleanId, merchantId, stdPhone, merchantName, tableNo, zone, stickerType, mode, mapsUrl, negativeFeedbackUrl],
        });
      }

      let tableIndex = sCount + 1;

      // 2. Queue Stiker Meja Vinyl Range (S-[N])
      if (tableStart !== null && tableEnd !== null && tableStart <= tableEnd) {
        for (let i = tableStart; i <= tableEnd; i++) {
          const id = `S-${i}`;
          if (activatedStickers.includes(id)) continue;
          sCount++;
          activatedStickers.push(id);
          batchStatements.push({
            sql: `INSERT INTO qr_links (
                    id, merchant_id, sales_rep_id, merchant_name, table_no, zone, 
                    sticker_type, mode, target_url, negative_feedback_url, status, assigned_at
                  )
                  VALUES (?, ?, ?, ?, ?, 'indoor', 'vinyl_table', 'inherit', ?, ?, 'active', CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO UPDATE SET
                    merchant_id = excluded.merchant_id,
                    sales_rep_id = excluded.sales_rep_id,
                    merchant_name = excluded.merchant_name,
                    table_no = excluded.table_no,
                    zone = excluded.zone,
                    sticker_type = excluded.sticker_type,
                    mode = excluded.mode,
                    target_url = excluded.target_url,
                    negative_feedback_url = excluded.negative_feedback_url,
                    status = excluded.status,
                    assigned_at = CURRENT_TIMESTAMP;`,
            args: [
              id,
              merchantId,
              stdPhone,
              merchantName,
              `Meja ${tableIndex.toString().padStart(2, "0")}`,
              mapsUrl,
              negativeFeedbackUrl,
            ],
          });
          tableIndex++;
        }
      }

      // 3. Queue Akrilik Kasir (A-[N])
      if (cashierStart !== null && cashierEnd !== null && cashierStart <= cashierEnd) {
        for (let i = cashierStart; i <= cashierEnd; i++) {
          const id = `A-${i}`;
          if (activatedStickers.includes(id)) continue;
          aCount++;
          activatedStickers.push(id);
          batchStatements.push({
            sql: `INSERT INTO qr_links (
                    id, merchant_id, sales_rep_id, merchant_name, table_no, zone, 
                    sticker_type, mode, target_url, negative_feedback_url, status, assigned_at
                  )
                  VALUES (?, ?, ?, ?, 'Kasir Utama', 'cashier', 'acrylic_cashier', 'direct', ?, ?, 'active', CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO UPDATE SET
                    merchant_id = excluded.merchant_id,
                    sales_rep_id = excluded.sales_rep_id,
                    merchant_name = excluded.merchant_name,
                    table_no = excluded.table_no,
                    zone = excluded.zone,
                    sticker_type = excluded.sticker_type,
                    mode = excluded.mode,
                    target_url = excluded.target_url,
                    negative_feedback_url = excluded.negative_feedback_url,
                    status = excluded.status,
                    assigned_at = CURRENT_TIMESTAMP;`,
            args: [
              id,
              merchantId,
              stdPhone,
              merchantName,
              mapsUrl,
              negativeFeedbackUrl,
            ],
          });
        }
      }

      if (batchStatements.length === 0) {
        return jsonResponse({ error: "Tentukan minimal rentang nomor atau scan stiker/akrilik." }, 400);
      }

      // Execute atomic batch
      await db.batch(batchStatements);

      const tableTotal = sCount;
      const cashierTotal = aCount;
      const commEarned = (tableTotal * Number(rep.commission_table || 3000)) +
                         (cashierTotal * Number(rep.commission_cashier || 7000));
      const billTotal = (tableTotal * 10000) + (cashierTotal * 25000);

      return jsonResponse({
        success: true,
        message: `Berhasil mengaktifkan ${activatedStickers.length} titik untuk ${merchantName}!`,
        merchant: {
          id: merchantId,
          name: merchantName,
        },
        summary: {
          table_stickers: tableTotal,
          cashier_acrylics: cashierTotal,
          activated_ids: activatedStickers,
          bill_total_idr: billTotal,
          commission_earned_idr: commEarned,
        },
      });
    } catch (e: any) {
      console.error("Activation error:", e);
      return jsonResponse({ error: "Gagal memproses aktivasi stiker." }, 500);
    }
  }

  return jsonResponse({ error: "Endpoint sales API tidak ditemukan." }, 404);
};

export const config: Config = {
  path: "/api/sales/*",
};
