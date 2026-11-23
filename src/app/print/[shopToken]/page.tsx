import React from "react";
import { getPublicShop } from "@/lib/shops";
import CustomerPrintForm from "@/app/p/[shopToken]/CustomerPrintForm";

export default async function PrintShopDiscoveryPage({
  params,
}: {
  params: Promise<{ shopToken: string }>;
}) {
  const { shopToken } = await params;
  const { shopToken: resolvedToken, shop } = await getPublicShop(shopToken);

  return <CustomerPrintForm shopToken={resolvedToken} initialShop={shop} source="DIRECTORY" />;
}
