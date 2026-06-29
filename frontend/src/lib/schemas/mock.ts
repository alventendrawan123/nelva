import { z } from "zod";

export const tokenSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

export const poolSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  network: z.literal("Canton"),
  status: z.enum(["Active", "Paused"]),
  contract: z.string(),
  openBids: z.number(),
  borrowIntents: z.number(),
});

export const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export type Token = z.infer<typeof tokenSchema>;
export type Pool = z.infer<typeof poolSchema>;
export type Faq = z.infer<typeof faqSchema>;
