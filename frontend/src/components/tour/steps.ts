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
    body: "Follow the full lifecycle of one private loan: a lender funds it, the operator matches it, the money lands with the borrower, and the auditor proves the match was honest.",
  },
  {
    id: "persona",
    target: "persona",
    title: "The five parties",
    body: "Lender, Borrower, Operator, Auditor, Outsider. The tour switches between them so you experience the deal from every side.",
    placement: "bottom",
  },
  {
    id: "lender",
    target: "lend-bids",
    title: "1. Lender posts a sealed bid",
    body: "As a Lender you offer funds at a secret rate. Here are the open sealed bids - rivals cannot see each other's rates. Press Next.",
    placement: "top",
    onEnter: (actions) => {
      actions.setPersona("Lender");
      actions.setActiveHomeTab("Lend");
    },
  },
  {
    id: "borrower-intent",
    target: "borrow-form",
    title: "2. Borrower requests a loan",
    body: "As a Borrower you ask for funds and lock collateral. Your max rate stays sealed. Press Next.",
    placement: "bottom",
    onEnter: (actions) => {
      actions.setPersona("Borrower");
      actions.setActiveHomeTab("Borrow");
    },
  },
  {
    id: "operator-run",
    target: "run-match",
    title: "3. Operator runs the match",
    body: "Now the Operator. Click Run Match to pair lenders to the borrower cheapest-first and create a proposal.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (actions) => {
      actions.setPersona("Operator");
      actions.setActiveHomeTab("Lens");
    },
  },
  {
    id: "borrower-accept",
    target: "accept-btn",
    title: "4. Borrower accepts",
    body: "Back as the Borrower. Click Accept - funds move from the lenders to you in a single atomic transaction, with no operator holding the money.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (actions) => {
      actions.setPersona("Borrower");
      actions.setActiveHomeTab("Borrow");
    },
  },
  {
    id: "loan-live",
    target: "loans-list",
    title: "5. The loan is live",
    body: "The money is now with the borrower and the loan is active. Lenders are matched, each earning their own rate. Press Next.",
    placement: "top",
    onEnter: (actions) => {
      actions.setPersona("Borrower");
      actions.setActiveHomeTab("Borrow");
    },
  },
  {
    id: "auditor-green",
    target: "verify-btn",
    title: "6. Auditor proves it was honest",
    body: "As the Auditor, click Auditor Verify. It re-runs the match over every bid, including losers. An honest match shows GREEN.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (actions) => {
      actions.setPersona("Auditor");
      actions.setActiveHomeTab("Lens");
    },
  },
  {
    id: "operator-cheat",
    target: "cheat-match",
    title: "7. Operator tries to cheat",
    body: "Back as the Operator, click Cheat Match. It secretly skips a cheaper lender and publishes a dishonest proposal.",
    placement: "bottom",
    clickToAdvance: true,
    onEnter: (actions) => {
      actions.setPersona("Operator");
      actions.setActiveHomeTab("Lens");
    },
  },
  {
    id: "auditor-red",
    target: "verify-btn",
    title: "8. Auditor catches it",
    body: "As the Auditor again, click Auditor Verify. The badge flips RED with the reason. Private, but a cheater still gets caught.",
    placement: "top",
    clickToAdvance: true,
    onEnter: (actions) => {
      actions.setPersona("Auditor");
      actions.setActiveHomeTab("Lens");
    },
  },
  {
    id: "outsider",
    target: "status-stats",
    title: "9. The outsider sees nothing",
    body: "An Outsider only sees public totals - no bids, no rates, no identities. Privacy holds for everyone outside the deal. Press Next.",
    placement: "bottom",
    onEnter: (actions) => {
      actions.setPersona("Outsider");
      actions.setActiveHomeTab("Status");
    },
  },
  {
    id: "finish",
    title: "That is the full loop",
    body: "Lender to borrower, matched and settled privately, with an auditor that can prove honesty or catch a cheat. Restart anytime from the help button.",
  },
];
