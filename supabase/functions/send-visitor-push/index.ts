import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Only notify on new pending requests (not pre-approvals, not updates)
    if (record.status !== 'pending' || record.pre_approved) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    // Get the resident(s) for this flat
    const { data: residents, error: residentsError } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('flat_id', record.flat_id)
      .eq('role', 'resident');

    if (residentsError || !residents || residents.length === 0) {
      return new Response(JSON.stringify({ error: 'No residents found' }), { status: 200 });
    }

    // Get visitor name
    const { data: visitor } = await supabase
      .from('visitors')
      .select('name, visitor_type')
      .eq('id', record.visitor_id)
      .single();

    const messages = residents
      .filter((r) => r.push_token)
      .map((r) => ({
        to: r.push_token,
        sound: 'default',
        title: 'Visitor at the gate',
        body: `${visitor?.name ?? 'A visitor'} (${visitor?.visitor_type ?? 'guest'}) is waiting for approval`,
        data: { requestId: record.id },
      }));

    if (messages.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no push tokens' }), { status: 200 });
    }

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await pushResponse.json();

    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});