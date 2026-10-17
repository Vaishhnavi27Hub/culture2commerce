/** Browsing categories for business ideas. Only categories with at least one idea are shown. */
export type ConceptCategory = "food" | "art" | "fashion" | "experiences" | "home";

export const CATEGORY_LABEL: Record<ConceptCategory, string> = {
  food: "Food & Beverage",
  art: "Art & Crafts",
  fashion: "Fashion",
  experiences: "Experiences",
  home: "Home & Living",
};

export const CATEGORY_ORDER: ConceptCategory[] = ["food", "art", "fashion", "experiences", "home"];
