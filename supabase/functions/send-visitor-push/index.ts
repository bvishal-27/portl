import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    const alertType = payload.type; 

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    
    if (alertType === 'sos') {
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('push_token')
        .in('role', ['guard', 'admin']);

      if (staffError || !staff || staff.length === 0) {
        return new Response(JSON.stringify({ error: 'No guard/admin found' }), { status: 200 });
      }

      const { data: flat } = await supabase
        .from('flats')
        .select('flat_number')
        .eq('id', record.flat_id)
        .single();

      const { data: resident } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', record.resident_id)
        .single();

      const uniqueTokens = [...new Set(staff.filter((s) => s.push_token).map((s) => s.push_token))];

      const messages = uniqueTokens.map((token) => ({
        to: token,
        sound: 'default',
        priority: 'high',
        title: '🚨 SOS ALERT',
        body: `${resident?.full_name ?? 'A resident'} at Flat ${flat?.flat_number ?? '?'} needs help: ${record.emergency_type}`,
        data: { sosId: record.id },
      }));

      if (messages.length === 0) {
        return new Response(JSON.stringify({ skipped: 'no push tokens' }), { status: 200 });
      }

      const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      const result = await pushResponse.json();
      return new Response(JSON.stringify({ success: true, result }), { status: 200 });
    }

   if (record.status !== 'pending' || record.pre_approved) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { data: residents, error: residentsError } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('flat_id', record.flat_id)
      .eq('role', 'resident');

    if (residentsError || !residents || residents.length === 0) {
      return new Response(JSON.stringify({ error: 'No residents found' }), { status: 200 });
    }

    const { data: visitor } = await supabase
      .from('visitors')
      .select('name, visitor_type')
      .eq('id', record.visitor_id)
      .single();

    const uniqueTokens = [...new Set(residents.filter((r) => r.push_token).map((r) => r.push_token))];

    const messages = uniqueTokens.map((token) => ({
      to: token,
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
      headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await pushResponse.json();
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});