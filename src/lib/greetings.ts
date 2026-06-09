export type TimeSlot =
  | "early-morning"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "late-night";

export interface GreetingParts {
  before: string;
  highlight?: string;
  after: string;
}

const POOLS: Record<TimeSlot, string[]> = {
  "early-morning": [
    "Early start today, {name}.",
    "You're up with the sun, {name}.",
    "Quiet morning energy, {name}.",
    "Fresh start awaits, {name}.",
  ],
  morning: [
    "Good morning, {name}.",
    "What's on the agenda, {name}?",
    "Ready to dive in, {name}?",
    "Morning momentum, {name}?",
  ],
  afternoon: [
    "What's the vibe for today, {name}?",
    "Good afternoon, {name}.",
    "What's on your mind, {name}?",
    "Midday check-in, {name}?",
  ],
  evening: [
    "Good evening, {name}.",
    "Winding down or diving in, {name}?",
    "Evening session, {name}?",
    "Still going strong, {name}?",
  ],
  night: [
    "It's a quiet night, {name}.",
    "Night mode activated, {name}.",
    "The evening's still young, {name}.",
    "What's the plan tonight, {name}?",
  ],
  "late-night": [
    "It's a late night, {name}.",
    "Still up, {name}?",
    "Burning the midnight oil, {name}?",
    "The quiet hours, {name}.",
  ],
};

const ANYTIME: string[] = [
  "What are you working on, {name}?",
  "What's on your mind, {name}?",
  "Ready when you are, {name}.",
  "Let's make something, {name}.",
  "What can I help with, {name}?",
  "Got something in mind, {name}?",
  "What's the move, {name}?",
  "Pick up where you left off, {name}?",
];

const ANYTIME_NO_NAME: string[] = [
  "What are you working on?",
  "What's on your mind?",
  "What's the vibe for today?",
  "Ready when you are.",
  "What can I help with?",
  "Got something in mind?",
  "What's the move?",
  "Let's make something.",
];

export function getTimeSlot(hour = new Date().getHours()): TimeSlot {
  if (hour >= 5 && hour < 8) return "early-morning";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  if (hour >= 21 && hour < 24) return "night";
  return "late-night";
}

function formatTemplate(template: string, name?: string): GreetingParts {
  const trimmed = name?.trim();
  if (trimmed && template.includes("{name}")) {
    const [before, after = ""] = template.split("{name}");
    return { before, highlight: trimmed, after };
  }
  const plain = template
    .replace(/,?\s*\{name\}/g, "")
    .replace(/\{name\},?\s*/g, "")
    .replace(/\s+/g, " ")
    .replace(/ ,/g, ",")
    .trim();
  return { before: plain, after: "" };
}

/** Picks a greeting seeded by day+hour so it rotates hourly. */
export function getDynamicGreeting(
  displayName?: string,
  now = new Date()
): GreetingParts {
  const slot = getTimeSlot(now.getHours());
  const name = displayName?.trim();
  const pool = name
    ? [...POOLS[slot], ...ANYTIME]
    : [...ANYTIME_NO_NAME, ...ANYTIME_NO_NAME];
  const seed =
    now.getMonth() * 744 +
    now.getDate() * 24 +
    now.getHours() +
    now.getDay();
  const template = pool[seed % pool.length];
  return formatTemplate(template, name);
}
