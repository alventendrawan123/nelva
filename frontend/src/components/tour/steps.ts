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

// Narrated walkthrough of one private loan on Canton. The same connected wallet
// is your identity throughout. Matching runs automatically (the operator's
// auto-matcher); the demo controls (honest vs cheat match, five-party lens) and
// the independent auditor live in terminal scripts — demo/demo.mjs and
// auditor/audit.mjs — so the product UI stays clean.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Nelva",
    body: "A private sealed-bid lending market on Canton. This tour walks the full flow: get funds, lend or borrow, match, settle — with every action a real on-ledger transaction.",
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
    body: "On the Borrow tab you request funds and lock collateral. Required collateral is quoted live from your credit tier, and your max rate stays sealed. Press Next.",
    placement: "bottom",
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "match",
    target: "accept-btn",
    title: "5. The match finds you",
    body: "The operator's engine runs a deterministic, cheapest-first match automatically - a proposal appears here with your blended rate. Accept settles it in ONE atomic transaction: lender funds arrive, collateral escrows, no operator ever holds the money. Press Next.",
    placement: "top",
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "tx-proof",
    target: "tx-history",
    title: "6. Every action is a real transaction",
    body: "Each signed action returns its Canton tx hash - collected here, one click to open it in the built-in explorer, read live from the ledger. Press Next.",
    placement: "bottom",
  },
  {
    id: "outsider",
    target: "status-stats",
    title: "7. Outsiders see only totals",
    body: "The Status view shows public aggregates - no bids, no rates, no identities. Privacy holds for everyone outside the deal. Press Next.",
    placement: "bottom",
    onEnter: (a) => a.setActiveHomeTab("Status"),
  },
  {
    id: "prove-it",
    title: "8. Prove the match was honest",
    body: "Honesty isn't a promise - it's re-runnable. In a terminal: `node demo/demo.mjs cheat` makes the operator publish a dishonest match, and `node auditor/audit.mjs` (an independent process) re-runs the match on-ledger and flips it RED - while an honest one verifies GREEN. A cheat can't even settle: Accept re-validates the match on-ledger.",
  },
  {
    id: "finish",
    title: "That is the full loop",
    body: "Funded, matched, settled privately, with an auditor that can prove honesty or catch a cheat. Restart anytime from the Tour button.",
  },
];
