import { Accordion } from "@/components/ui/Accordion";
import { FAQS } from "@/lib/mock/faqs";

export function FaqSection() {
  return (
    <section className="mx-auto mt-16 max-w-3xl">
      <h2 className="mb-2 text-2xl font-bold text-foreground">FAQs</h2>
      <Accordion items={FAQS} />
    </section>
  );
}
