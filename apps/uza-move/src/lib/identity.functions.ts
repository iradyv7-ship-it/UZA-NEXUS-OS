import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Everything the app needs to know about the signed-in person, in one call. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, getOrCreateWallet } = await import("./uza.server");
    const db = admin();
    const uid = context.userId;

    const [{ data: profile }, { data: roles }, { data: driver }, { data: rider }, { data: advertiser }] =
      await Promise.all([
        db.from("profiles").select("*").eq("id", uid).maybeSingle(),
        db.from("user_roles").select("role").eq("user_id", uid),
        db.from("drivers").select("*").eq("user_id", uid).maybeSingle(),
        db.from("riders").select("*").eq("user_id", uid).maybeSingle(),
        db.from("ad_advertisers").select("*").eq("user_id", uid).maybeSingle(),
      ]);

    if (!profile) await db.from("profiles").insert({ id: uid }).select().maybeSingle();
    const wallet = await getOrCreateWallet(db, uid);

    return {
      userId: uid,
      profile: profile ?? { id: uid, full_name: null, phone: null, language: "rw" },
      roles: (roles ?? []).map((r) => r.role as string),
      driver,
      rider,
      advertiser,
      wallet,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      full_name: z.string().max(120).optional(),
      phone: z.string().max(20).optional(),
      language: z.enum(["rw", "en", "fr"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    await db.from("profiles").upsert({ id: context.userId, ...data }).eq("id", context.userId);
    return { ok: true };
  });

/** Pick a role. Ops/admin roles are never self-assignable. */
export const chooseRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ role: z.enum(["rider", "driver", "advertiser"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const uid = context.userId;
    await db.from("user_roles").upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role" });

    if (data.role === "rider") {
      await db.from("riders").upsert({ user_id: uid }, { onConflict: "user_id" });
    }
    if (data.role === "driver") {
      const { data: driver } = await db.from("drivers").upsert({ user_id: uid }, { onConflict: "user_id" }).select().single();
      if (driver) {
        await db.from("savings_rules").upsert({ driver_id: driver.id }, { onConflict: "driver_id" });
      }
    }
    return { ok: true };
  });

/** Driver KYC: national ID, plate, and the document photos ops must review. */
export const submitDriverKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      national_id: z.string().min(4).max(32),
      licence_number: z.string().max(32).optional(),
      vehicle_type: z.enum(["moto", "cab", "e_moto", "delivery"]),
      plate_number: z.string().min(3).max(16),
      // Private storage paths inside the `driver-docs` bucket, never public URLs.
      id_photo_url: z.string().max(300).optional(),
      licence_photo_url: z.string().max(300).optional(),
      insurance_photo_url: z.string().max(300).optional(),
      vehicle_photo_url: z.string().max(300).optional(),
      vest_photo_url: z.string().max(300).optional(),
      photo_url: z.string().max(300).optional(),
      insurance_expiry: z.string().max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v !== undefined));
    const { data: driver, error } = await db
      .from("drivers")
      .upsert(
        { user_id: context.userId, ...clean, status: "pending", docs_submitted_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw error;
    await db.from("savings_rules").upsert({ driver_id: driver.id }, { onConflict: "driver_id" });
    await db.from("vehicles").insert({
      driver_id: driver.id,
      vehicle_type: data.vehicle_type,
      plate_number: data.plate_number,
      is_electric: data.vehicle_type === "e_moto",
      photo_url: data.vehicle_photo_url || null,
    });
    return { ok: true, driver };
  });

/** Short-lived signed links so ops can actually look at a driver's documents. */
export const getDriverDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ driver_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();
    await requireOps(db, context.userId);
    const { data: driver } = await db
      .from("drivers")
      .select("id_photo_url, licence_photo_url, insurance_photo_url, vehicle_photo_url, vest_photo_url, photo_url, insurance_expiry")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (!driver) return { docs: [], insurance_expiry: null };

    const labels: Record<string, string> = {
      id_photo_url: "National ID",
      licence_photo_url: "Driving licence",
      insurance_photo_url: "Insurance",
      vehicle_photo_url: "Vehicle",
      vest_photo_url: "Vest / plate",
      photo_url: "Driver photo",
    };
    const docs: { label: string; url: string }[] = [];
    for (const [key, label] of Object.entries(labels)) {
      const path = (driver as Record<string, string | null>)[key];
      if (!path) continue;
      const { data: signed } = await db.storage.from("driver-docs").createSignedUrl(path, 600);
      if (signed?.signedUrl) docs.push({ label, url: signed.signedUrl });
    }
    return { docs, insurance_expiry: driver.insurance_expiry ?? null };
  });


export const setOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ online: z.boolean(), lat: z.number().optional(), lng: z.number().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    if (data.online) {
      // Going online is the gate: unpaid cash commission stops here, not mid-trip.
      const { assertCommissionClear } = await import("./dispatch.server");
      await assertCommissionClear(db, context.userId);
    }
    await db
      .from("drivers")
      .update({ is_online: data.online, current_lat: data.lat ?? null, current_lng: data.lng ?? null })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const pingLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    await admin().from("drivers").update({ current_lat: data.lat, current_lng: data.lng }).eq("user_id", context.userId);
    return { ok: true };
  });
