import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { splitFare } from "./pricing";

/** Ops console data: pending drivers, live trips, tariffs, money snapshot. */
export const opsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();
    await requireOps(db, context.userId);
    const { expireStaleTrips } = await import("./dispatch.server");
    await expireStaleTrips(db);

    const [drivers, trips, tariffs, incidents, momo] = await Promise.all([
      db.from("drivers").select("*").order("created_at", { ascending: false }).limit(50),
      db
        .from("trips")
        .select("id,status,vehicle_type,quoted_fare,final_fare,pay_method,pay_status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("fare_tariffs").select("*").order("vehicle_type"),
      db.from("incidents").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(30),
      db.from("momo_transactions").select("status,amount,direction").limit(500),
    ]);

    const tripRows = trips.data ?? [];
    const gross = tripRows.reduce((s, t) => s + Number(t.final_fare ?? 0), 0);

    return {
      drivers: drivers.data ?? [],
      trips: tripRows,
      tariffs: tariffs.data ?? [],
      incidents: incidents.data ?? [],
      stats: {
        pendingDrivers: (drivers.data ?? []).filter((d) => d.status === "pending").length,
        onlineDrivers: (drivers.data ?? []).filter((d) => d.is_online).length,
        liveTrips: tripRows.filter((t) => ["requested", "accepted", "arriving", "started"].includes(t.status)).length,
        grossRecent: gross,
        commissionRecent: splitFare(gross).commission,
        momoFailed: (momo.data ?? []).filter((m) => m.status === "failed").length,
      },
    };
  });

export const setDriverStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ driverId: z.string().uuid(), status: z.enum(["pending", "approved", "suspended", "rejected"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();
    await requireOps(db, context.userId);
    const { error } = await db.from("drivers").update({ status: data.status }).eq("id", data.driverId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTariff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        base_fare: z.number().min(0).max(100000),
        per_km: z.number().min(0).max(100000),
        per_minute: z.number().min(0).max(100000),
        min_fare: z.number().min(0).max(100000),
        waiting_per_minute: z.number().min(0).max(100000),
        surge_enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();
    await requireOps(db, context.userId);
    const { id, ...patch } = data;
    const { error } = await db.from("fare_tariffs").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ incidentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();
    await requireOps(db, context.userId);
    const { error } = await db.from("incidents").update({ resolved: true }).eq("id", data.incidentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Last-resort control: ops can close a trip that is stuck mid-flow. */
export const forceCancelTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tripId: z.string().uuid(), reason: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();
    await requireOps(db, context.userId);

    const { data: trip } = await db.from("trips").select("status").eq("id", data.tripId).maybeSingle();
    if (!trip) throw new Error("Trip not found.");
    if (["completed", "cancelled_by_rider", "cancelled_by_driver", "no_show"].includes(trip.status))
      throw new Error("This trip is already closed.");

    await db
      .from("trips")
      .update({
        status: "cancelled_by_rider",
        cancelled_reason: data.reason ?? "Closed by UZA operations",
        final_fare: 0,
        driver_earnings: 0,
        commission_amount: 0,
      })
      .eq("id", data.tripId);
    await db.from("trip_events").insert({
      trip_id: data.tripId,
      event_type: "force_cancelled",
      actor_id: context.userId,
    });
    return { ok: true };
  });
