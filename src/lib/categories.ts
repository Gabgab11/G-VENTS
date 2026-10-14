// The single list of event categories. Must match the check constraint on events.category.
export const CATEGORIES = [
  "Music", "Conferences", "Tech", "Faith", "Arts", "Food", "Sports", "Business",
  "Nightlife", "Education", "Community", "Charity", "Family", "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  Music: "#f0604f",
  Conferences: "#f2a33a",
  Tech: "#6aa8f2",
  Faith: "#e0438f",
  Arts: "#9b6cf2",
  Food: "#e0a03a",
  Sports: "#3fb8a8",
  Business: "#c7d158",
  Nightlife: "#b05cf2",
  Education: "#5fa8d3",
  Community: "#e8735a",
  Charity: "#d65f8a",
  Family: "#7cc47a",
  Other: "#9a9a9f",
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
