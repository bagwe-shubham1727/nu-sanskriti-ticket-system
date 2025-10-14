import { supabase } from "../config.js";

export default async function handler(req, res) {
    if (req.method === "GET") {
        const { data, error } = await supabase.from("tickets").select("*").order("number");
        return res.status(200).json({ data, error });
    }
    if (req.method === "POST") {
        const { name } = JSON.parse(req.body);
        const { data, error } = await supabase.from("tickets").insert([{ name }]).select();
        return res.status(200).json({ data, error });
    }
    res.status(405).end();
}
