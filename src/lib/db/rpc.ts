import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Functions = Database["public"]["Functions"];

/**
 * Typed wrapper around .rpc() for any Supabase client typed against Database
 * (createSupabaseServerClient() or createSupabaseAdminClient()). Works around a verified
 * @supabase/ssr@0.6.1 issue (docs/contracts/requests.md, Agent 4's finding, reproduced independently):
 * createServerClient<Database>'s .rpc() infers its second argument as `undefined` regardless of the real
 * function signature, for every SchemaName/Schema type-argument combination tried; plain
 * createClient<Database> is unaffected. The client parameter is deliberately untyped (`unknown`, cast
 * internally) rather than pinned to SupabaseClient<Database, ...>: createSupabaseServerClient() (via
 * @supabase/ssr) and createSupabaseAdminClient() (via plain @supabase/supabase-js) resolve to different
 * generic arities for SupabaseClient's schema-related type parameters in this dependency graph, so
 * pinning either one rejects the other, matching the `as never`/`as unknown as X` pattern already used
 * throughout this codebase's Supabase call sites (e.g. src/lib/availability/actions.ts) for the same
 * class of typed-client friction.
 */
export async function callRpc<FnName extends keyof Functions>(
  supabase: unknown,
  fn: FnName,
  args: Functions[FnName]["Args"],
): Promise<{ data: Functions[FnName]["Returns"] | null; error: PostgrestError | null }> {
  const client = supabase as {
    rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: PostgrestError | null }>;
  };
  const { data, error } = await client.rpc(fn, args);

  return { data: data as Functions[FnName]["Returns"] | null, error };
}
