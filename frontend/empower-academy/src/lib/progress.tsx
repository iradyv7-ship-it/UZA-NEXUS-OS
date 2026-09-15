import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const LOCAL_KEY = "uza-progress";

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Module progress. Signed-out learners keep progress on the device; once they
 * sign in, device progress is merged into their account and follows them
 * to any phone or classroom computer.
 */
export function useProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<string[]>([]);
  const merged = useRef(false);

  useEffect(() => {
    setLocal(readLocal());
  }, []);

  const cloud = useQuery({
    queryKey: ["progress", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_progress")
        .select("module_id, completed_at")
        .not("completed_at", "is", null);
      if (error) throw error;
      return data.map((row) => row.module_id);
    },
  });

  // One-time merge of device progress into the account.
  useEffect(() => {
    if (!user || merged.current || !cloud.data) return;
    const pending = readLocal().filter((id) => !cloud.data.includes(id));
    merged.current = true;
    if (pending.length === 0) return;
    void supabase
      .from("module_progress")
      .upsert(
        pending.map((module_id) => ({
          user_id: user.id,
          module_id,
          completed_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,module_id" },
      )
      .then(() => {
        localStorage.removeItem(LOCAL_KEY);
        setLocal([]);
        void queryClient.invalidateQueries({ queryKey: ["progress", user.id] });
      });
  }, [user, cloud.data, queryClient]);

  const done = user ? (cloud.data ?? []) : local;

  const mutation = useMutation({
    mutationFn: async ({ moduleId, complete }: { moduleId: string; complete: boolean }) => {
      if (!user) throw new Error("not signed in");
      if (!complete) {
        const { error } = await supabase
          .from("module_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("module_id", moduleId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("module_progress").upsert(
        { user_id: user.id, module_id: moduleId, completed_at: new Date().toISOString() },
        { onConflict: "user_id,module_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress", user?.id] }),
  });

  const toggle = (moduleId: string) => {
    const complete = !done.includes(moduleId);
    if (!user) {
      setLocal((prev) => {
        const next = complete ? [...prev, moduleId] : prev.filter((x) => x !== moduleId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    mutation.mutate({ moduleId, complete });
  };

  return { done, toggle, signedIn: Boolean(user), saving: mutation.isPending };
}
