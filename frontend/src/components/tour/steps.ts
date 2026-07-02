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

// Single-user narrated walkthrough of one private loan. No persona switching —
// the same connected wallet drives every step; the Lens demo controls are public.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Nelva",
    body: "Follow the full lifecycle of one private loan: fund it, match it, settle it to the borrower, and prove the match was honest.",
  },
  {
    id: "lender",
    target: "lend-bids",
    title: "1. Post a sealed bid",
    body: "On the Lend tab you offer funds at a secret rate — rivals cannot see each other's rates. Press Next.",
    placement: "top",
    onEnter: (a) => a.setActiveHomeTab("Lend"),
  },
  {
    id: "borrower-intent",
    target: "borrow-form",
    title: "2. Request a loan",
    body: "On the Borrow tab you ask for funds and lock collateral. Your max rate stays sealed. Press Next.",
    placement: "bottom",
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "operator-run",
    target: "run-match",
    title: "3. Run the match",
    body: "On the Lens tab, click Run Match to pair lenders to the borrower cheapest-first and create a proposal.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "borrower-accept",
    target: "accept-btn",
    title: "4. Accept",
    body: "On the Borrow tab, click Accept — funds move from the lenders to you in one atomic transaction, no operator holding the money.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "loan-live",
    target: "loans-list",
    title: "5. The loan is live",
    body: "The money is now with the borrower and the loan is active. Each lender earns their own rate. Press Next.",
    placement: "top",
    onEnter: (a) => a.setActiveHomeTab("Borrow"),
  },
  {
    id: "auditor-green",
    target: "verify-btn",
    title: "6. Prove it was honest",
    body: "On the Lens tab, click Verify. It re-runs the match over every bid, including losers. An honest match shows GREEN.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "operator-cheat",
    target: "cheat-match",
    title: "7. Try to cheat",
    body: "Click Cheat Match. It secretly skips a cheaper lender and publishes a dishonest proposal.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "auditor-red",
    target: "verify-btn",
    title: "8. The cheat is caught",
    body: "Click Verify again. The badge flips RED with the reason. Private, but a cheater still gets caught.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (a) => a.setActiveHomeTab("Lens"),
  },
  {
    id: "outsider",
    target: "status-stats",
    title: "9. Outsiders see nothing",
    body: "The Status view shows only public totals — no bids, no rates, no identities. Privacy holds for everyone outside the deal. Press Next.",
    placement: "bottom",
    onEnter: (a) => a.setActiveHomeTab("Status"),
  },
  {
    id: "finish",
    title: "That is the full loop",
    body: "Funded to settled privately, with an auditor that can prove honesty or catch a cheat. Restart anytime from the help button.",
  },
];
