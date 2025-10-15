import { supabase } from "../../config.js";
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
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).end();
    }
    const id = req.query?.id;
    const { pin } = getBody(req);
    if (!id || !pin) return res.status(400).json({ error: "id and pin required" });

    const { data: ev, error } = await supabase
        .from("events")
        .select("id, pin_hash")
        .eq("id", id)
        .single();
    if (error || !ev) return res.status(404).json({ error: "event not found" });

    const hash = crypto.createHash("sha256").update(pin).digest("hex");
    const ok = hash === ev.pin_hash;
    return res.status(ok ? 200 : 401).json({ ok });
}
