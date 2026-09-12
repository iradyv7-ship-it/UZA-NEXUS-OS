import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Map an ops-configured tariff row onto the policy tariff shape. */
function tariffOverride(row: Record<string, unknown> | null) {
  if (!row) return undefined;
  const num = (v: unknown) => (v == null ? undefined : Number(v));
  return {
    baseFare: num(row["base_fare"]),
    perKm: num(row["per_km"]),
    perMinute: num(row["per_minute"]),
    minFare: num(row["min_fare"]),
    waitingPerMinute: num(row["waiting_per_minute"]),
  } as Partial<import("@/config/policy").Tariff>;
}

const point = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().max(200).optional(),
});
const vehicle = z.enum(["moto", "cab", "e_moto", "delivery"]);

/** Regulated, upfront quote. What is quoted is what is charged. */
export const quoteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pickup: point, dropoff: point, vehicle_type: vehicle }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await import("./uza.server");
    const { roadDistanceKm, estimateDurationMin, quoteFare } = await import("./pricing");
    const db = admin();
    const { data: tariff } = await db
      .from("fare_tariffs")
      .select("*")
      .eq("vehicle_type", data.vehicle_type)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const km = roadDistanceKm(data.pickup, data.dropoff);
    const min = estimateDurationMin(km, data.vehicle_type);
    const q = quoteFare(km, min, data.vehicle_type, tariffOverride(tariff));
    return { ...q, tariff_id: tariff?.id ?? null, surge_enabled: q.surgeApplied };
  });

export const requestTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pickup: point, dropoff: point, vehicle_type: vehicle }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, makePin } = await import("./uza.server");
    const { roadDistanceKm, estimateDurationMin, quoteFare } = await import("./pricing");
    const db = admin();

    const { data: tariff } = await db
      .from("fare_tariffs")
      .select("*")
      .eq("vehicle_type", data.vehicle_type)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const km = roadDistanceKm(data.pickup, data.dropoff);
    const min = estimateDurationMin(km, data.vehicle_type);
    const q = quoteFare(km, min, data.vehicle_type, tariffOverride(tariff));

    await db.from("riders").upsert({ user_id: context.userId }, { onConflict: "user_id" });

    const { data: trip, error } = await db
      .from("trips")
      .insert({
        rider_id: context.userId,
        vehicle_type: data.vehicle_type,
        pickup_lat: data.pickup.lat,
        pickup_lng: data.pickup.lng,
        pickup_address: data.pickup.address ?? null,
        dropoff_lat: data.dropoff.lat,
        dropoff_lng: data.dropoff.lng,
        dropoff_address: data.dropoff.address ?? null,
        distance_km: q.distanceKm,
        duration_min: q.durationMin,
        quoted_fare: q.fare,
        commission_amount: q.commission,
        driver_earnings: q.driverEarnings,
        start_pin: makePin(),
        tariff_id: tariff?.id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await db.from("trip_events").insert({
      trip_id: trip.id,
      event_type: "requested",
      lat: data.pickup.lat,
      lng: data.pickup.lng,
      actor_id: context.userId,
    });

    // Automatic dispatch: the nearest suitable driver gets an exclusive first look.
    const { offerToNearestDriver } = await import("./dispatch.server");
    await offerToNearestDriver(db, trip);
    return trip;
  });

export const getTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: trip } = await db.from("trips").select("*").eq("id", data.id).maybeSingle();
    if (!trip) return null;

    const { data: driver } = trip.driver_id
      ? await db.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle()
      : { data: null };
    const { data: driverProfile } = driver
      ? await db
          .from("profiles")
          .select("full_name, avatar_url, phone")
          .eq("id", driver.user_id)
          .maybeSingle()
      : { data: null };

    const isRider = trip.rider_id === context.userId;
    const isDriver = driver?.user_id === context.userId;
    if (!isRider && !isDriver) {
      const { data: ops } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      if (!ops?.some((r) => r.role === "ops" || r.role === "admin")) return null;
    }

    return {
      // The Start PIN belongs to the rider alone — it is never sent to a driver
      // or an ops screen, so it cannot be read off a screen and used to fake a start.
      trip: isRider ? trip : { ...trip, start_pin: "" },
      driver: driver ? { ...driver, profile: driverProfile } : null,
      role: isRider ? "rider" : isDriver ? "driver" : "ops",
    };
  });

