export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Explore", href: "/explore" },
  { label: "Profile", href: "/profile" },
] as const;

export const PERSONAS = [
  "Lender",
  "Borrower",
  "Operator",
  "Auditor",
  "Outsider",
] as const;

export type Persona = (typeof PERSONAS)[number];

export const PERSONA_PARTY: Record<Persona, string | undefined> = {
  Lender: "LenderA",
  Borrower: "Borrower",
  Operator: "Operator",
  Auditor: "Auditor",
  Outsider: undefined,
};

export const HOME_TABS = ["Borrow", "Lend", "Lens", "Status"] as const;

export type HomeTab = (typeof HOME_TABS)[number];

export const PERSONA_TABS: Record<Persona, HomeTab[]> = {
  Lender: ["Lend", "Lens", "Status"],
  Borrower: ["Borrow", "Lens", "Status"],
  Operator: ["Lens", "Status"],
  Auditor: ["Lens", "Status"],
  Outsider: ["Status", "Lens"],
};

export const WALLET_ADDRESS = "0xebFA...4179";
