import type { Api } from "./types";
import { createLocalApi } from "./local";
import { createSupabaseApi } from "./supabase";

export function createApi(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? createSupabaseApi(url, key) : createLocalApi();
}
