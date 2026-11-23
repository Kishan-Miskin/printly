import { z } from "zod";

export const RegisterShopSchema = z.object({
  email: z.string().email("Please provide a valid email address").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().min(2, "Owner name must be at least 2 characters").max(80),
  shopName: z.string().min(2, "Shop name must be at least 2 characters").max(100),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const UpdateShopSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  hours: z.string().max(100).optional().nullable(),
  is_open: z.boolean().optional(),
  settings: z
    .object({
      retention_hours: z.number().int().min(1).max(720).optional(),
      auto_accept: z.boolean().optional(),
      max_file_size_mb: z.number().min(1).max(100).optional(),
      max_files_per_order: z.number().min(1).max(30).optional(),
      allowed_formats: z.array(z.string()).optional(),
    })
    .optional(),
});

export const FilePrintOptionSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  printColor: z.enum(["BW", "COLOR"]).default("BW"),
  paperSize: z.enum(["A4", "A3", "LEGAL", "LETTER"]).default("A4"),
  duplex: z.enum(["SINGLE", "DOUBLE"]).default("SINGLE"),
  copies: z.coerce.number().int().min(1).max(999).default(1),
  customerRequirements: z.string().max(1000).optional().default(""),
});

export const PickupVerifySchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "Pickup PIN must be exactly 6 digits"),
});

export const OrderStatusUpdateSchema = z.object({
  status: z.enum(["ACCEPTED", "PRINTING", "READY", "COMPLETED", "REJECTED", "CANCELLED", "PRINT_FAILED"]),
});

export const InviteStaffSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["SHOP_OWNER", "SHOP_STAFF"]).default("SHOP_STAFF"),
});
