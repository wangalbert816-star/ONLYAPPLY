import type { PaywallCopy, PaywallTone } from "../types";

/** English marketing copy for preview paywall (same structure as Chinese packs). */
export const EN_PAYWALL: Record<PaywallTone, PaywallCopy> = {
  rational: {
    eyebrow: "Verifiable · Actionable · Take it with you",
    title: "Preview proved the logic—full version saves the time",
    body: `The overview and information gaps you saw are there to build trust. What actually saves time is the full report: “9 full school names + per-school official-site checklist + this-month / pre-submit action table”—ready to paste into your own spreadsheet instead of paging through dozens of admissions sites.

Preview shows one sample per tier on purpose—not to be stingy—but so you can confirm this report is worth what you’d pay next.`,
    bullets: [
      "All 9 school names and tier rationales expanded for finalizing your list",
      "Per-school “must verify on site”: rounds, international policy, cost definitions",
      "Second half of risks + action plan: aligned with application season rhythm",
    ],
    ctaPrimary: "Unlock full report · Executable checklist (9 schools + verify + actions)",
    ctaHint: "Demo: one click to unlock. Production: pay, then instant unlock.",
    previewLine: "Preview shows logic and samples—full version saves alignment time with parents.",
    hookLead:
      "The “name fingerprints” below come from this real generation (not random placeholders). Unlock isn’t about more words—it’s exporting finalized data into your decision once.",
    footerTitle: "Still stitching spreadsheets by hand?",
    footerText:
      "Full version trades structure for nights of random site-hopping. In demo you can unlock in one click to see everything.",
  },
  anxiety: {
    eyebrow: "A wrong list costs more than this fee",
    title: "The scary part isn’t one extra app—it’s “feeling safe” without a net",
    body: `Preview already showed direction; what’s hidden is often the 2nd and 3rd school per tier—where parents ask the hardest questions and mistakes hide: does the safety actually hold, does the reach respect budget and visa status.

If those rows are wrong, the loss isn’t the unlock fee—it’s rounds, materials, stress, and optionality. Full version lays out all 9 schools and risk responses so you at least know what you’re betting on.`,
    bullets: [
      "See each tier’s “hidden” schools: is that really your safety net",
      "Second half of risks: international + aid + variance",
      "Pre-submit checklist: fewer “wrong round / missing material” full rejects",
    ],
    ctaPrimary: "Unlock full report · Spread the risks before you commit",
    ctaHint: "Demo: one click. Production: pay, then all sensitive rows show.",
    previewLine: "Preview is enough to feel the tone—not enough to sign a list—that’s full version.",
    hookLead:
      "The three lines below are fingerprints of schools not yet shown by name. They’re not scare tactics—they remind you: the list is already in the system; you just haven’t seen all of it.",
    footerTitle: "You can close the tab—the holes in the list won’t close themselves",
    footerText:
      "If you’re anxious about your list right now, full version at least sends you to official sites with questions—not blanks. Demo unlocks in one click.",
  },
  curiosity: {
    eyebrow: "Real names are already in the report—they’re just not lit up yet",
    title: "Guess who: the “second choice” per tier?",
    body: `The second school in each tier is already in the model’s JSON; preview only shows fingerprints.

If preview felt “kind of accurate,” curiosity will make you want the rest—that’s what full version gives: not suspense for its own sake, but full names, reasons, and verification paths behind it.`,
    bullets: [
      "Reveal full names for the 2nd school in reach / match / safety",
      "Per school: why it sits in that tier and main landmines",
      "Turn guessing into checking: verification items laid out line by line",
    ],
    ctaPrimary: "Reveal answers · Unlock 9 names + deep rows",
    ctaHint: "Demo: one click. Production: pay, instant open.",
    previewLine: "Draft is generated—the reveal is in full version; read fingerprints first.",
    hookLead:
      "Rule: only first letter and length; full names lock behind unlock. If that matches your guess, you probably should scroll on.",
    footerTitle: "You’re at the edge—might as well read it all",
    footerText: "Full version dumps the 2nd school in all three tiers—no refresh roulette. Demo one-click unlock.",
  },
};
