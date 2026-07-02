export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Explore", href: "/explore" },
  { label: "Profile", href: "/profile" },
] as const;

// Single-user, connect-first: the connected wallet is the only identity. There
// is no persona switcher — a connected party can borrow, lend, and see its own
// status; the Lens stays a public transparency view.
export const HOME_TABS = ["Borrow", "Lend", "Lens", "Status"] as const;

export type HomeTab = (typeof HOME_TABS)[number];
