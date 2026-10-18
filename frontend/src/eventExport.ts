import type { EventFilters, RiskEvent } from "./api";

export type EventPageFetcher = (filters: EventFilters) => Promise<RiskEvent[]>;

/** Loads all event pages using the API's documented maximum page size. */
export async function loadAllEvents(
  fetchPage: EventPageFetcher,
  filters: EventFilters,
  pageSize = 500,
): Promise<RiskEvent[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new RangeError("Event export page size must be an integer between 1 and 500.");
  }

  const events: RiskEvent[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage({ ...filters, limit: pageSize, offset });
    events.push(...page);
    if (page.length < pageSize) return events;
    offset += page.length;
  }
}