/**
 * Requests this driver may work on: their exclusive dispatch offer first, then
 * anything whose offer window lapsed, nearest pick-up at the top.
 */
export const listOpenTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("./uza.server");
    const { haversineKm } = await import("./pricing");
    const { offerOpenTo, offerToNearestDriver, expireStaleTrips, isInsured } =
      await import("./dispatch.server");
    const db = admin();
    await expireStaleTrips(db);
    const { data: driver } = await db
      .from("drivers")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!driver || !driver.is_online || driver.status !== "approved" || !isInsured(driver))
      return [];
    const { commissionOwed } = await import("./dispatch.server");
    const { COMMISSION_OWED_LIMIT } = await import("@/config/policy");
    if ((await commissionOwed(db, driver.user_id)) > COMMISSION_OWED_LIMIT) return [];

    const { data: trips } = await db
      .from("trips")
      .select("*")
      .eq("status", "requested")
      .eq("vehicle_type", driver.vehicle_type)
      .order("requested_at", { ascending: true })
      .limit(25);

    const now = Date.now();
    const rows = (trips ?? []).filter((t) => offerOpenTo(t, driver.id));

    // A lapsed offer is re-dispatched to the next nearest driver, so a request
    // never sits waiting on someone who put their phone down.
    for (const t of trips ?? []) {
      if (t.offered_driver_id && t.offered_until && new Date(t.offered_until).getTime() < now) {
        await offerToNearestDriver(db, t, [t.offered_driver_id]);
      }
    }

    return rows
      .map((t) => ({
        ...t,
        is_offered_to_me:
          t.offered_driver_id === driver.id &&
          t.offered_until != null &&
          new Date(t.offered_until).getTime() > now,
        pickup_distance_km:
          driver.current_lat != null && driver.current_lng != null
            ? Math.round(
                haversineKm(
                  { lat: driver.current_lat, lng: driver.current_lng },
                  { lat: t.pickup_lat, lng: t.pickup_lng },
                ) * 10,
              ) / 10
            : null,
      }))
      .sort((a, b) => {
        if (a.is_offered_to_me !== b.is_offered_to_me) return a.is_offered_to_me ? -1 : 1;
        return (a.pickup_distance_km ?? 999) - (b.pickup_distance_km ?? 999);
      })
      .slice(0, 15);
  });

export const acceptTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ trip_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const { offerOpenTo } = await import("./dispatch.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!driver) throw new Error("Nta mwirondoro w'umushoferi.");
    if (driver.status !== "approved") throw new Error("Konti yawe ntiraremezwa na UZA.");
    const { isInsured } = await import("./dispatch.server");
    if (!isInsured(driver))
      throw new Error("Your insurance has expired. Upload a valid certificate to keep driving.");
    const { assertCommissionClear } = await import("./dispatch.server");
    await assertCommissionClear(db, driver.user_id);

    const { data: pending } = await db
      .from("trips")
      .select("*")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (!pending) throw new Error("Urwo rugendo ntirubonetse.");
    if (!offerOpenTo(pending, driver.id))
      throw new Error("This trip was offered to a closer driver first.");

    const { data: trip, error } = await db
      .from("trips")
      .update({
        driver_id: driver.id,
        status: "accepted",
        accepted_at: new Date().toISOString(),
        offered_driver_id: null,
        offered_until: null,
      })
      .eq("id", data.trip_id)
      .eq("status", "requested")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!trip) throw new Error("Urwo rugendo rwafashwe n'undi mushoferi.");

    await db.from("trip_events").insert({
      trip_id: trip.id,
      event_type: "accepted",
      lat: driver.current_lat,
      lng: driver.current_lng,
      actor_id: context.userId,
    });
    return trip;
  });

