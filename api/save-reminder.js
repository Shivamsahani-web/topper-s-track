export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { slot, time, task, enabled, imageBase64, imageMime, clearImage } = req.body || {};

  if (!slot || slot < 1 || slot > 10) {
    res.status(400).json({ error: "Valid slot (1-10) is required" });
    return;
  }

  try {
    const updateData = { time, task, enabled: !!enabled };

    if (clearImage) {
      updateData.image_url = null;
    }

    if (imageBase64 && imageMime) {
      const ext = imageMime.split("/")[1] || "jpg";
      const filename = `slot-${slot}-${Date.now()}.${ext}`;
      const imageBuffer = Buffer.from(imageBase64, "base64");

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/reminder-images/${filename}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": imageMime,
            "x-upsert": "true",
          },
          body: imageBuffer,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error("Supabase storage upload error:", errText);
        res.status(502).json({ error: "Image upload failed" });
        return;
      }

      updateData.image_url = `${SUPABASE_URL}/storage/v1/object/public/reminder-images/${filename}`;
    }

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/reminders?slot=eq.${slot}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(updateData),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("Supabase update error:", errText);
      res.status(502).json({ error: "Could not save reminder" });
      return;
    }

    const updated = await updateRes.json();
    res.status(200).json({ reminder: updated[0] || null });
  } catch (err) {
    console.error("save-reminder error:", err);
    res.status(500).json({ error: "Failed to save reminder" });
  }
}
