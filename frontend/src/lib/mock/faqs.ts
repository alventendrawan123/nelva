import { faqSchema } from "@/lib/schemas/mock";
import type { Faq } from "@/types/domain";

export const FAQS: Faq[] = faqSchema.array().parse([
  {
    question: "What is Nelva?",
    answer:
      "Nelva is a private, sealed-bid peer-to-peer lending market built natively on Canton. Lenders bid interest rates in secret, a deterministic engine matches them to borrowers, and an auditor can prove every match was honest without ever opening a single bid.",
  },
  {
    question: "How are lending rates discovered?",
    answer:
      "Lenders submit sealed interest-rate bids that rivals cannot see, because privacy is structural to Canton's signatory and observer model rather than encryption. Pricing is discriminatory (pay-as-bid), so each lender earns their own rate and honest bidding is the best strategy.",
  },
  {
    question: "What is auditable matching?",
    answer:
      "An independent auditor re-runs the exact same cheapest-first match over all bids, including the losing ones. If the result matches, the badge is green. If the operator skipped a cheaper lender, the badge turns red. The market stays private, but a cheater still gets caught.",
  },
  {
    question: "Can the operator see my bid?",
    answer:
      "Yes. We do not overclaim: the operator can read the bids, so this is not a blind enclave. The guarantee is privacy from rivals plus match honesty through the auditor. The auditor needs a shared key to read cleartext rates, which is an MVP limitation.",
  },
  {
    question: "How do credit tiers and collateral work?",
    answer:
      "Borrowers earn credit tiers from Bronze up to Platinum, which become more collateral-efficient over time. Loans are over-collateralized and the ledger enforces it; unhealthy loans are liquidated automatically using a mocked, operator-signed price oracle for the demo.",
  },
  {
    question: "Is Nelva safe?",
    answer:
      "Settlement is atomic with no operator custody, funds are always conserved, and over-collateralization is enforced by the ledger. Honest caveats: funds are locked at bid time (with a withdraw path after the deadline), the price oracle is mocked, and everything is 100% Canton with no EVM, ZK, or FHE.",
  },
]);
