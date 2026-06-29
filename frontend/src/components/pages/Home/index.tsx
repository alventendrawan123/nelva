import { FaqSection } from "@/components/shared/FaqSection";
import { BorrowPanel } from "./components/BorrowPanel";
import { HomeTabs } from "./components/HomeTabs";
import { LendPanel } from "./components/LendPanel";
import { LensPanel } from "./components/LensPanel";
import { StatusPanel } from "./components/StatusPanel";

export function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <HomeTabs
        panels={{
          Borrow: <BorrowPanel />,
          Lend: <LendPanel />,
          Lens: <LensPanel />,
          Status: <StatusPanel />,
        }}
      />
      <FaqSection />
    </div>
  );
}
