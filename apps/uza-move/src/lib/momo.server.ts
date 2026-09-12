import { admin, applyTripLedger, autoRepayLoan, post } from "./uza.server";

/**
 * The single place where a MoMo collection is trusted. The driver's PAID ✓
 * badge is driven by this function and nothing else — never by an SMS or a
 * screenshot a passenger shows.
 */
export async function settleMomoCollection(
  externalRef: string,
  outcome: "successful" | "failed",
  payload: Record<string, unknown>,
) {
  const db = admin();
  // Conditional single-statement claim: only the first callback for this
  // reference flips it out of `pending`, so a replayed callback credits nothing.
  const { data: claimed } = await db
    .from("momo_transactions")
    .update({ status: outcome, callback_payload: payload })
    .eq("external_ref", externalRef)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!claimed) {
    const { data: existing } = await db
      .from("momo_transactions").select("id").eq("external_ref", externalRef).maybeSingle();
    return existing ? { ok: true as const, already: true } : { ok: false as const, error: "unknown_reference" };
  }
  const momo = claimed;


  if (outcome !== "successful") {
    if (momo.trip_id) await db.from("trips").update({ pay_status: "failed" }).eq("id", momo.trip_id);
    return { ok: true as const, status: "failed" as const };
  }

  // Wallet top-up (no trip attached).
  if (!momo.trip_id) {
    if (momo.direction === "collection" && momo.initiated_by) {
      await post(db, momo.initiated_by, "topup", Number(momo.amount), {
        delta: Number(momo.amount), ref: `momo:${externalRef}`, note: "Kongeramo amafaranga (MoMo)",
      });
    }
    return { ok: true as const, status: "successful" as const };
  }

  // Same conditional claim on the trip itself.
  const { data: trip } = await db
    .from("trips")
    .update({ pay_status: "paid" })
    .eq("id", momo.trip_id)
    .neq("pay_status", "paid")
    .select("*")
    .maybeSingle();
  if (!trip) return { ok: true as const, already: true };

  await db.from("trip_events").insert({ trip_id: trip.id, event_type: "payment_verified", meta: { externalRef } });


  const { data: driver } = trip.driver_id
    ? await db.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle()
    : { data: null };
  if (!driver) return { ok: true as const, status: "successful" as const };

  const ledger = await applyTripLedger(
    db,
    { id: trip.id, final_fare: Number(trip.final_fare ?? trip.quoted_fare), commission_amount: Number(trip.commission_amount), pay_method: "momo" },
    driver,
  );
  await autoRepayLoan(db, driver);
  return { ok: true as const, status: "successful" as const, ledger };
}

export async function settleMomoDisbursement(externalRef: string, outcome: "successful" | "failed", payload: Record<string, unknown>) {
  const db = admin();
  const { data: momo } = await db.from("momo_transactions").select("*").eq("external_ref", externalRef).maybeSingle();
  if (!momo || momo.status !== "pending") return { ok: false as const };
  await db.from("momo_transactions").update({ status: outcome, callback_payload: payload }).eq("id", momo.id);
  if (outcome === "failed" && momo.initiated_by) {
    // Return the held amount to the driver's spendable balance.
    await post(db, momo.initiated_by, "topup", Number(momo.amount), {
      delta: Number(momo.amount), ref: `momo:${externalRef}`, note: "Gukura amafaranga byanze — asubijwe",
    });
  }
  return { ok: true as const };
}
