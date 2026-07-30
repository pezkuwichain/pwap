// Identify the caller from their JWT instead of trusting the request body.
//
// Functions that run with the service role bypass RLS entirely, so whatever
// user id they act on is the whole authorisation decision. Reading that id from
// the body means any caller can name any account: with only the public anon key
// — which every browser has — a request could read or change another user's
// records. VERIFY_JWT does not help, because the anon key is itself a valid JWT.
//
// The client already sends the signed-in user's token: supabase.functions.invoke
// puts the session access token in the Authorization header. These helpers read
// the caller from it, so the body's userId can be ignored.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export const ALLOWED_ORIGINS = [
  'https://app.pezkuwichain.io',
  'https://www.pezkuwichain.io',
  'https://pezkuwichain.io',
  'https://pex.mom',
]

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

/**
 * The signed-in user behind this request, or null.
 *
 * Returns null for the anon key: it carries no user, so getUser rejects it.
 * That is the point — an anon-key call must not be able to act on an account.
 */
export async function getCaller(
  req: Request,
  serviceClient: SupabaseClient
): Promise<{ id: string; email?: string } | null> {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null

  const jwt = header.slice('Bearer '.length).trim()
  if (!jwt) return null

  const {
    data: { user },
    error,
  } = await serviceClient.auth.getUser(jwt)

  if (error || !user) return null
  return { id: user.id, email: user.email ?? undefined }
}

/** Admin or super_admin in admin_roles. Moderators are not admins here. */
export async function isAdmin(serviceClient: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await serviceClient
    .from('admin_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return false
  return data.role === 'super_admin' || data.role === 'admin'
}

export function unauthorized(corsHeaders: Record<string, string>, message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function forbidden(corsHeaders: Record<string, string>, message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
