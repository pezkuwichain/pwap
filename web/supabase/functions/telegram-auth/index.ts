import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyTelegramHash(data: Record<string, string>, botToken: string): Promise<boolean> {
  const { hash, ...fields } = data

  // Build check string: sorted "key=value" lines joined by "\n"
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // Telegram Login Widget: secret_key = SHA-256(bot_token), used as HMAC key
  const encoder = new TextEncoder()
  const secretKeyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(botToken))
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(checkString))
  const expectedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return expectedHash === hash
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { id, first_name, last_name, username, photo_url, auth_date, hash, bot_id } = body

    const botToken = bot_id === '8690398980'
      ? Deno.env.get('TELEGRAM_BOT_TOKEN_PEZMOM')
      : Deno.env.get('TELEGRAM_BOT_TOKEN_PEXSEC')
    if (!botToken) throw new Error('Bot token not configured for bot_id: ' + bot_id)

    if (!id || !hash || !auth_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Reject stale auth data (older than 24 hours)
    const authDateNum = parseInt(auth_date, 10)
    if (Date.now() / 1000 - authDateNum > 86400) {
      return new Response(JSON.stringify({ error: 'Auth data expired' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify hash
    const fields: Record<string, string> = { id: String(id), auth_date: String(auth_date) }
    if (first_name) fields.first_name = first_name
    if (last_name) fields.last_name = last_name
    if (username) fields.username = username
    if (photo_url) fields.photo_url = photo_url

    const isValid = await verifyTelegramHash({ ...fields, hash }, botToken)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid hash' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const email = `tg_${id}@telegram.pezkuwichain.io`
    const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || `tg_${id}`

    // Find or create user
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (!existingUser) {
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
          avatar_url: photo_url || null,
          telegram_id: id,
          telegram_username: username || null,
          provider: 'telegram',
        },
      })
      if (createError) throw createError
    }

    // Generate magic link token
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: Deno.env.get('SITE_URL') || 'https://app.pezkuwichain.io/' },
    })
    if (linkError) throw linkError

    return new Response(
      JSON.stringify({
        email,
        token_hash: linkData.properties.hashed_token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
