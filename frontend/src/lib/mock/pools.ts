import { poolSchema } from "@/lib/schemas/mock";
import type { Pool } from "@/types/domain";

export const POOLS: Pool[] = poolSchema.array().parse([
  {
    id: "pool-nusd",
    name: "Nelva USD",
    symbol: "nUSD",
    network: "Canton",
    status: "Active",
    contract: "0xD318...f743",
    openBids: 0,
    borrowIntents: 0,
  },
  {
    id: "pool-coll",
    name: "Nelva Collateral",
    symbol: "COLL",
    network: "Canton",
    status: "Active",
    contract: "0x81aF...cbA6",
    openBids: 0,
    borrowIntents: 0,
  },
]);
