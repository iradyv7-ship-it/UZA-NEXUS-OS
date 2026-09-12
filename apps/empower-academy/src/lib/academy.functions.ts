import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { coreCurriculum } from "@/content";

const FINAL_SLUG = "final-assessment";

/** Publishable-key client for public reads (RLS applies as anon). */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type FinalQuestion = {
  id: string;
  prompt_en: string;
  prompt_rw: string;
  options_en: string[];
  options_rw: string[];
};

export type FinalAssessment = {
  id: string;
  title_en: string;
  title_rw: string;
  pass_mark: number;
  max_attempts: number;
  questions: FinalQuestion[];
};

/** Public: the exam paper without answers. */
export const getFinalAssessment = createServerFn({ method: "GET" }).handler(
  async (): Promise<FinalAssessment | null> => {
    const supabase = publicClient();
    const { data: assessment, error } = await supabase
      .from("assessments")
      .select("id, title_en, title_rw, pass_mark, max_attempts")
      .eq("slug", FINAL_SLUG)
      .maybeSingle();
    if (error) throw error;
    if (!assessment) return null;

    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, prompt_en, prompt_rw, options_en, options_rw")
      .eq("assessment_id", assessment.id)
      .order("sort_order", { ascending: true });
    if (qError) throw qError;

    return {
      ...assessment,
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        prompt_en: q.prompt_en,
        prompt_rw: q.prompt_rw,
        options_en: q.options_en as string[],
        options_rw: q.options_rw as string[],
      })),
    };
  },
);

export type AttemptResult = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  wrongQuestionIds: string[];
};

/**
 * Grades the final assessment on the server. Correct answers never reach the
 * browser, and the attempt row is written with the service role so a learner
 * cannot forge a pass.
 */
export const submitFinalAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        answers: z.record(z.string().uuid(), z.number().int().min(0).max(9)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AttemptResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: assessment, error } = await supabaseAdmin
      .from("assessments")
      .select("id, pass_mark, max_attempts")
      .eq("slug", FINAL_SLUG)
      .single();
    if (error) throw error;

    const { count } = await supabaseAdmin
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessment.id)
      .eq("user_id", userId);
    const used = count ?? 0;
    if (used >= assessment.max_attempts) {
      throw new Error("No attempts remaining. Contact your facilitator.");
    }

    const { data: questions, error: qError } = await supabaseAdmin
      .from("questions")
      .select("id, correct_index")
      .eq("assessment_id", assessment.id);
    if (qError) throw qError;

    const total = questions.length;
    const wrongQuestionIds: string[] = [];
    let score = 0;
    for (const q of questions) {
      const chosen = data.answers[q.id];
      if (chosen === q.correct_index) score += 1;
      else wrongQuestionIds.push(q.id);
    }
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percent >= assessment.pass_mark;

    const { data: attempt, error: aError } = await supabaseAdmin
      .from("assessment_attempts")
      .insert({ assessment_id: assessment.id, user_id: userId, score, total, passed })
      .select("id")
      .single();
    if (aError) throw aError;

    await supabaseAdmin.from("attempt_answers").insert(
      questions.map((q) => ({
        attempt_id: attempt.id,
        question_id: q.id,
        chosen_index: data.answers[q.id] ?? -1,
        correct: data.answers[q.id] === q.correct_index,
      })),
    );

    return {
      score,
      total,
      percent,
      passed,
      attemptsUsed: used + 1,
      attemptsLeft: Math.max(0, assessment.max_attempts - (used + 1)),
      wrongQuestionIds,
    };
  });

export type FinalStatus = {
  passMark: number;
  maxAttempts: number;
  attemptsUsed: number;
  bestPercent: number | null;
  passed: boolean;
};

export const getFinalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinalStatus> => {
    const { supabase, userId } = context;
    const { data: assessment, error } = await supabase
      .from("assessments")
      .select("id, pass_mark, max_attempts")
      .eq("slug", FINAL_SLUG)
      .single();
    if (error) throw error;

    const { data: attempts, error: aError } = await supabase
      .from("assessment_attempts")
      .select("score, total, passed")
      .eq("assessment_id", assessment.id)
      .eq("user_id", userId);
    if (aError) throw aError;

    const percents = (attempts ?? []).map((a) =>
      a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
    );
    return {
      passMark: assessment.pass_mark,
      maxAttempts: assessment.max_attempts,
      attemptsUsed: attempts?.length ?? 0,
      bestPercent: percents.length ? Math.max(...percents) : null,
      passed: (attempts ?? []).some((a) => a.passed),
    };
  });

