import { Buffer } from "node:buffer";

/**
 * Google Place ID Parser & Protobuf Encoder
 * Resolves Google Maps URLs (short links, place URLs, CID URLs, or direct Place IDs)
 * into canonical Google Place ID (ChIJ...) and direct review URLs.
 */

export interface GooglePlaceInfo {
  placeId: string;
  cid: string;
  hexCellId: string;
  hexFeatureId: string;
  directReviewUrl: string;
  mapsUrl: string;
  coordinates?: { lat: number; lng: number };
  name?: string;
  address?: string;
}

/**
 * Encodes a pair of 64-bit Hex strings into a standard Google Place ID (ChIJ...)
 * @param hexCellId S2 Cell ID / Query ID (e.g. "0x2e68e9d2a1bef62d")
 * @param hexFeatureId Feature Fingerprint / CID (e.g. "0x28e421c251500c38")
 */
export function encodePlaceId(hexCellId: string, hexFeatureId: string): string {
  const cleanHex1 = hexCellId.startsWith("0x") ? hexCellId : `0x${hexCellId}`;
  const cleanHex2 = hexFeatureId.startsWith("0x") ? hexFeatureId : `0x${hexFeatureId}`;

  // Google PlaceId Wire Format (20 bytes):
  // 0a (length-delimited tag) 12 (18 bytes payload)
  // 09 (tag 1: fixed64) [8 bytes little-endian hex1]
  // 11 (tag 2: fixed64) [8 bytes little-endian hex2]
  const buf = Buffer.alloc(20);
  buf.writeUInt8(0x0a, 0);
  buf.writeUInt8(0x12, 1);
  buf.writeUInt8(0x09, 2);
  buf.writeBigUInt64LE(BigInt(cleanHex1), 3);
  buf.writeUInt8(0x11, 11);
  buf.writeBigUInt64LE(BigInt(cleanHex2), 12);

  return buf.toString("base64url");
}

/**
 * Extracts Place info from any Google Maps URL or raw Place ID
 */
export async function parseGoogleMapsUrl(inputUrl: string): Promise<GooglePlaceInfo> {
  let targetUrl = inputUrl.trim();

  // 1. If input is a raw Place ID (ChIJ...)
  if (/^ChIJ[A-Za-z0-9_-]{20,}$/.test(targetUrl)) {
    return {
      placeId: targetUrl,
      cid: "",
      hexCellId: "",
      hexFeatureId: "",
      directReviewUrl: `https://search.google.com/local/writereview?placeid=${targetUrl}`,
      mapsUrl: `https://search.google.com/local/writereview?placeid=${targetUrl}`,
    };
  }

  // 2. If input is already a direct writereview URL with placeid
  const directMatch = targetUrl.match(/[?&]placeid=([A-Za-z0-9_-]+)/);
  if (directMatch) {
    const pId = directMatch[1];
    return {
      placeId: pId,
      cid: "",
      hexCellId: "",
      hexFeatureId: "",
      directReviewUrl: `https://search.google.com/local/writereview?placeid=${pId}`,
      mapsUrl: targetUrl,
    };
  }

  // 3. If input is a short link (e.g. maps.app.goo.gl or goo.gl/maps or share link), resolve redirects
  if (targetUrl.includes("goo.gl") || targetUrl.includes("maps.app.goo.gl") || targetUrl.includes("/share/")) {
    try {
      const response = await fetch(targetUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      targetUrl = response.url || targetUrl;
    } catch {
      try {
        const response = await fetch(targetUrl, {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        targetUrl = response.url || targetUrl;
      } catch (e) {}
    }
  }

  // 4. Extract feature ID / cell ID:
  // Can be !1s0x...:0x... (Desktop) OR ftid=0x...:0x... (Mobile App Share)
  const featureIdMatch = targetUrl.match(/(?:!1s|[?&]ftid=)(0x[0-9a-fA-F]+):(0x[0-9a-fA-F]+)/);
  let placeId = "";
  let cid = "";
  let hexCellId = "";
  let hexFeatureId = "";

  if (featureIdMatch) {
    hexCellId = featureIdMatch[1].toLowerCase();
    hexFeatureId = featureIdMatch[2].toLowerCase();
    placeId = encodePlaceId(hexCellId, hexFeatureId);
    cid = BigInt(hexFeatureId).toString();
  } else {
    // Check if CID is directly in query params (?cid=...)
    const cidMatch = targetUrl.match(/[?&]cid=([0-9]+)/);
    if (cidMatch) {
      cid = cidMatch[1];
      const cidBigInt = BigInt(cidMatch[1]);
      hexFeatureId = `0x${cidBigInt.toString(16)}`;
    } else {
      throw new Error("Link Google Maps tidak memuat ID lokasi (!1s0x... atau ftid). Pastikan link berasal dari Google Maps toko.");
    }
  }

  // 5. Extract Business Name & Address
  let name: string | undefined;
  let address: string | undefined;

  // Case A: From query param q (Mobile share format: q=Name,+Address...)
  try {
    const urlObj = new URL(targetUrl);
    const qParam = urlObj.searchParams.get("q");
    if (qParam) {
      const parts = qParam.split(",");
      name = parts[0].trim();
      if (parts.length > 1) {
        address = parts.slice(1).join(",").trim();
      }
    }
  } catch (e) {}

  // Case B: From path /place/Name/@... (Desktop format)
  if (!name) {
    const nameMatch = targetUrl.match(/\/place\/([^/@?]+)/);
    if (nameMatch) {
      name = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
    }
  }

  // 6. Extract Coordinates if present
  let coordinates: { lat: number; lng: number } | undefined;
  const coordMatch = targetUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    coordinates = {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2]),
    };
  }

  return {
    placeId,
    cid,
    hexCellId,
    hexFeatureId,
    name,
    address,
    directReviewUrl: placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : `https://maps.google.com/?cid=${cid}`,
    mapsUrl: `https://maps.google.com/?cid=${cid}`,
  };
}
