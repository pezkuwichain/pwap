-- Storage policies for p2p-payment-proofs bucket
-- Users are wallet-based (no auth.uid()), so policies must be open
-- Proof files auto-expire in 1 day via cleanup-proofs edge function

-- Allow anyone to upload payment proofs
CREATE POLICY "Allow payment proof uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'p2p-payment-proofs');

-- Allow anyone to read payment proofs (public bucket)
CREATE POLICY "Allow payment proof reads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'p2p-payment-proofs');

-- Allow deletion (for cleanup-proofs edge function via service role)
CREATE POLICY "Allow payment proof deletes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'p2p-payment-proofs');
