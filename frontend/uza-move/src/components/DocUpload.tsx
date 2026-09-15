import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  label: string;
  hint?: string;
  userId: string;
  slot: string;
  value: string;
  onChange: (path: string) => void;
};

/**
 * Camera-first document capture. Files land in the private `driver-docs`
 * bucket under the signed-in user's folder, so only they and ops can read it.
 * We keep the storage path (not a URL) so the document never becomes public.
 */
export function DocUpload({ label, hint, userId, slot, value, onChange }: Props) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Photo is too large — keep it under 6 MB.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("driver-docs")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      onChange(path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${
          value ? "border-primary bg-primary/5" : "border-input bg-card"
        }`}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : value ? (
          <CheckCircle2 className="size-5 text-primary" />
        ) : (
          <Camera className="size-5 text-muted-foreground" />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {value ? "Photo added — tap to replace" : (hint ?? "Take a photo or choose a file")}
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
