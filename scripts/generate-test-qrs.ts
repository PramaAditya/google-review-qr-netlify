import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const targetDir = path.resolve("tests/qrs");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

interface QrTestCase {
  filename: string;
  type: "valid_table" | "valid_cashier" | "invalid";
  label: string;
  payload: string;
  expected: string;
}

const testCases: QrTestCase[] = [
  // 1. Valid Stiker Meja (S-[N])
  {
    filename: "valid-S-1.png",
    type: "valid_table",
    label: "Stiker Meja S-1 (Standard URL)",
    payload: "https://grqrr.netlify.app/S-1",
    expected: "Terdeteksi sebagai: Stiker S-1 (vinyl_table)",
  },
  {
    filename: "valid-S-2.png",
    type: "valid_table",
    label: "Stiker Meja S-2 (Standard URL)",
    payload: "https://grqrr.netlify.app/S-2",
    expected: "Terdeteksi sebagai: Stiker S-2 (vinyl_table)",
  },
  {
    filename: "valid-S-42.png",
    type: "valid_table",
    label: "Stiker Meja S-42 (Standard URL)",
    payload: "https://grqrr.netlify.app/S-42",
    expected: "Terdeteksi sebagai: Stiker S-42 (vinyl_table)",
  },
  {
    filename: "valid-S-105.png",
    type: "valid_table",
    label: "Stiker Meja S-105 (Standard URL)",
    payload: "https://grqrr.netlify.app/S-105",
    expected: "Terdeteksi sebagai: Stiker S-105 (vinyl_table)",
  },
  {
    filename: "valid-raw-S-88.png",
    type: "valid_table",
    label: "Stiker Meja S-88 (Plain Code)",
    payload: "S-88",
    expected: "Terdeteksi sebagai: Stiker S-88 (vinyl_table)",
  },

  // 2. Valid Akrilik Kasir (A-[N])
  {
    filename: "valid-A-1.png",
    type: "valid_cashier",
    label: "Akrilik Kasir A-1 (Standard URL)",
    payload: "https://grqrr.netlify.app/A-1",
    expected: "Terdeteksi sebagai: Akrilik A-1 (acrylic_cashier)",
  },
  {
    filename: "valid-A-12.png",
    type: "valid_cashier",
    label: "Akrilik Kasir A-12 (Standard URL)",
    payload: "https://grqrr.netlify.app/A-12",
    expected: "Terdeteksi sebagai: Akrilik A-12 (acrylic_cashier)",
  },
  {
    filename: "valid-raw-A-5.png",
    type: "valid_cashier",
    label: "Akrilik Kasir A-5 (Plain Code)",
    payload: "A-5",
    expected: "Terdeteksi sebagai: Akrilik A-5 (acrylic_cashier)",
  },

  // 3. Invalid QR Codes (Robustness Testing)
  {
    filename: "invalid-random-url.png",
    type: "invalid",
    label: "Google Search URL (Bukan Stiker)",
    payload: "https://google.com/search?q=not-a-sticker",
    expected: "Diabaikan (Bukan format S-N atau A-N)",
  },
  {
    filename: "invalid-random-text.png",
    type: "invalid",
    label: "Plain Text Biasa",
    payload: "Hello World Plain Text 12345",
    expected: "Diabaikan (Bukan format S-N atau A-N)",
  },
  {
    filename: "invalid-wrong-prefix.png",
    type: "invalid",
    label: "Salah Prefiks (X-99)",
    payload: "https://grqrr.netlify.app/X-99",
    expected: "Diabaikan (Prefiks X tidak dikenal)",
  },
  {
    filename: "invalid-wifi-qr.png",
    type: "invalid",
    label: "Format QR WiFi Cafe",
    payload: "WIFI:S:MyCafeWifi;T:WPA;P:secretpassword123;;",
    expected: "Diabaikan (Bukan format S-N atau A-N)",
  },
];

