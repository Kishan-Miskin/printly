import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";

// Haversine distance in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export async function GET(request: Request) {
  try {
    await ensureSeedData();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const city = searchParams.get("city")?.trim() || "";
    const userLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
    const userLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null;
    const maxDistance = searchParams.get("maxDistance") ? parseFloat(searchParams.get("maxDistance")!) : null;
    const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 20), 50);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const offset = (page - 1) * limit;

    interface ShopListRow {
      id: string;
      name: string;
      slug: string;
      public_token: string;
      description: string | null;
      city: string | null;
      locality: string | null;
      address: string | null;
      hours: string | null;
      is_open: number;
      settings: string;
      latitude: number | null;
      longitude: number | null;
    }

    let sql = `
      SELECT id, name, slug, public_token, description, city, locality, address, hours, is_open, settings, latitude, longitude
      FROM shops
      WHERE listed = 1 AND active = 1
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];

    if (query) {
      sql += ` AND (name LIKE ? OR locality LIKE ? OR city LIKE ? OR description LIKE ?)`;
      const pattern = `%${query}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (city) {
      sql += ` AND city LIKE ?`;
      params.push(`%${city}%`);
    }

    // Get total count
    let countSql = `
      SELECT COUNT(*) as total
      FROM shops
      WHERE listed = 1 AND active = 1
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countParams: any[] = [];
    if (query) {
      countSql += ` AND (name LIKE ? OR locality LIKE ? OR city LIKE ? OR description LIKE ?)`;
      const pattern = `%${query}%`;
      countParams.push(pattern, pattern, pattern, pattern);
    }
    if (city) {
      countSql += ` AND city LIKE ?`;
      countParams.push(`%${city}%`);
    }

    const countResult = queryOne<{ total: number }>(countSql, ...countParams);
    const total = countResult?.total || 0;

    sql += ` ORDER BY is_open DESC, name ASC`;
    const rows = queryAll<ShopListRow>(sql, ...params);

    // Reference center of Belagavi demo area for default relative distance if user hasn't provided location
    const defaultCenterLat = 15.8600;
    const defaultCenterLng = 74.5050;

    let centers = rows.map((r, index) => {
      let allowedFormats = ["pdf", "jpg", "jpeg", "png", "docx"];
      try {
        const parsed = JSON.parse(r.settings);
        if (parsed.allowed_formats) allowedFormats = parsed.allowed_formats;
      } catch {}

      const shopLat = r.latitude !== null && r.latitude !== undefined ? Number(r.latitude) : 15.8647 + index * 0.005;
      const shopLng = r.longitude !== null && r.longitude !== undefined ? Number(r.longitude) : 74.5089 + index * 0.004;

      let distanceKm: number;
      let hasRealLocation = false;

      if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
        distanceKm = calculateDistanceKm(userLat, userLng, shopLat, shopLng);
        hasRealLocation = true;
      } else {
        // Approximate relative distance within city locality
        distanceKm = calculateDistanceKm(defaultCenterLat, defaultCenterLng, shopLat, shopLng);
      }

      return {
        name: r.name,
        slug: r.slug,
        publicToken: r.public_token,
        description: r.description || "Digital printing, copy, scan & binding services.",
        city: r.city || "Belagavi",
        locality: r.locality || "Central",
        address: r.address || "",
        hours: r.hours || "Open during standard business hours",
        isOpen: r.is_open === 1,
        services: ["Print", "Copy", "Scan", "Binding"],
        allowedFormats,
        uploadUrl: `/print/${r.slug}`,
        latitude: shopLat,
        longitude: shopLng,
        distanceKm,
        distanceFormatted: `${distanceKm.toFixed(1)} km`,
        hasRealLocation,
      };
    });

    // If maxDistance filter requested
    if (maxDistance !== null && !isNaN(maxDistance)) {
      centers = centers.filter((c) => c.distanceKm <= maxDistance);
    }

    // Sort by distance if user provided location or requesting nearby
    if (userLat !== null || searchParams.has("nearby")) {
      centers.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // Paginate
    const paginatedCenters = centers.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      centers: paginatedCenters,
      total: centers.length,
      page,
      limit,
      hasMore: offset + paginatedCenters.length < centers.length,
    });
  } catch (err: unknown) {
    console.error("Print centers discovery API error:", err);
    return NextResponse.json({ error: "Failed to load print centers" }, { status: 500 });
  }
}
