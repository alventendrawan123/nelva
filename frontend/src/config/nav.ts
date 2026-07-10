export const NAV_LINKS = [
  { label: "Home", href: "/app" },
  { label: "Explore", href: "/explore" },
  { label: "Profile", href: "/profile" },
] as const;

// Single-user, connect-first: the connected wallet is the only identity. There
// is no persona switcher — a connected party can borrow, lend, and see its own
// status. The multi-perspective demo (run/cheat match, five-party lens) lives in
// terminal scripts (demo/demo.mjs + auditor/audit.mjs), keeping the product UI clean.
export const HOME_TABS = ["Borrow", "Lend", "Status"] as const;

export type HomeTab = (typeof HOME_TABS)[number];