async function generateQrs() {
  console.log("Generating test QR code images into tests/qrs/ ...\n");

  for (const tc of testCases) {
    const filePath = path.join(targetDir, tc.filename);
    await QRCode.toFile(filePath, tc.payload, {
      width: 320,
      margin: 2,
      color: {
        dark: tc.type === "invalid" ? "#991b1b" : "#18181b",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
    console.log(`Generated: ${tc.filename} -> Payload: "${tc.payload}"`);
  }

  // Generate interactive HTML preview sheet
  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lembar Uji QR Code - GRQRR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7f6f2;
      color: #18181b;
      padding: 2rem 1.5rem;
    }
    .header {
      max-width: 960px;
      margin: 0 auto 2rem auto;
      text-align: center;
    }
    h1 {
      font-size: 1.8rem;
      font-weight: 900;
      margin-bottom: 0.5rem;
    }
    p {
      color: #52525b;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .instructions {
      background: #fef08a;
      border: 2px solid #18181b;
      border-radius: 14px;
      box-shadow: 3px 3px 0px #18181b;
      padding: 1rem 1.25rem;
      max-width: 960px;
      margin: 0 auto 2.5rem auto;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 800;
      margin: 2rem 0 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.25rem;
      max-width: 960px;
      margin: 0 auto;
    }
    .card {
      background: #ffffff;
      border: 2px solid #18181b;
      border-radius: 18px;
      padding: 1.25rem;
      box-shadow: 4px 4px 0px #18181b;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card.invalid {
      border-color: #991b1b;
      box-shadow: 4px 4px 0px #991b1b;
    }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      margin-bottom: 0.75rem;
    }
    .badge.table {
      background: #e0f2fe;
      color: #0369a1;
      border: 1.5px solid #0284c7;
    }
    .badge.cashier {
      background: #fef08a;
      color: #854d0e;
      border: 1.5px solid #ca8a04;
    }
    .badge.invalid {
      background: #fee2e2;
      color: #991b1b;
      border: 1.5px solid #dc2626;
    }
    .qr-img {
      width: 190px;
      height: 190px;
      border: 1.5px solid #18181b;
      border-radius: 12px;
      margin-bottom: 0.75rem;
      background: #ffffff;
    }
    .card.invalid .qr-img {
      border-color: #dc2626;
    }
    .title {
      font-size: 0.9rem;
      font-weight: 800;
      margin-bottom: 0.35rem;
    }
    .payload {
      font-family: monospace;
      font-size: 0.75rem;
      color: #4b5563;
      background: #f3f4f6;
      padding: 0.3rem 0.5rem;
      border-radius: 6px;
      word-break: break-all;
      margin-bottom: 0.5rem;
    }
    .expected {
      font-size: 0.75rem;
      font-weight: 600;
      color: #166534;
    }
    .card.invalid .expected {
      color: #991b1b;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Lembar Pengujian QR Code (GRQRR)</h1>
    <p>Buka halaman ini di layar laptop/komputer, lalu buka <strong>grqrr.netlify.app/sales</strong> di ponsel Anda dan arahkan kamera ke QR di bawah ini.</p>
  </div>

  <div class="instructions">
    Cara Pengujian Live Scanner:
    <ol style="margin-left: 1.25rem; margin-top: 0.35rem; line-height: 1.6;">
      <li>Buka PWA Sales di HP Anda: <strong>https://grqrr.netlify.app/sales</strong> (Login: 081234567890 / PIN: 1234).</li>
      <li>Ketuk tombol biru: <strong>"Pindai Kamera Stiker Lepas"</strong>.</li>
      <li>Arahkan kamera HP ke QR Code <strong>VALID</strong> di bawah: HP akan bergetar dan item langsung masuk ke tray.</li>
      <li>Coba arahkan kamera ke QR Code <strong>INVALID</strong>: Sistem akan mengabaikannya secara cerdas tanpa error.</li>
    </ol>
  </div>

  <div style="max-width: 960px; margin: 0 auto;">
    <div class="section-title">
      <span>1. QR Code Valid - Stiker Meja (S-[N])</span>
    </div>
    <div class="grid">
      ${testCases
        .filter((t) => t.type === "valid_table")
        .map(
          (t) => `
        <div class="card">
          <div class="badge table">Stiker Meja</div>
          <img src="${t.filename}" class="qr-img" alt="${t.label}">
          <div class="title">${t.label}</div>
          <div class="payload">${t.payload}</div>
          <div class="expected">${t.expected}</div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="section-title">
      <span>2. QR Code Valid - Akrilik Kasir (A-[N])</span>
    </div>
    <div class="grid">
      ${testCases
        .filter((t) => t.type === "valid_cashier")
        .map(
          (t) => `
        <div class="card">
          <div class="badge cashier">Akrilik Kasir</div>
          <img src="${t.filename}" class="qr-img" alt="${t.label}">
          <div class="title">${t.label}</div>
          <div class="payload">${t.payload}</div>
          <div class="expected">${t.expected}</div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="section-title">
      <span>3. QR Code Tidak Valid (Negative / Robustness Test)</span>
    </div>
    <div class="grid">
      ${testCases
        .filter((t) => t.type === "invalid")
        .map(
          (t) => `
        <div class="card invalid">
          <div class="badge invalid">Tidak Valid / Abaikan</div>
          <img src="${t.filename}" class="qr-img" alt="${t.label}">
          <div class="title">${t.label}</div>
          <div class="payload">${t.payload}</div>
          <div class="expected">${t.expected}</div>
        </div>
      `
        )
        .join("")}
    </div>
  </div>

</body>
</html>`;

  fs.writeFileSync(path.join(targetDir, "preview.html"), htmlContent, "utf8");
  console.log("\nPreview HTML sheet generated at: tests/qrs/preview.html");
  console.log("All test QR codes generated successfully!");
}

generateQrs().catch(console.error);
