/**
 * Partnership outreach messages. Deterministic templates that work with no LLM.
 * They never invent a contact person or claim the partner has shown interest, and the app
 * never sends them: the user copies, edits and sends them personally.
 */

export interface OutreachInputs {
  partnerName: string;
  partnerGenre?: string;
  partnerType: "similar" | "complementary" | "host";
  /** The user's product in their own words, or the idea's name. */
  product: string;
  conceptLabel: string;
  modelLabel: string;
  /** One sentence on why this partner fits, written for the partner. */
  whyForPartner: string;
  /** e.g. "2 weekends with 30 pieces" */
  pilotSummary: string;
  city: string;
  senderName?: string;
}

export interface OutreachMessages {
  email: { subject: string; body: string };
  short: string;
}

const PARTNER_BENEFIT: Record<OutreachInputs["partnerType"], string> = {
  similar: "It would add variety for your customers without you having to make anything new, and I would handle production and restocking.",
  complementary: "It would give your customers something extra that you do not currently offer, with no upfront cost to you.",
  host: "It would add something new for your visitors for a weekend, with no setup work on your side.",
};

export function buildOutreach(i: OutreachInputs): OutreachMessages {
  const sender = i.senderName?.trim() || "[Your name]";
  // "I make eggless brownies." becomes "eggless brownies", so it reads well in the sentences below.
  const product = i.product
    .trim()
    .replace(/\.$/, "")
    .replace(/^(i|we)\s+(make|bake|sell|create|craft|design|run|offer)\s+/i, "");
  const model = i.modelLabel.toLowerCase();
  const subject = `Small ${model} trial at ${i.partnerName}?`;
  const body = [
    `Hello ${i.partnerName} team,`,
    "",
    `My name is ${sender}. I run a small ${i.conceptLabel.toLowerCase()} in ${i.city}, making ${product}.`,
    "",
    `I am reaching out because ${i.whyForPartner}. I think a ${model} could work well for both of us. ${PARTNER_BENEFIT[i.partnerType]}`,
    "",
    `To keep it low-risk, I would suggest a short trial: ${i.pilotSummary}. If it does not work for you, we simply stop.`,
    "",
    "Would you be open to a 10-minute chat or a quick visit this week to see some samples? I can work around your schedule.",
    "",
    "Thank you for your time,",
    sender,
    "[Phone number] | [Instagram or website]",
  ].join("\n");
  const short = `Hi ${i.partnerName} team, I'm ${sender}. I make ${product} here in ${i.city}. Would you be open to a small ${model} trial (${i.pilotSummary})? Happy to drop by with samples. Thank you!`;
  return { email: { subject, body }, short };
}
