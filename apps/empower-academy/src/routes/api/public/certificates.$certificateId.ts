import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/**
 * Certificate verification API — the integration boundary for UZA Mobility's
 * financing pipeline (Uza EV Fleet) and for partner banks.
 *
 *   GET /api/public/certificates/:certificateId
 *
 * Response (200):
 *   { success: true, message: string, data: {
 *       certificate_id: string,
 *       learner_name: string,
 *       cohort: string | null,
 *       issued_on: "YYYY-MM-DD",
 *       valid: boolean,
 *       programme: "Urugendo Rw'Ubukungu — UZA Empower"
 *   } }
 *
 * Response (404): { success: false, message: "Certificate not found", data: null }
 *
 * Deliberate limits: this endpoint returns ONLY the fields printed on the
 * certificate itself. It never exposes phone numbers, emails, quiz answers,
 * attempt history, module-level progress or any other learner data.
 */
const paramSchema = z.object({ certificateId: z.string().trim().min(4).max(64) });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/certificates/$certificateId")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const parsed = paramSchema.safeParse(params);
        if (!parsed.success) {
          return json({ success: false, message: "Invalid certificate ID", data: null }, 400);
        }

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

        const { data, error } = await supabase.rpc("verify_certificate", {
          _certificate_id: parsed.data.certificateId,
        });
        if (error) {
          return json({ success: false, message: "Verification unavailable", data: null }, 502);
        }

        const row = data?.[0];
        if (!row) {
          return json({ success: false, message: "Certificate not found", data: null }, 404);
        }

        return json(
          {
            success: true,
            message: row.valid ? "Certificate is valid" : "Certificate has been revoked",
            data: {
              certificate_id: row.certificate_id,
              learner_name: row.learner_name,
              cohort: row.cohort_label,
              issued_on: row.issued_on,
              valid: row.valid,
              programme: "Urugendo Rw'Ubukungu — UZA Empower",
            },
          },
          200,
        );
      },
    },
  },
});
