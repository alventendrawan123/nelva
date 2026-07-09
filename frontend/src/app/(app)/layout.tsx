import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "@/lib/query/Providers";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Providers>
      <Navbar />
      <main className="flex-1">{children}</main>
    </Providers>
  );
}
