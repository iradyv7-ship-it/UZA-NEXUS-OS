
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS id_photo_url text,
  ADD COLUMN IF NOT EXISTS licence_photo_url text,
  ADD COLUMN IF NOT EXISTS insurance_photo_url text,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS docs_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS offered_driver_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS offered_until timestamptz;

CREATE INDEX IF NOT EXISTS trips_dispatch_idx ON public.trips (status, vehicle_type, requested_at);

DROP POLICY IF EXISTS "driver docs owner read" ON storage.objects;
CREATE POLICY "driver docs owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_ops(auth.uid())));

DROP POLICY IF EXISTS "driver docs owner write" ON storage.objects;
CREATE POLICY "driver docs owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "driver docs owner update" ON storage.objects;
CREATE POLICY "driver docs owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "driver docs owner delete" ON storage.objects;
CREATE POLICY "driver docs owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
