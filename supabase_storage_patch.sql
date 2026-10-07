-- Create storage policy to allow authenticated users to upload files to the "uploads" bucket
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Create storage policy to allow public to view files
CREATE POLICY "Allow public viewing of uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- Create storage policy to allow users to update their own uploads
CREATE POLICY "Allow users to update their own uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND auth.uid() = owner);

-- Create storage policy to allow users to delete their own uploads
CREATE POLICY "Allow users to delete their own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND auth.uid() = owner);
