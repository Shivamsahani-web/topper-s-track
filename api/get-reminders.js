export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/reminders?select=slot,time,task,image_url,enabled&order=slot.asc`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Supabase fetch error:", errText);
      res.status(502).json({ error: "Could not fetch reminders" });
      return;
    }

    const reminders = await response.json();
    res.status(200).json({ reminders });
  } catch (err) {
    console.error("get-reminders error:", err);
    res.status(500).json({ error: "Failed to load reminders" });
  }
}
