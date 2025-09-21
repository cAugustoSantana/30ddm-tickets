// convex/events.ts
import { query } from "convex/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Computes current availability for an event.
 * Return shape matches your existing usage.
 */
export const checkAvailability = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }: { eventId: Id<"events"> }) => {
    // 1) Load the event
    const event = await ctx.db.get(eventId);
    if (!event) {
      // Keep this throw typed; callers should handle 404s as they prefer
      throw new Error("Event not found");
    }

    // 2) Derive totals
    const totalTickets = Number(event.totalTickets ?? 0);

    // 3) Count purchased/claimed tickets for this event
    // Adjust collection names/filters to your schema.
    // Example assumes a "tickets" table with fields: eventId, status ('purchased'|'reserved'|...)
    const purchasedCursor = ctx.db
      .query("tickets")
      .withIndex("by_event", q => q.eq("eventId", eventId))
      .filter(q => q.eq(q.field("status"), "purchased"));

    let purchasedCount = 0;
    for await (const _ of purchasedCursor) purchasedCount++;

    // 4) Count active offers/holds that block availability (if applicable)
    // If you don't track "offers"/"holds", leave 0.
    const offersCursor = ctx.db
      .query("offers")
      .withIndex("by_event", q => q.eq("eventId", eventId))
      .filter(q => q.eq(q.field("active"), true));

    let activeOffers = 0;
    for await (const _ of offersCursor) activeOffers++;

    // 5) Compute availability
    const used = purchasedCount + activeOffers;
    const availableSpots = Math.max(0, totalTickets - used);
    const available = availableSpots > 0;

    return {
      available,
      availableSpots,
      totalTickets,
      purchasedCount,
      activeOffers,
    };
  },
});
