import { supabase } from "../config.js";

function getBody(req) {
    try {
        if (!req.body) return {};
        if (typeof req.body === "string") return JSON.parse(req.body);
        if (typeof req.body === "object") return req.body;
        return {};
    } catch {
        return {};
    }
}

export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing id" });

    if (req.method === "PATCH") {
        const patch = getBody(req);
        if (patch.status && !["waiting", "done", "canceled"].includes(patch.status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const { data, error } = await supabase
            .from("tickets")
            .update(patch)
            .eq("id", id)
            .select("id, number, name, status, created_at");

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }

    if (req.method === "DELETE") {
        const { error } = await supabase.from("tickets").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).end();
}
