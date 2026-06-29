import type { HomeTab, Persona } from "@/config/nav";

export type TourActions = {
  setPersona: (persona: Persona) => void;
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

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Nelva",
    body: "A private sealed-bid lending market on Canton. This tour walks the full flow and asks you to click each button yourself, all the way to the auditor catching a cheat.",
  },
  {
    id: "persona",
    target: "persona",
    title: "Pick a perspective",
    body: "This switcher decides who you are. Each party sees different data from the same ledger. The tour switches it for you as we go.",
    placement: "bottom",
  },
  {
    id: "tabs",
    target: "home-tabs",
    title: "Four actions",
    body: "Borrow, Lend, Lens, and Status. We start at Lend.",
    placement: "bottom",
    onEnter: (actions) => {
      actions.setPersona("Lender");
      actions.setActiveHomeTab("Lend");
    },
  },
  {
    id: "lend",
    target: "lend-form",
    title: "Lend privately",
    body: "As a Lender you set a sealed rate and deposit funds. Type an amount and rate if you like, then press Next. Demo data already seeded two lenders.",
    placement: "top",
  },
  {
    id: "run-match",
    target: "run-match",
    title: "Click Run Match",
    body: "Now you are the Operator. Click the highlighted Run Match button to match lenders to a borrower cheapest-first.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (actions) => {
      actions.setPersona("Operator");
      actions.setActiveHomeTab("Lens");
    },
  },
  {
    id: "lens-columns",
    target: "lens-columns",
    title: "One ledger, five views",
    body: "Each column shows only what that party may see. The Outsider column hides every bid and rate - that is the privacy, live on screen. Press Next.",
    placement: "top",
  },
  {
    id: "verify-green",
    target: "verify-btn",
    title: "Click Auditor Verify",
    body: "Click the highlighted Auditor Verify. The auditor re-runs the match over every bid. An honest match shows a GREEN badge.",
    placement: "top",
    clickToAdvance: true,
  },
  {
    id: "cheat",
    target: "cheat-match",
    title: "Now click Cheat Match",
    body: "Click the highlighted Cheat Match. The operator secretly skips a cheaper lender. The Lens switches to the dishonest proposal.",
    placement: "bottom",
    clickToAdvance: true,
  },
  {
    id: "verify-red",
    target: "verify-btn",
    title: "Click Auditor Verify again",
    body: "Click Auditor Verify once more. The badge flips RED with the reason a cheaper lend was skipped. Private, but a cheater still gets caught.",
    placement: "top",
    clickToAdvance: true,
  },
  {
    id: "finish",
    title: "You did the whole flow",
    body: "Lend, match, verify honest, cheat, and caught. Explore on your own, or restart this tour from the help button at the bottom-right.",
  },
];
