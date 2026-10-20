function normalizeSupabaseUrl(raw: string) {
  return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local",
    );
  }

  return {
    url: normalizeSupabaseUrl(url),
    anonKey,
  };
}
