import { supabase } from "../config.js";

export default async function handler(req, res) {
    if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");
        return res.status(405).end();
    }
    const event = req.query?.event;
    if (!event) return res.status(400).json({ error: "event is required" });

    const { error } = await supabase.from("tickets").delete().eq("event_id", event);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
}
