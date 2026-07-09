import type { Metadata } from "next";
import { ProfilePage } from "@/components/pages/Profile";

export const metadata: Metadata = { title: "Profile - Nelva" };
export default function Page() {
  return <ProfilePage />;
}
