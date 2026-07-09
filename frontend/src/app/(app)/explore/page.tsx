import type { Metadata } from "next";
import { ExplorePage } from "@/components/pages/Explore";

export const metadata: Metadata = { title: "Explore - Nelva" };
export default function Page() {
  return <ExplorePage />;
}
