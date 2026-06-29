import { tokenSchema } from "@/lib/schemas/mock";
import type { Token } from "@/types/domain";

export const NUSD: Token = tokenSchema.parse({
  symbol: "nUSD",
  name: "Nelva USD",
});

export const COLLATERAL: Token = tokenSchema.parse({
  symbol: "COLL",
  name: "Nelva Collateral",
});

export const SUPPORTED_TOKENS: Token[] = [NUSD, COLLATERAL];
