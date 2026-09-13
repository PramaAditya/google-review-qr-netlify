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
    filename: "valid-S-100.png",
    type: "valid_table",
    label: "Stiker Meja S-100 (Standard URL)",
    payload: "https://grqrr.netlify.app/S-100",
    expected: "Terdeteksi sebagai: Stiker S-100 (vinyl_table)",
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
    filename: "valid-S-88.png",
    type: "valid_table",
    label: "Stiker Meja S-88",
    payload: "https://grqrr.netlify.app/S-88",
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
    filename: "valid-A-5.png",
    type: "valid_cashier",
    label: "Akrilik Kasir A-5",
    payload: "https://grqrr.netlify.app/A-5",
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
    if (!fs.existsSync(filePath)) {
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
    } else {
      console.log(`Exists: ${tc.filename}`);
    }
  }

  // Generate interactive HTML preview sheet
  // Interleave and randomize test items to simulate a messy sales table
  const shuffledCases = [...testCases].sort(() => Math.random() - 0.5);

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulasi Meja Lapangan - Pindai Stiker Berantakan</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #e5e2da;
      color: #18181b;
      min-height: 100vh;
      padding: 1.5rem 2rem 4rem 2rem;
      width: 100%;
    }
    .top-bar {
      width: 100%;
      background: #ffffff;
      border: 2px solid #18181b;
      border-radius: 20px;
      box-shadow: 4px 4px 0px #18181b;
      padding: 1.25rem 1.75rem;
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .top-info h1 {
      font-size: 1.4rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 0.25rem;
    }
    .top-info p {
      font-size: 0.85rem;
      color: #52525b;
      line-height: 1.4;
    }
    .btn-shuffle {
      background: #fef08a;
      border: 2px solid #18181b;
      box-shadow: 3px 3px 0px #18181b;
      border-radius: 12px;
      padding: 0.65rem 1.15rem;
      font-size: 0.85rem;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .btn-shuffle:active {
      transform: translate(2px, 2px);
      box-shadow: 1px 1px 0px #18181b;
    }
    .table-surface {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
      gap: 2rem 1.5rem;
      align-items: center;
      justify-content: center;
    }
    .obj-card {
      background: #ffffff;
      border: 2px solid #18181b;
      border-radius: 18px;
      padding: 1rem;
      box-shadow: 6px 8px 18px rgba(0, 0, 0, 0.12);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      position: relative;
      cursor: pointer;
    }
    .obj-card:hover {
      transform: scale(1.06) rotate(0deg) !important;
      box-shadow: 10px 14px 28px rgba(0, 0, 0, 0.25);
      z-index: 50;
    }
    .obj-card.sticker {
      background: #ffffff;
      border: 2px solid #18181b;
    }
    .obj-card.acrylic {
      background: #fefce8;
      border: 3px solid #18181b;
      box-shadow: 8px 10px 24px rgba(0, 0, 0, 0.18);
    }
    .obj-card.invalid {
      background: #fef2f2;
      border: 2px dashed #dc2626;
      opacity: 0.9;
    }
    .badge {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      margin-bottom: 0.65rem;
      display: inline-block;
    }
    .badge.sticker {
      background: #e0f2fe;
      color: #0369a1;
      border: 1.5px solid #0284c7;
    }
    .badge.acrylic {
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
      width: 175px;
      height: 175px;
      border: 1.5px solid #18181b;
      border-radius: 12px;
      background: #ffffff;
      margin-bottom: 0.5rem;
      display: block;
    }
    .obj-card.invalid .qr-img {
      border-color: #dc2626;
    }
    .obj-title {
      font-size: 0.85rem;
      font-weight: 900;
      color: #18181b;
      margin-bottom: 0.2rem;
    }
    .obj-payload {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.7rem;
      color: #52525b;
      background: #f4f4f5;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      word-break: break-all;
    }
    .obj-card.invalid .obj-payload {
      color: #dc2626;
      background: #fee2e2;
    }
  </style>
</head>
<body>

  <div class="top-bar">
    <div class="top-info">
      <h1>Simulasi Meja: Stiker & Akrilik Lepas Tercecer</h1>
      <p>
        Buka <strong>https://grqrr.netlify.app/sales</strong> di HP Anda, ketuk <strong>"Pindai Kamera Stiker Lepas"</strong>, lalu sapukan kamera melintasi layar monitor untuk menguji deteksi cepat berturut-turut.
      </p>
    </div>
    <button type="button" class="btn-shuffle" onclick="shufflePositions()">
      <span>Acak Posisi Meja (Shuffle)</span>
    </button>
  </div>

  <div class="table-surface" id="table-surface">
    ${shuffledCases
      .map((t, idx) => {
        const cardClass = t.type === "valid_table" ? "sticker" : t.type === "valid_cashier" ? "acrylic" : "invalid";
        const badgeClass = t.type === "valid_table" ? "sticker" : t.type === "valid_cashier" ? "acrylic" : "invalid";
        const badgeText = t.type === "valid_table" ? "Stiker Meja" : t.type === "valid_cashier" ? "Akrilik Kasir" : "Abaikan";
        const tilt = ((idx * 3.7) % 10 - 5).toFixed(1);
        return `
      <div class="obj-card ${cardClass}" style="transform: rotate(${tilt}deg);">
        <span class="badge ${badgeClass}">${badgeText}</span>
        <img src="${t.filename}" class="qr-img" alt="${t.label}">
        <div class="obj-title">${t.label}</div>
        <div class="obj-payload">${t.payload}</div>
      </div>
    `;
      })
      .join("")}
  </div>

  <script>
    function shufflePositions() {
      var container = document.getElementById('table-surface');
      var cards = Array.from(container.children);
      for (var i = cards.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = cards[i];
        cards[i] = cards[j];
        cards[j] = temp;
      }
      cards.forEach(function(card) {
        var angle = (Math.random() * 10 - 5).toFixed(1);
        card.style.transform = 'rotate(' + angle + 'deg)';
        container.appendChild(card);
      });
    }
  </script>

</body>
</html>`;

  fs.writeFileSync(path.join(targetDir, "preview.html"), htmlContent, "utf8");
  console.log("\nPreview HTML sheet generated at: tests/qrs/preview.html");
  console.log("All test QR codes generated successfully!");
}

generateQrs().catch(console.error);
