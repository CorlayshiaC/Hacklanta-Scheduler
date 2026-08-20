/**
 * Pure types, no runtime code, safe to import from the client component that renders the button
 * row. See docs/contracts/quickchat.md for the full contract.
 */
export type QuickchatQueryKind = "schedule" | "next_event" | "hours" | "coworkers" | "open_shifts";

export const QUICKCHAT_QUERIES: { kind: QuickchatQueryKind; label: string }[] = [
  { kind: "schedule", label: "When am I scheduled" },
  { kind: "next_event", label: "What event is next" },
  { kind: "hours", label: "How many hours do I have" },
  { kind: "coworkers", label: "Who is working with me" },
  { kind: "open_shifts", label: "Open shifts I can take" },
];

export type QuickchatAnswer = {
  text: string;
  /** Where tapping the answer card takes the member. */
  deepLink: string;
  /** True if `text` names another member: never sent to Gemini for rephrasing regardless of
   * budget, per the shared rule against sending personal data to any AI model. */
  containsPersonalData: boolean;
};

export type QuickchatResponse = {
  answer: QuickchatAnswer;
  /** "template" (always returned first) or "rephrased" (a background upgrade, same facts, see
   * docs/contracts/quickchat.md). Never "model" on the first response: the template renders
   * instantly, rephrasing is a strictly-later, optional swap. */
  source: "template" | "rephrased";
};
