import { supabase } from "../config.js";

function getBody(req) {
    try {
        if (!req.body) return {};
        if (typeof req.body === "string") return JSON.parse(req.body);
        if (typeof req.body === "object") return req.body;
    } catch { /* empty */ }
    return {};
}

export default async function handler(req, res) {
    if (req.method === "GET") {
        const event = req.query?.event;
        if (!event) return res.status(400).json({ error: "event is required" });

        const { data, error } = await supabase
            .from("tickets")
            .select("id, event_id, number, name, status, created_at")
            .eq("event_id", event)
            .order("number", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }

    if (req.method === "POST") {
        const { name, event_id } = getBody(req);
        if (!name?.trim() || !event_id) {
            return res.status(400).json({ error: "name and event_id are required" });
        }

        // atomically increment counter and get the next number
        const { data: counter, error: e1 } = await supabase
            .from("event_counters")
            .update({ last_number: supabase.rpc ? undefined : undefined }) // placeholder to avoid TS hints
            .eq("event_id", event_id)
            .select("last_number")
            .single();

        // Workaround for atomic increment: do it with a single UPDATE ... returning
        // Supabase client doesn't expose expressions; use RPC helper instead:
        // Create an RPC in DB:
        // create or replace function bump_counter(e uuid) returns int language sql as
        // $$ update event_counters set last_number = last_number + 1 where event_id = e returning last_number; $$;

        // Then call:
        const { data: nextNum, error: eBump } = await supabase.rpc("bump_counter", { e: event_id });
        if (eBump) return res.status(500).json({ error: eBump.message });

        const number = Array.isArray(nextNum) ? nextNum[0] : nextNum;

        const { data, error: e2 } = await supabase
            .from("tickets")
            .insert([{ event_id, name: name.trim(), number }])
            .select("id, event_id, number, name, status, created_at");

        if (e2) return res.status(500).json({ error: e2.message });
        return res.status(201).json({ data });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
}
