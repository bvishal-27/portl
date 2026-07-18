// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type ExpoMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId: "default";
};

// Dedupe messages by push token so the same device never receives
// more than one push for the same event, even if multiple resident
// rows happen to share the same token (e.g. multiple test accounts
// logged in on one physical device).
function dedupeByToken(messages: ExpoMessage[]): ExpoMessage[] {
  const seen = new Set<string>();
  const result: ExpoMessage[] = [];
  for (const msg of messages) {
    if (!seen.has(msg.to)) {
      seen.add(msg.to);
      result.push(msg);
    }
  }
  return result;
}

async function sendExpoPush(messages: ExpoMessage[]) {
  const deduped = dedupeByToken(messages);
  if (deduped.length === 0) return { skipped: true };

  const chunks: ExpoMessage[][] = [];
  for (let i = 0; i < deduped.length; i += 100) {
    chunks.push(deduped.slice(i, i + 100));
  }

  const results = [];
  for (const chunk of chunks) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    results.push(await res.json());
  }
  return results;
}

// This endpoint is called by Database Webhooks using the secret (service role) key.
export default {
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    const payload = await req.json();
    const table = payload.table;
    const record = payload.record;

    if (!table || !record) {
      return Response.json({ error: "Missing table or record in payload" }, { status: 400 });
    }

    console.log("Webhook fired for table:", table);

    // ctx.supabaseAdmin bypasses RLS - needed to read push_token across all residents
    const supabase = ctx.supabaseAdmin;

    async function getAllResidentTokens() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, push_token")
        .eq("role", "resident")
        .not("push_token", "is", null);

      if (error) {
        console.error("Error fetching residents:", error.message);
        return [];
      }
      return (data ?? []).filter((r: any) => r.push_token);
    }

    let result: any;

    if (table === "visitor_requests") {
      const { flat_id, visitor_id, id: requestId } = record;

      const [{ data: visitor }, { data: flat }, { data: residents, error: residentsError }] = await Promise.all([
        supabase.from("visitors").select("name, visitor_type").eq("id", visitor_id).single(),
        supabase.from("flats").select("flat_number").eq("id", flat_id).single(),
        supabase
          .from("profiles")
          .select("id, push_token")
          .eq("flat_id", flat_id)
          .eq("role", "resident")
          .not("push_token", "is", null),
      ]);

      if (residentsError) {
        result = { error: residentsError.message };
      } else if (!residents || residents.length === 0) {
        result = { message: "No residents to notify for this flat" };
      } else {
        const visitorName = visitor?.name ?? "A visitor";
        const flatNumber = flat?.flat_number ?? "";

        const messages: ExpoMessage[] = residents
          .filter((r: any) => r.push_token)
          .map((r: any) => ({
            to: r.push_token,
            sound: "default",
            title: "New Visitor Request",
            body: `${visitorName} (${visitor?.visitor_type ?? "visitor"}) is waiting for approval${flatNumber ? ` - Flat ${flatNumber}` : ""}`,
            data: { type: "visitor_request", requestId, flatId: flat_id },
            channelId: "default",
          }));

        result = { sent: dedupeByToken(messages).length, result: await sendExpoPush(messages) };
      }
    } else if (table === "notices") {
      const residents = await getAllResidentTokens();

      if (residents.length === 0) {
        result = { message: "No residents to notify" };
      } else {
        const messages: ExpoMessage[] = residents.map((r: any) => ({
          to: r.push_token,
          sound: "default",
          title: "New Society Notice",
          body: record.title ?? "A new notice has been posted",
          data: { type: "notice", noticeId: record.id },
          channelId: "default",
        }));

        result = { sent: dedupeByToken(messages).length, result: await sendExpoPush(messages) };
      }
    } else if (table === "polls") {
      const residents = await getAllResidentTokens();

      if (residents.length === 0) {
        result = { message: "No residents to notify" };
      } else {
        const messages: ExpoMessage[] = residents.map((r: any) => ({
          to: r.push_token,
          sound: "default",
          title: "New Community Poll",
          body: record.question ?? "A new poll is open for voting",
          data: { type: "poll", pollId: record.id },
          channelId: "default",
        }));

        result = { sent: dedupeByToken(messages).length, result: await sendExpoPush(messages) };
      }
    } else {
      console.log("Unhandled table:", table);
      return Response.json({ message: `No handler for table ${table}` });
    }

    console.log("Result:", JSON.stringify(result));
    return Response.json({ success: true, result });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/notify-events' \
    --header 'apiKey: <your-secret-key>' \
    --data '{"table":"notices","record":{"id":"test","title":"Test notice"}}'

*/