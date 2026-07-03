"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TourProvider } from "@/components/tour/TourContext";
import { TourLauncher } from "@/components/tour/TourLauncher";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { FeedbackProvider } from "@/context/FeedbackContext";
import { PartyProvider } from "@/context/PartyContext";
import { UIProvider } from "@/context/UIContext";
import { WalletProvider } from "@/context/WalletContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 5000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <WalletProvider>
          <PartyProvider>
            <UIProvider>
              <TourProvider>
                {children}
                <TourOverlay />
                <TourLauncher />
              </TourProvider>
            </UIProvider>
          </PartyProvider>
        </WalletProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  );
}
