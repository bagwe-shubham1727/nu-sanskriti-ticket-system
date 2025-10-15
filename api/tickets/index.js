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
    if (req.method === "GET") {
        const { data, error } = await supabase
            .from("tickets")
            .select("id, number, name, status, created_at")
            .order("number", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }

    if (req.method === "POST") {
        const body = getBody(req);
        const name = (body.name || "").trim();
        if (!name) return res.status(400).json({ error: "Name is required" });

        const { data, error } = await supabase
            .from("tickets")
            .insert([{ name }])
            .select("id, number, name, status, created_at");

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ data });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
}
