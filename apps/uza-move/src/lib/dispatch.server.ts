import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineKm } from "./pricing";

/** How long the nearest driver keeps an exclusive claim on a new request. */
export const OFFER_WINDOW_SECONDS = 25;

type TripRow = {
  id: string;
  vehicle_type: string;
  pickup_lat: number;
  pickup_lng: number;
  offered_driver_id?: string | null;
};

/** Drivers who can legitimately take this trip right now. */
async function candidates(db: SupabaseClient, vehicleType: string) {
  const { data } = await db
    .from("drivers")
    .select("id, current_lat, current_lng, uza_score, rating_avg, insurance_expiry")
    .eq("is_online", true)
    .eq("status", "approved")
    .eq("vehicle_type", vehicleType)
    .limit(60);
  // An expired insurance certificate takes a driver out of dispatch immediately —
  // no uninsured vehicle ever carries a UZA passenger.
  return (data ?? []).filter((d) => isInsured(d));
}

/** True when the driver has no recorded expiry yet, or it is still in the future. */
export function isInsured(driver: { insurance_expiry?: string | null }) {
  if (!driver.insurance_expiry) return true;
  return new Date(driver.insurance_expiry).getTime() >= new Date().setHours(0, 0, 0, 0);
}

/** How long a request may sit unanswered before it is closed out. */
export const REQUEST_EXPIRY_MINUTES = 10;

/**
 * Close out requests nobody ever took, so a rider is never left staring at a
 * "searching" screen and the job list never fills with dead trips.
 */
export async function expireStaleTrips(db: SupabaseClient) {
  const cutoff = new Date(Date.now() - REQUEST_EXPIRY_MINUTES * 60_000).toISOString();
  const { data } = await db
    .from("trips")
    .update({
      status: "cancelled_by_rider",
      cancelled_reason: "No driver found in time",
      final_fare: 0,
      driver_earnings: 0,
      commission_amount: 0,
    })
    .eq("status", "requested")
    .is("driver_id", null)
    .lt("requested_at", cutoff)
    .select("id");
  for (const t of data ?? []) {
    await db.from("trip_events").insert({ trip_id: t.id, event_type: "expired" });
  }
  return data?.length ?? 0;
}

/**
 * Offer the trip to the closest online driver. Ties and missing GPS fall back to
 * UZA score, so a driver who has not pinged yet never blocks the queue.
 */
export async function offerToNearestDriver(db: SupabaseClient, trip: TripRow, exclude: string[] = []) {
  const list = (await candidates(db, trip.vehicle_type)).filter((d) => !exclude.includes(d.id));
  if (!list.length) return null;

  const scored = list
    .map((d) => ({
      d,
      km:
        d.current_lat != null && d.current_lng != null
          ? haversineKm({ lat: d.current_lat, lng: d.current_lng }, { lat: trip.pickup_lat, lng: trip.pickup_lng })
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => (a.km === b.km ? Number(b.d.uza_score) - Number(a.d.uza_score) : a.km - b.km));

  const best = scored[0];
  if (!best || best.km > 12) return null; // too far to be a useful dispatch

  const until = new Date(Date.now() + OFFER_WINDOW_SECONDS * 1000).toISOString();
  await db
    .from("trips")
    .update({ offered_driver_id: best.d.id, offered_until: until })
    .eq("id", trip.id)
    .eq("status", "requested");
  return { driverId: best.d.id, km: best.km, until };
}

/**
 * True when this driver may see/accept the trip: either they hold the live
 * offer, or the window lapsed and the request is open to everyone nearby.
 */
export function offerOpenTo(trip: { offered_driver_id?: string | null; offered_until?: string | null }, driverId: string) {
  if (!trip.offered_driver_id || trip.offered_driver_id === driverId) return true;
  if (!trip.offered_until) return true;
  return new Date(trip.offered_until).getTime() < Date.now();
}

/** How much platform commission this driver still owes from cash trips. */
export async function commissionOwed(db: SupabaseClient, userId: string) {
  const { data } = await db.from("wallets").select("commission_owed").eq("owner_id", userId).maybeSingle();
  return Number(data?.commission_owed ?? 0);
}

/**
 * A driver sitting on too much uncollected cash commission cannot take new
 * work until they settle. This is what keeps cash trips honest.
 */
export async function assertCommissionClear(db: SupabaseClient, userId: string) {
  const { COMMISSION_OWED_LIMIT } = await import("@/config/policy");
  const owed = await commissionOwed(db, userId);
  if (owed > COMMISSION_OWED_LIMIT)
    throw new Error(
      `You owe ${Math.round(owed).toLocaleString()} RWF in commission from cash trips. Settle it in your wallet to keep driving.`,
    );
}
