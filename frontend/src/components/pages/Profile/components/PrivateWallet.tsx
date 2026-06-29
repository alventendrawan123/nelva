"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SUPPORTED_TOKENS } from "@/lib/mock/tokens";

export function PrivateWallet() {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <Card className="flex flex-col p-6">
      <h2 className="mb-6 text-lg font-bold text-foreground">Private Wallet</h2>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        {isRevealed ? (
          <ul className="w-full space-y-2">
            {SUPPORTED_TOKENS.map((token) => (
              <li
                key={token.symbol}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm"
              >
                <span className="text-muted">{token.name}</span>
                <span className="font-semibold text-foreground">
                  0 {token.symbol}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Button onClick={() => setIsRevealed(true)}>Fetch Balances</Button>
        )}
      </div>
    </Card>
  );
}