export type CertificateRecord = {
  certificate_id: string;
  learner_name: string;
  cohort_label: string | null;
  issued_on: string;
  modules_completed: number;
  final_score: number | null;
  revoked_at: string | null;
};

export const getMyCertificate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateRecord | null> => {
    const { data, error } = await context.supabase
      .from("certificates")
      .select(
        "certificate_id, learner_name, cohort_label, issued_on, modules_completed, final_score, revoked_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

function newCertificateId(year: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) tail += alphabet[b % alphabet.length];
  return `UZA-EMP-${year}-${tail}`;
}

/**
 * Issues the certificate only when every core module is complete AND the final
 * assessment has been passed. Both conditions are re-checked server-side.
 */
export const issueMyCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateRecord> => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("certificates")
      .select(
        "certificate_id, learner_name, cohort_label, issued_on, modules_completed, final_score, revoked_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return existing;

    const requiredSlugs = coreCurriculum.map((m) => m.id);
    const { data: progress, error: pError } = await supabase
      .from("module_progress")
      .select("module_id")
      .not("completed_at", "is", null);
    if (pError) throw pError;
    const doneSlugs = new Set((progress ?? []).map((r) => r.module_id));
    const missing = requiredSlugs.filter((slug) => !doneSlugs.has(slug));
    if (missing.length > 0) {
      throw new Error(`${missing.length} core module(s) are still incomplete.`);
    }

    const { data: assessment, error: asError } = await supabase
      .from("assessments")
      .select("id, pass_mark")
      .eq("slug", FINAL_SLUG)
      .single();
    if (asError) throw asError;

    const { data: attempts, error: atError } = await supabase
      .from("assessment_attempts")
      .select("score, total, passed")
      .eq("assessment_id", assessment.id)
      .eq("user_id", userId)
      .eq("passed", true);
    if (atError) throw atError;
    if (!attempts || attempts.length === 0) {
      throw new Error("The final assessment has not been passed yet.");
    }
    const best = Math.max(
      ...attempts.map((a) => (a.total > 0 ? Math.round((a.score / a.total) * 100) : 0)),
    );

    const { data: profile, error: prError } = await supabase
      .from("profiles")
      .select("full_name, cohort_id, cohorts(code, name)")
      .eq("id", userId)
      .maybeSingle();
    if (prError) throw prError;

    const learnerName = profile?.full_name?.trim();
    if (!learnerName) {
      throw new Error("Add your full name to your profile before issuing the certificate.");
    }
    const cohortLabel = profile?.cohorts
      ? `${profile.cohorts.code} · ${profile.cohorts.name}`
      : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const year = new Date().getUTCFullYear();
    for (let i = 0; i < 5; i += 1) {
      const { data: inserted, error } = await supabaseAdmin
        .from("certificates")
        .insert({
          certificate_id: newCertificateId(year),
          user_id: userId,
          cohort_id: profile?.cohort_id ?? null,
          learner_name: learnerName,
          cohort_label: cohortLabel,
          modules_completed: requiredSlugs.length,
          final_score: best,
        })
        .select(
          "certificate_id, learner_name, cohort_label, issued_on, modules_completed, final_score, revoked_at",
        )
        .single();
      if (!error && inserted) return inserted;
      if (error && !error.message.includes("duplicate key")) throw error;
    }
    throw new Error("Could not allocate a certificate number. Try again.");
  });

export type VerificationResult =
  | { found: false }
  | {
      found: true;
      certificate_id: string;
      learner_name: string;
      cohort_label: string | null;
      issued_on: string;
      valid: boolean;
    };

/** Public: what a bank officer sees. Nothing beyond this is exposed. */
export const verifyCertificate = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ certificateId: z.string().trim().min(4).max(64) }).parse(input),
  )
  .handler(async ({ data }): Promise<VerificationResult> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase.rpc("verify_certificate", {
      _certificate_id: data.certificateId,
    });
    if (error) throw error;
    const row = rows?.[0];
    if (!row) return { found: false };
    return {
      found: true,
      certificate_id: row.certificate_id,
      learner_name: row.learner_name,
      cohort_label: row.cohort_label,
      issued_on: row.issued_on,
      valid: row.valid,
    };
  });
