import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PLACEMENTS = ["rider_home_banner", "post_trip", "receipt", "driver_idle"] as const;

/** Advertiser self-serve dashboard: account, campaigns, creatives, live counts. */
export const getAdvertiserDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const uid = context.userId;

    const { data: advertiser } = await db
      .from("ad_advertisers")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (!advertiser) return { advertiser: null, campaigns: [] as never[] };

    const { data: campaigns } = await db
      .from("ad_campaigns")
      .select("*, ad_creatives(*)")
      .eq("advertiser_id", advertiser.id)
      .order("created_at", { ascending: false });

    const ids = (campaigns ?? []).map((c) => c.id);
    const [imps, clicks] = await Promise.all([
      ids.length
        ? db.from("ad_impressions").select("campaign_id").in("campaign_id", ids)
        : { data: [] },
      ids.length ? db.from("ad_clicks").select("campaign_id").in("campaign_id", ids) : { data: [] },
    ]);

    const count = (rows: { campaign_id: string }[] | null, id: string) =>
      (rows ?? []).filter((r) => r.campaign_id === id).length;

    return {
      advertiser,
      campaigns: (campaigns ?? []).map((c) => ({
        ...c,
        impressions: count(imps.data as { campaign_id: string }[], c.id),
        clicks: count(clicks.data as { campaign_id: string }[], c.id),
      })),
    };
  });

export const createAdvertiser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        company_name: z.string().min(2).max(120),
        contact_phone: z.string().min(9).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: row, error } = await db
      .from("ad_advertisers")
      .insert({
        user_id: context.userId,
        company_name: data.company_name,
        contact_phone: data.contact_phone,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await db.from("user_roles").insert({ user_id: context.userId, role: "advertiser" }).select();
    return row;
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        placement: z.enum(PLACEMENTS),
        audience: z.enum(["riders", "drivers", "both"]),
        vehicle_type: z.enum(["moto", "cab", "e_moto", "delivery"]).nullable().optional(),
        hour_start: z.number().int().min(0).max(23),
        hour_end: z.number().int().min(0).max(23),
        budget: z.number().min(1000).max(10_000_000),
        bill_model: z.enum(["cpm", "cpc"]),
        cpm: z.number().min(0).max(100000),
        cpc: z.number().min(0).max(100000),
        headline: z.string().min(2).max(80),
        body: z.string().max(160).optional(),
        cta_label: z.string().max(30).optional(),
        destination_url: z.string().url().max(300).optional(),
        is_sponsored_offer: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const { data: advertiser } = await db
      .from("ad_advertisers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!advertiser) throw new Error("Banza wiyandikishe nk'umumenyekanisha.");

    const { headline, body, cta_label, destination_url, ...campaign } = data;
    const { data: row, error } = await db
      .from("ad_campaigns")
      .insert({
        ...campaign,
        vehicle_type: campaign.vehicle_type ?? null,
        advertiser_id: advertiser.id,
        status: "pending_review",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: cErr } = await db.from("ad_creatives").insert({
      campaign_id: row.id,
      headline,
      body: body ?? null,
      cta_label: cta_label ?? null,
      destination_url: destination_url ?? null,
    });
    if (cErr) throw new Error(cErr.message);
    return row;
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        status: z.enum([
          "draft",
          "pending_review",
          "approved",
          "rejected",
          "running",
          "paused",
          "ended",
        ]),
        asOps: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, requireOps } = await import("./uza.server");
    const db = admin();

    if (data.asOps) {
      await requireOps(db, context.userId);
    } else {
      // Advertisers may only pause or resume their own campaigns.
      if (!["running", "paused"].includes(data.status)) throw new Error("Ntibyemewe.");
      const { data: owned } = await db
        .from("ad_campaigns")
        .select("id, ad_advertisers!inner(user_id)")
        .eq("id", data.campaignId)
        .maybeSingle();
      const owner = (owned as { ad_advertisers?: { user_id: string } } | null)?.ad_advertisers
        ?.user_id;
      if (owner !== context.userId) throw new Error("Ntufite uburenganzira.");
    }

    const { error } = await db
      .from("ad_campaigns")
      .update({ status: data.status })
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Picks one eligible creative for a slot and records the impression. */
export const serveAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        placement: z.enum(PLACEMENTS),
        audience: z.enum(["riders", "drivers"]),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();
    const hour = new Date().getUTCHours() + 2; // Rwanda is UTC+2, no DST.
    const h = ((hour % 24) + 24) % 24;

    const { data: campaigns } = await db
      .from("ad_campaigns")
      .select(
        "id, budget, spent, bill_model, cpm, cpc, hour_start, hour_end, audience, is_sponsored_offer, ad_creatives(*)",
      )
      .eq("placement", data.placement)
      .eq("status", "running")
      .in("audience", [data.audience, "both"])
      .limit(20);

    const eligible = (campaigns ?? []).filter(
      (c) =>
        Number(c.spent) < Number(c.budget) &&
        h >= c.hour_start &&
        h <= c.hour_end &&
        (c.ad_creatives ?? []).length,
    );
    if (!eligible.length) return null;

    const campaign = eligible[Math.floor(Math.random() * eligible.length)]!;
    const creative = (campaign.ad_creatives as Array<Record<string, unknown>>)[0]!;

    await db.from("ad_impressions").insert({
      campaign_id: campaign.id,
      creative_id: creative["id"] as string,
      user_id: context.userId,
      placement: data.placement,
    });
    if (campaign.bill_model === "cpm") {
      await db
        .from("ad_campaigns")
        .update({ spent: Number(campaign.spent) + Number(campaign.cpm) / 1000 })
        .eq("id", campaign.id);
    }

    return {
      campaignId: campaign.id,
      creativeId: creative["id"] as string,
      headline: creative["headline"] as string,
      body: (creative["body"] as string) ?? null,
      ctaLabel: (creative["cta_label"] as string) ?? null,
      destinationUrl: (creative["destination_url"] as string) ?? null,
      sponsored: campaign.is_sponsored_offer,
    };
  });

export const recordAdClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        creativeId: z.string().uuid(),
        placement: z.enum(PLACEMENTS),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("./uza.server");
    const db = admin();

    // Only a click on a creative that really belongs to a running campaign can
    // ever spend an advertiser's budget.
    const { data: creative } = await db
      .from("ad_creatives")
      .select("id, campaign_id, ad_campaigns!inner(status)")
      .eq("id", data.creativeId)
      .eq("campaign_id", data.campaignId)
      .maybeSingle();
    const status = (creative as { ad_campaigns?: { status: string } } | null)?.ad_campaigns?.status;
    if (!creative || status !== "running") return { ok: false as const };

    await db.from("ad_clicks").insert({
      campaign_id: data.campaignId,
      creative_id: data.creativeId,
      user_id: context.userId,
      placement: data.placement,
    });
    const { data: c } = await db
      .from("ad_campaigns")
      .select("spent, cpc, bill_model")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (c && c.bill_model === "cpc") {
      await db
        .from("ad_campaigns")
        .update({ spent: Number(c.spent) + Number(c.cpc) })
        .eq("id", data.campaignId);
    }
    return { ok: true as const };
  });
