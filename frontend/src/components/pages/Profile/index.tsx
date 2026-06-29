import { FaqSection } from "@/components/shared/FaqSection";
import { ActivePositions } from "./components/ActivePositions";
import { CreditHistory } from "./components/CreditHistory";
import { PositionsList } from "./components/PositionsList";
import { PrivateWallet } from "./components/PrivateWallet";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileStats } from "./components/ProfileStats";

export function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <ProfileHeader />
      <ProfileStats />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ActivePositions />
        <CreditHistory />
        <PrivateWallet />
      </div>
      <PositionsList />
      <FaqSection />
    </div>
  );
}
