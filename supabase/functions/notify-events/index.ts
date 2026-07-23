import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type ExpoMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
  channelId: "default";
};

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

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    const payload = await req.json();
    const table = payload.table;
    const record = payload.record;

    if (!table || !record) {
      return Response.json({ error: "Missing table or record in payload" }, { status: 400 });
    }

    console.log("Webhook fired for table:", table);
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
      // Skip sending push notifications if request is pre-approved or not pending
      if (record.status !== "pending" || record.pre_approved) {
        return Response.json({ skipped: "Request is pre-approved or not pending" });
      }

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
        const visitorType = visitor?.visitor_type ?? "guest";

        const messages: ExpoMessage[] = residents
          .filter((r: any) => r.push_token)
          .map((r: any) => ({
            to: r.push_token,
            sound: "default",
            title: "🚪 Visitor Request at Main Gate",
            body: `${visitorName} (${visitorType}) is requesting entry to your flat.`,
            data: { type: "visitor_request", visitorRequestId: requestId, requestId, flatId: flat_id },
            categoryId: "VISITOR_APPROVAL", // Displays [✅ Allow Entry] & [❌ Deny Entry]
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
          title: "📢 Society Announcement",
          body: record.title ?? "A new notice has been posted by management.",
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
          title: "📊 Community Poll Open",
          body: record.question ?? "A new poll is open for voting.",
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