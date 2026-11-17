// Shared by the /api routes (the "_" keeps Vercel from serving this file as a route).

export type SupabaseCaller = { url: string; key: string; token: string };

/**
 * Checks the request comes from the signed-in trip account: Supabase vouches for the token's email.
 * Returns the caller's Supabase details, or an error Response to send back.
 */
export async function tripAccount(request: Request): Promise<SupabaseCaller | Response> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail(500, "Not set up: the Supabase env is missing");
  const token = request.headers.get("authorization") ?? "";
  const user = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: token } });
  if (!user.ok) return fail(401, "Signed out — open the app again and sign in");
  const { email } = (await user.json()) as { email?: string };
  if (!email || email !== process.env.VITE_APP_EMAIL) return fail(403, "This account isn't allowed");
  return { url, key, token };
}

export function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}