export const setTripStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        status: z.enum(["arriving", "cancelled_by_rider", "cancelled_by_driver", "no_show"]),
        reason: z.string().max(200).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: trip } = await db.from("trips").select("*").eq("id", data.trip_id).maybeSingle();
    if (!trip) throw new Error("Trip not found.");

    const { data: driver } = trip.driver_id
      ? await db.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle()
      : { data: null };
    const isRider = trip.rider_id === context.userId;
    const isDriver = Boolean(driver && driver.user_id === context.userId);
    if (!isRider && !isDriver) throw new Error("This trip is not yours.");

    // A started or finished trip can never be cancelled — the money is already in play.
    if (["completed", "cancelled_by_rider", "cancelled_by_driver", "no_show"].includes(trip.status))
      throw new Error("This trip is already closed.");
    if (trip.status === "started" && data.status !== "arriving")
      throw new Error("The trip has already started, it cannot be cancelled.");
    if (data.status === "arriving" && !isDriver)
      throw new Error("Only the driver can mark arrival.");
    if (data.status === "cancelled_by_rider" && !isRider)
      throw new Error("Only the rider can cancel as rider.");
    if (["cancelled_by_driver", "no_show"].includes(data.status) && !isDriver)
      throw new Error("Only the driver can cancel as driver.");

    const isCancel = data.status !== "arriving";

    // Late cancels and no-shows carry a fee: the rider pays, the driver keeps
    // all of it. UZA takes no commission on a trip that never happened.
    let fee = 0;
    const riderAtFault = data.status === "cancelled_by_rider" || data.status === "no_show";
    if (isCancel && riderAtFault && driver) {
      const { cancellationFee } = await import("./pricing");
      fee = cancellationFee({
        vehicleType: trip.vehicle_type,
        status: trip.status,
        acceptedAt: trip.accepted_at,
      });
    }

    await db
      .from("trips")
      .update({
        status: data.status,
        cancelled_reason: data.reason ?? null,
        ...(isCancel
          ? {
              final_fare: 0,
              driver_earnings: 0,
              commission_amount: 0,
              cancellation_fee: fee,
              cancelled_by: context.userId,
            }
          : {}),
      })
      .eq("id", trip.id);
    await db.from("trip_events").insert({
      trip_id: trip.id,
      event_type: data.status,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      actor_id: context.userId,
      meta: fee ? { cancellation_fee: fee } : null,
    });

    if (fee > 0 && driver) {
      const { post, getOrCreateWallet } = await import("./uza.server");
      const riderWallet = await getOrCreateWallet(db, trip.rider_id);
      // Take what the wallet holds; the rest becomes a debt cleared on next top-up.
      const fromBalance = Math.max(0, Math.min(fee, Number(riderWallet.balance)));
      await post(db, trip.rider_id, "cancellation_fee", fee, {
        delta: -fromBalance,
        owedDelta: fee - fromBalance,
        ref: `cancel:${trip.id}`,
        note: data.status === "no_show" ? "No-show fee" : "Late cancellation fee",
      });
      await post(db, driver.user_id, "cancellation_payout", fee, {
        delta: fee,
        ref: `cancel:${trip.id}`,
        note: "Compensation for a cancelled pickup",
      });
    }

    return { ok: true, cancelled: isCancel, fee };
  });

/** Trip Start PIN — proves the right rider got in with the right driver. */
export const startTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        pin: z.string().length(4),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: trip } = await db.from("trips").select("*").eq("id", data.trip_id).maybeSingle();
    if (!trip || !driver || trip.driver_id !== driver.id) throw new Error("Urugendo si urwawe.");
    if (trip.start_pin !== data.pin) return { ok: false as const, error: "PIN si yo." };

    await db
      .from("trips")
      .update({ status: "started", started_at: new Date().toISOString() })
      .eq("id", trip.id);
    await db.from("trip_events").insert({
      trip_id: trip.id,
      event_type: "started",
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      actor_id: context.userId,
    });
    return { ok: true as const };
  });

/**
 * End the trip. Cash settles immediately; MoMo waits for the provider callback —
 * the driver never sees PAID until real money moved.
 */
