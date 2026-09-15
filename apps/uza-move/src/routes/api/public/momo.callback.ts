import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payload = z.object({
  external_ref: z.string().min(4).max(120),
  status: z.enum(["successful", "failed", "SUCCESSFUL", "FAILED"]),
});

/**
 * The ONLY place a MoMo payment becomes real. SMS, screenshots and a driver's
 * word never mark a trip paid — only a verified provider callback does.
 */
export const Route = createFileRoute("/api/public/momo/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["MOMO_CALLBACK_SECRET"];
        if (secret && request.headers.get("x-momo-signature") !== secret) {
          return new Response("Invalid signature", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const parsed = payload.safeParse(body);
        if (!parsed.success) return new Response("Bad payload", { status: 400 });

        const { settleMomoCollection } = await import("@/lib/momo.server");
        const outcome = parsed.data.status.toLowerCase() as "successful" | "failed";
        const result = await settleMomoCollection(parsed.data.external_ref, outcome, {
          source: "provider_callback",
        });

        return Response.json({ ok: true, result });
      },
    },
  },
});
