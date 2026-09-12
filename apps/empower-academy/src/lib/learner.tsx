import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useCohorts() {
  return useQuery({
    queryKey: ["cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id, code, name, location, facilitator, starts_on")
        .order("starts_on", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, lang, cohort_id, cohorts(id, code, name, location, facilitator, starts_on)",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { full_name?: string; phone?: string; cohort_id?: string | null }) => {
      if (!user) throw new Error("not signed in");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
}

/** Latest module completion timestamp for the signed-in learner. */
export function useCompletionDates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["completion-dates", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_progress")
        .select("module_id, completed_at")
        .not("completed_at", "is", null);
      if (error) throw error;
      return data as { module_id: string; completed_at: string }[];
    },
  });
}
