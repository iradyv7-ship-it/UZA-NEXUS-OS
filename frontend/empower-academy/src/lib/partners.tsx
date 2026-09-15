import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { T } from "@/content/types";

export type PartnerKind = "rnp" | "driving_school" | "bank" | "garage" | "employer";

/** What each kind of partner owns inside the programme. */
export const partnerKinds: {
  id: PartnerKind;
  label: T;
  role: T;
  portal: T;
}[] = [
  {
    id: "rnp",
    label: { en: "Rwanda National Police — traffic", rw: "Polisi y'u Rwanda — umuhanda" },
    role: {
      en: "Leads road craft: signs, priority, defensive driving, and closing remarks on discipline.",
      rw: "Iyobora ubuhanga bwo ku muhanda: ibimenyetso, ubanza, gutwara wirinda, n'ijambo ku myitwarire.",
    },
    portal: {
      en: "Log each session per cohort, record attendance, and note the incidents seen most.",
      rw: "Kwandika buri cyiciro kuri buri tsinda, kwandika abitabiriye, no kwandika impanuka zibonwa kenshi.",
    },
  },
  {
    id: "driving_school",
    label: { en: "Driving school", rw: "Ishuri ry'amasomo yo gutwara" },
    role: {
      en: "Practical hours: automatic and EV familiarisation, city drive-arounds, refresher assessment.",
      rw: "Amasaha y'imyitozo: kumenyera imodoka ya automatic n'iy'amashanyarazi, gutwara mu mujyi, isuzuma ryo kwibutsa.",
    },
    portal: {
      en: "Schedule practical sessions and record who completed the drive-around.",
      rw: "Gena ibyiciro by'imyitozo kandi wandike abarangije urugendo rwo mu mujyi.",
    },
  },
  {
    id: "bank",
    label: { en: "Bank or microfinance", rw: "Banki cyangwa ikigega" },
    role: {
      en: "Explains the loan product, the repayment table, and what a clean record earns next time.",
      rw: "Isobanura inguzanyo, imbonerahamwe y'ubwishyu, n'icyo inyandiko nziza imarira umushoferi ubutaha.",
    },
    portal: {
      en: "Book bankability sessions and see which cohorts have completed the money track.",
      rw: "Gena ibyiciro by'ikizere cya banki kandi urebe amatsinda yarangije icyiciro cy'amafaranga.",
    },
  },
  {
    id: "garage",
    label: { en: "VoltCare garage", rw: "Garage VoltCare" },
    role: {
      en: "Workshop training: charging, daily checks, battery health, and technician certification.",
      rw: "Amahugurwa muri garage: kuzuza umuriro, isuzuma rya buri munsi, ubuzima bwa bateri, n'impamyabushobozi z'abatekinisiye.",
    },
    portal: {
      en: "Publish workshop dates and log hands-on sessions delivered on the lift.",
      rw: "Tangaza itariki z'amahugurwa kandi wandike ibyiciro byakorewe ku modoka.",
    },
  },
  {
    id: "employer",
    label: { en: "Fleet or employer", rw: "Uwakoresha cyangwa ufite imodoka nyinshi" },
    role: {
      en: "Hires graduates with clean records, and releases authorised cars into UZA Shift.",
      rw: "Ushaka abarangije bafite inyandiko nziza, kandi utanga imodoka zemewe muri UZA Shift.",
    },
    portal: {
      en: "Post placement needs and confirm which graduates were hired.",
      rw: "Tangaza abakenerwa kandi wemeze abarangije bahawe akazi.",
    },
  },
];

export function kindLabel(kind: string): T {
  return partnerKinds.find((k) => k.id === kind)?.label ?? { en: kind, rw: kind };
}

/** Approved partners only — safe for the public directory. */
export function usePartnerDirectory() {
  return useQuery({
    queryKey: ["partner-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_orgs")
        .select("id, name, kind, district, about")
        .eq("status", "approved")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useMyPartnerOrgs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-partner-orgs", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_members")
        .select(
          "role, org_id, partner_orgs(id, name, kind, district, about, contact_name, contact_email, contact_phone, status)",
        );
      if (error) throw error;
      return (data ?? []).filter((row) => row.partner_orgs);
    },
  });
}

export function useApplyAsPartner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      kind: PartnerKind;
      district: string | null;
      about: string | null;
      contact_name: string | null;
      contact_email: string | null;
      contact_phone: string | null;
    }) => {
      if (!user) throw new Error("not signed in");
      const { error } = await supabase.from("partner_orgs").insert({ ...input, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-partner-orgs", user?.id] });
    },
  });
}

export function usePartnerSessions(orgId: string | undefined) {
  return useQuery({
    queryKey: ["partner-sessions", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_sessions")
        .select("id, title, track, scheduled_for, location, notes, learners_present, status, cohort_id")
        .eq("org_id", orgId!)
        .order("scheduled_for", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveSession(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      cohort_id?: string | null;
      scheduled_for?: string | null;
      location?: string | null;
      learners_present?: number | null;
      notes?: string | null;
      status?: string;
    }) => {
      if (!orgId) throw new Error("no organisation");
      const { error } = await supabase.from("partner_sessions").insert({ org_id: orgId, ...input });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner-sessions", orgId] }),
  });
}