export const completeTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        pay_method: z.enum(["momo", "cash"]),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, applyTripLedger, autoRepayLoan } = await import("./uza.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: trip } = await db.from("trips").select("*").eq("id", data.trip_id).maybeSingle();
    if (!trip || !driver || trip.driver_id !== driver.id) throw new Error("Urugendo si urwawe.");
    if (trip.status === "completed") return { ok: true, already: true };

    // The quote is the price — the final fare equals what the rider was shown.
    const finalFare = Number(trip.quoted_fare);
    const { splitFare } = await import("./pricing");
    const commission = Number(trip.commission_amount ?? splitFare(finalFare).commission);

    const { data: updated } = await db
      .from("trips")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        final_fare: finalFare,
        commission_amount: commission,
        driver_earnings: finalFare - commission,
        pay_method: data.pay_method,
        pay_status: data.pay_method === "cash" ? "cash_collected" : "pending",
      })
      .eq("id", trip.id)
      .select("*")
      .single();

    await db.from("trip_events").insert({
      trip_id: trip.id,
      event_type: "completed",
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      actor_id: context.userId,
    });

    if (data.pay_method === "cash") {
      const result = await applyTripLedger(db, { ...updated, pay_method: "cash" }, driver);
      await autoRepayLoan(db, driver);
      return { ok: true, trip: updated, ledger: result };
    }
    return { ok: true, trip: updated, ledger: null };
  });

/** Ask the rider's phone to approve a MoMo payment. Nothing is credited yet. */
export const requestMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        phone: z.string().min(9).max(15),
        provider: z.enum(["mtn", "airtel"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, requestToPay } = await import("./uza.server");
    const db = admin();
    const { data: trip } = await db.from("trips").select("*").eq("id", data.trip_id).maybeSingle();
    if (!trip || trip.rider_id !== context.userId) throw new Error("Urugendo si urwawe.");

    const amount = Number(trip.final_fare ?? trip.quoted_fare);
    const { externalRef, simulated } = await requestToPay({
      provider: data.provider,
      phone: data.phone,
      amount,
      reference: trip.id.slice(0, 8),
    });

    const { data: momo, error } = await db
      .from("momo_transactions")
      .insert({
        provider: data.provider,
        direction: "collection",
        phone: data.phone,
        amount,
        external_ref: externalRef,
        trip_id: trip.id,
        initiated_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await db.from("trips").update({ pay_method: "momo", pay_status: "pending" }).eq("id", trip.id);
    return { momo, simulated };
  });

/**
 * Sandbox stand-in for the provider callback. In production the identical
 * settlement runs in /api/public/momo/callback and nowhere else.
 */
export const simulateMomoCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ external_ref: z.string().min(4), outcome: z.enum(["successful", "failed"]) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { settleMomoCollection } = await import("./momo.server");
    return settleMomoCollection(data.external_ref, data.outcome, { source: "sandbox_simulator" });
  });

export const rateTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        stars: z.number().int().min(1).max(5),
        comment: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: trip } = await db.from("trips").select("*").eq("id", data.trip_id).maybeSingle();
    if (!trip) throw new Error("Urugendo ntirubonetse.");

    const { data: driver } = trip.driver_id
      ? await db.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle()
      : { data: null };
    const isRider = trip.rider_id === context.userId;
    const rateeId = isRider ? driver?.user_id : trip.rider_id;
    if (!rateeId) throw new Error("Nta wo guha amanota.");

    await db.from("ratings").upsert(
      {
        trip_id: trip.id,
        rater_id: context.userId,
        ratee_id: rateeId,
        stars: data.stars,
        comment: data.comment ?? null,
      },
      { onConflict: "trip_id,rater_id" },
    );

    const table = isRider ? "drivers" : "riders";
    const idCol = isRider ? driver!.id : null;
    const { data: row } = idCol
      ? await db.from(table).select("*").eq("id", idCol).maybeSingle()
      : await db.from("riders").select("*").eq("user_id", trip.rider_id).maybeSingle();
    if (row) {
      const count = Number(row.rating_count) + 1;
      const avg = (Number(row.rating_avg) * Number(row.rating_count) + data.stars) / count;
      await db
        .from(table)
        .update({ rating_count: count, rating_avg: Math.round(avg * 100) / 100 })
        .eq("id", row.id);
    }
    return { ok: true };
  });

export const raiseIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trip_id: z.string().uuid().optional(),
        kind: z.enum(["sos", "report", "off_app_payment", "unsafe_driving"]),
        description: z.string().max(500).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    await admin()
      .from("incidents")
      .insert({ ...data, reporter_id: context.userId });
    return { ok: true };
  });

export const myTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: driver } = await db
      .from("drivers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const query = db
      .from("trips")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(40);
    const { data } = driver
      ? await query.or(`rider_id.eq.${context.userId},driver_id.eq.${driver.id}`)
      : await query.eq("rider_id", context.userId);
    return data ?? [];
  });
