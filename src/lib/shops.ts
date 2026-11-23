import { queryOne } from "./db";
import { ensureSeedData } from "./seed";

export interface PublicShopData {
  name: string;
  phone: string | null;
  address: string | null;
  hours: string | null;
  isOpen: boolean;
  publicToken: string;
  slug: string;
  settings: {
    maxFileSizeMb: number;
    maxFilesPerOrder: number;
    allowedFormats: string[];
    paperOptions: string[];
    colorOptions: string[];
    duplexOptions: string[];
  };
}

export async function getPublicShop(
  identifier: string
): Promise<{ shopToken: string; shop: PublicShopData | null }> {
  await ensureSeedData();

  interface PublicShopRow {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    hours: string | null;
    is_open: number;
    public_token: string;
    slug: string;
    settings: string;
  }

  const shopRow = queryOne<PublicShopRow>(
    `
    SELECT id, name, phone, address, hours, is_open, public_token, slug, settings
    FROM shops
    WHERE (public_token = ? OR slug = ?) AND active = 1
  `,
    identifier,
    identifier
  );

  if (!shopRow) {
    return { shopToken: identifier, shop: null };
  }

  let parsedSettings = {
    retention_hours: 24,
    max_file_size_mb: 20,
    max_files_per_order: 10,
    allowed_formats: ["pdf", "jpg", "jpeg", "png", "docx"],
  };

  try {
    parsedSettings = { ...parsedSettings, ...JSON.parse(shopRow.settings) };
  } catch {
    // Use defaults
  }

  const shop: PublicShopData = {
    name: shopRow.name,
    phone: shopRow.phone,
    address: shopRow.address,
    hours: shopRow.hours,
    isOpen: shopRow.is_open === 1,
    publicToken: shopRow.public_token,
    slug: shopRow.slug,
    settings: {
      maxFileSizeMb: parsedSettings.max_file_size_mb,
      maxFilesPerOrder: parsedSettings.max_files_per_order,
      allowedFormats: parsedSettings.allowed_formats,
      paperOptions: ["A4", "A3", "Legal", "Letter"],
      colorOptions: ["Black & White", "Color"],
      duplexOptions: ["Single-sided", "Double-sided"],
    },
  };

  return { shopToken: shopRow.public_token, shop };
}
