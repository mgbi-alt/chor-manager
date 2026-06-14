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

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: cors })

  // Use service role to bypass RLS
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { userId, email, password, profile } = await req.json()
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: cors })

  // Update profile fields (name, phone, stimme, role2, email) via service role — bypasses RLS
  if (profile && Object.keys(profile).length) {
    const { error } = await admin.from('profiles').update(profile).eq('id', userId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
  }

  // Update auth (email / password)
  const authUpdates: Record<string, string> = {}
  if (email) authUpdates.email = email
  if (password) authUpdates.password = password
  if (Object.keys(authUpdates).length) {
    const { error } = await admin.auth.admin.updateUserById(userId, authUpdates)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: cors })
})
