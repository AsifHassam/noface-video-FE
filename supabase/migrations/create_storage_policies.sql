-- Storage policies for UGC video and audio uploads
-- These policies allow authenticated users to upload and access their own files

-- Policy for 'audios' bucket: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audios' AND
  (storage.foldername(name))[1] = 'ugc-audio'
);

-- Policy for 'audios' bucket: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audios' AND
  (storage.foldername(name))[1] = 'ugc-audio'
);

-- Policy for 'audios' bucket: Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update audio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audios' AND
  (storage.foldername(name))[1] = 'ugc-audio'
)
WITH CHECK (
  bucket_id = 'audios' AND
  (storage.foldername(name))[1] = 'ugc-audio'
);

-- Policy for 'audios' bucket: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audios' AND
  (storage.foldername(name))[1] = 'ugc-audio'
);

-- Policy for 'videos' bucket: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload video files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'ugc-videos'
);

-- Policy for 'videos' bucket: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read video files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'ugc-videos'
);

-- Policy for 'videos' bucket: Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update video files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'ugc-videos'
)
WITH CHECK (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'ugc-videos'
);

-- Policy for 'videos' bucket: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete video files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'ugc-videos'
);

-- Policy for 'images' bucket: Allow authenticated users to upload their own files
CREATE POLICY "Authenticated users can upload image files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

-- Policy for 'images' bucket: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read their own image files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

-- Policy for 'images' bucket: Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update their own image files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

-- Policy for 'images' bucket: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete their own image files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'images' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = (auth.uid())::text
);

