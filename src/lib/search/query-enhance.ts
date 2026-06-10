const CRITICAL_EVENT_RE =
  /\b(gemini|apollo|mercury|skylab|shuttle|challenger|columbia|soyuz|mission)\b/i;
const FAILURE_RE =
  /\b(failure|abort|accident|explosion|disaster|malfunction|tether|emergency)\b/i;
const ROMAN_MISSION_RE = /\b(gemini|apollo|mercury)\s+[IVXLC]+\b/i;

/** Timeline queries need full Wikipedia extracts even when Brave snippets are long. */
export function needsUnconditionalDeepEnrich(query: string): boolean {
  return (
    /\btimeline\b/i.test(query) ||
    /\bsequence of events\b/i.test(query)
  );
}

/** Detect NASA missions, disasters, and other queries needing authoritative depth. */
export function isCriticalEventQuery(query: string): boolean {
  return (
    CRITICAL_EVENT_RE.test(query) ||
    FAILURE_RE.test(query) ||
    ROMAN_MISSION_RE.test(query) ||
    /\bmission\s+(details|summary|timeline|history)\b/i.test(query)
  );
}

/**
 * Append quality anchors and domain filters so Brave returns substantive
 * mission history instead of generic landing-page previews.
 */
export function enhanceSearchQuery(query: string): string {
  let final = query.trim();
  const lower = final.toLowerCase();

  if (isCriticalEventQuery(final)) {
    if (!/official|timeline|summary|nasa/i.test(final)) {
      final += " NASA official mission timeline summary";
    }
    if (!lower.includes("site:")) {
      final += " site:en.wikipedia.org OR site:nasa.gov";
    }
  }

  if (lower.includes("enterprise") || lower.includes("star trek")) {
    final += " site:en.wikipedia.org OR site:memory-alpha.fandom.com";
  }

  return final.replace(/\s+/g, " ").trim();
}
