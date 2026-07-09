import type { Metadata } from "next";
import { HomePage } from "@/components/pages/Home";

export const metadata: Metadata = { title: "App - Nelva" };
export default function Page() {
  return <HomePage />;
}
