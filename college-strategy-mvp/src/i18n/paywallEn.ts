import type { PaywallCopy, PaywallTone } from "../types";

/** English marketing copy for preview paywall (same structure as Chinese packs). */
export const EN_PAYWALL: Record<PaywallTone, PaywallCopy> = {
  rational: {
    eyebrow: "Verifiable · Actionable · Take it with you",
    title: "The preview is a conservative read—the full version shows the basis",
    body: `The overview and information gaps are there to show that the system is reading your known information. The full report expands the basis: “9 full school names + per-school official-site checklist + this-month / pre-submit action table”—so you can see what was judged, what still needs context, and what to verify.

Preview shows one sample per tier on purpose: first check the logic, then decide whether to unlock the full judgment.`,
    bullets: [
      "All 9 school names and tier rationales expanded for checking the system’s read",
      "Per-school “must verify on site”: rounds, international policy, cost definitions",
      "Second half of risks + action plan: helps you add the missing context",
    ],
    ctaPrimary: "Unlock the full-information read (9 schools + verify + actions)",
    ctaHint: "Demo: one click to unlock. Production: pay, then instant unlock.",
    previewLine: "Preview is a conservative read based on current information; full report expands the basis.",
    hookLead:
      "The “name fingerprints” below come from this real generation (not random placeholders). Unlock is not about more words—it is about seeing why the system read you this way.",
    footerTitle: "Still stitching spreadsheets by hand?",
    footerText:
      "Full version expands the judgment basis: what the system saw, what remains uncertain, and what to verify. In demo you can unlock in one click.",
  },
  anxiety: {
    eyebrow: "A wrong list costs more than this fee",
    title: "The risk is not one extra app—it’s trusting an incomplete read",
    body: `Preview already showed direction; what’s hidden is often the 2nd and 3rd school per tier—where parents ask the hardest questions and the judgment depends most on full context: does the safety actually hold, does the reach respect budget and visa status.

When information is incomplete, the system stays conservative. Full version lays out all 9 schools and risk reasoning so you know why the current read says what it says.`,
    bullets: [
      "See each tier’s “hidden” schools: is that really your safety net",
      "Second half of risks: international + aid + variance",
      "Pre-submit checklist: fewer “wrong round / missing material” full rejects",
    ],
    ctaPrimary: "Unlock full report · See the complete risk read",
    ctaHint: "Demo: one click. Production: pay, then all sensitive rows show.",
    previewLine: "Preview is a conservative read; full version shows the full risk basis.",
    hookLead:
      "The three lines below are fingerprints of schools not yet shown by name. They are not scare tactics—they show that the system already made a read; you just have not seen the full basis.",
    footerTitle: "You can close the tab—the holes in the list won’t close themselves",
    footerText:
      "If you’re anxious about your list right now, full version sends you to official sites with the reasoning to verify—not blanks. Demo unlocks in one click.",
  },
  curiosity: {
    eyebrow: "Real names are already in the report—they’re just not lit up yet",
    title: "Guess who: the “second choice” per tier?",
    body: `The second school in each tier has already been judged by the system; preview only shows fingerprints.

If preview felt “kind of accurate,” curiosity will make you want the rest—that’s what full version gives: not suspense for its own sake, but full names, reasons, and verification paths behind it.`,
    bullets: [
      "Reveal full names for the 2nd school in reach / match / safety",
      "Per school: why it sits in that tier and main landmines",
      "Turn guessing into checking: verification items laid out line by line",
    ],
    ctaPrimary: "Unlock the full read · 9 names + reasoning",
    ctaHint: "Demo: one click. Production: pay, instant open.",
    previewLine: "The current read is generated—the full basis is in the full version; read fingerprints first.",
    hookLead:
      "Rule: only first letter and length; full names lock behind unlock. If that matches your guess, you probably should scroll on.",
    footerTitle: "You’re at the edge—might as well read it all",
    footerText: "Full version dumps the 2nd school in all three tiers—no refresh roulette. Demo one-click unlock.",
  },
};
