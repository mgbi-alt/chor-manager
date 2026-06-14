import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: cors })

  // Verify caller is logged in and is admin
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: cors })

  // Parse request
  const { userId, email, password } = await req.json()
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: cors })

  const updates: Record<string, string> = {}
  if (email) updates.email = email
  if (password) updates.password = password
  if (!Object.keys(updates).length) {
    return new Response(JSON.stringify({ ok: true }), { headers: cors })
  }

  // Use service role to update auth user
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { error } = await admin.auth.admin.updateUserById(userId, updates)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })

  return new Response(JSON.stringify({ ok: true }), { headers: cors })
})
