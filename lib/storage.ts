import type { SupabaseClient } from "@supabase/supabase-js";

export async function deleteStoragePrefix(admin: SupabaseClient, bucket: string, prefix: string) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  const files: string[] = [];
  for (const object of data || []) {
    const path = `${prefix}/${object.name}`;
    if (object.id) files.push(path);
    else await deleteStoragePrefix(admin, bucket, path);
  }
  if (files.length) {
    const { error: removeError } = await admin.storage.from(bucket).remove(files);
    if (removeError) throw removeError;
  }
}
