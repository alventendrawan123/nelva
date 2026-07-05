import type { HomeTab } from "@/config/nav";

export type TourActions = {
  setActiveHomeTab: (tab: HomeTab) => void;
};

export type TourStep = {
  id: string;
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom";
  clickToAdvance?: boolean;
  onEnter?: (actions: TourActions) => void;
};

// Narrated demo walkthrough of one private loan on Canton. The same connected
// wallet is your identity throughout; the Lens demo controls (run/cheat/verify)
// are public so the whole story plays from a single session.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Nelva",
    body: "A private sealed-bid lending market on Canton. This tour walks the full flow: get funds, lend or borrow, match, settle, and prove the match was honest.",
  },
  {
    id: "connect",
    target: "connect-wallet",
    title: "1. Connect a wallet",
    body: "Your wallet is your identity. Click to connect - the Quick wallet is instant and needs no setup. (If you are already connected, press Next.)",
    placement: "bottom",
    clickToAdvance: true,
  },
  {
    id: "faucet",
    target: "faucet",
    title: "2. You're funded",
    body: "Connecting auto-funds your wallet with test nUSD - see the balance next to this button. Need more? Click Faucet any time to top up. Press Next.",
    placement: "bottom",
  },
  {
    id: "lend",
    target: "lend-form",
    title: "3. Lend at a sealed rate",
    body: "On the Lend tab you offer funds at a secret rate. No rival can read your rate - privacy is structural to Canton, not encryption. Press Next.",
    placement: "top",
    onEnter: (a) => a.setActiveHomeTab("Lend"),
  },
  {
    id: "borrow",
    target: "borrow-form",
    title: "4. Or borrow with collateral",
    body: "On the Borrow tab you request funds and lock collateral. Required collateral is quoted live, and your max rate stays sealed. Press Next.",
    placement: "bottom",
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "run-match",
    target: "run-match",
    title: "5. Run the match",
    body: "On the Lens tab, click Run Match. The operator pairs lenders to a borrower cheapest-first and publishes a proposal.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "accept",
    target: "accept-btn",
    title: "6. Settle to the borrower",
    body: "On the Borrow tab, Accept moves funds from the lenders to the borrower in one atomic transaction - no operator ever holds the money. (Only your own proposals show an Accept button.) Press Next.",
    placement: "top",
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "lens-columns",
    target: "lens-columns",
    title: "7. One ledger, five views",
    body: "Each column shows only what that party may see: the operator sees ALL rates, a lender sees only its own, the outsider sees nothing. Canton privacy, live. Press Next.",
    placement: "top",
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "verify-green",
    target: "verify-btn",
    title: "8. Prove it was honest",
    body: "Click Auditor Verify. It re-runs the match over every bid, including the losers. An honest match shows a GREEN badge.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "cheat",
    target: "cheat-match",
    title: "9. Try to cheat",
    body: "Click Cheat Match. The operator secretly skips a cheaper lender and publishes a dishonest proposal.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "verify-red",
    target: "verify-btn",
    title: "10. The cheat is caught",
    body: "Click Auditor Verify again. The badge flips RED with the reason. Private, but a cheater still gets caught - this is the differentiator.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "outsider",
    target: "status-stats",
    title: "11. Outsiders see only totals",
    body: "The Status view shows public aggregates - no bids, no rates, no identities. Privacy holds for everyone outside the deal. Press Next.",
    placement: "bottom",
    onEnter: (a) => a.setActiveHomeTab("Status"),
  },
  {
    id: "finish",
    title: "That is the full loop",
    body: "Funded, matched, settled privately, with an auditor that can prove honesty or catch a cheat. Restart anytime from the Tour button.",
  },
];
