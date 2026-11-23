import React from "react";
import { getPublicShop } from "@/lib/shops";
import CustomerPrintForm from "./CustomerPrintForm";

export default async function CustomerQrPrintPage({
  params,
}: {
  params: Promise<{ shopToken: string }>;
}) {
  const { shopToken } = await params;
  const { shopToken: resolvedToken, shop } = await getPublicShop(shopToken);

  return <CustomerPrintForm shopToken={resolvedToken} initialShop={shop} source="QR" />;
}
