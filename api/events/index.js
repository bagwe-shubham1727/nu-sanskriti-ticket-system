import { supabase } from "../config.js";
import crypto from "node:crypto";

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
        const { data, error } = await supabase
            .from("events")
            .select("id, name, is_active, created_at")
            .order("created_at", { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }

    if (req.method === "POST") {
        const { name, pin } = getBody(req);
        if (!name?.trim() || !pin?.trim()) {
            return res.status(400).json({ error: "name and pin are required" });
        }
        const pin_hash = crypto.createHash("sha256").update(pin).digest("hex");

        // create event
        const { data: ev, error: e1 } = await supabase
            .from("events")
            .insert([{ name: name.trim(), pin_hash }])
            .select("id, name, is_active, created_at")
            .single();
        if (e1) return res.status(500).json({ error: e1.message });

        // init counter row
        const { error: e2 } = await supabase
            .from("event_counters")
            .insert([{ event_id: ev.id, last_number: 0 }]);
        if (e2) return res.status(500).json({ error: e2.message });

        return res.status(201).json({ data: ev });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
}
