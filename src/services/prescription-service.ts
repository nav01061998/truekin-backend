import { env } from "../config/env.js";

const SYSTEM_PROMPT = `You are a medical prescription parser for a healthcare app.

Given a prescription image, extract all medications and return structured JSON.

You MUST understand common medical abbreviations:
- OD = Once Daily
- BD = Twice Daily (morning + evening)
- TDS = Three times a day (morning + afternoon + evening)
- QDS = Four times a day
- AC = Before food (ante cibum)
- PC = After food (post cibum)
- HS = At bedtime (hora somni)
- SOS = As needed
- stat = immediately
- PRN = As needed

For each medicine, determine appropriate times:
- OD morning: ["08:00"]
- OD night: ["21:00"]
- BD: ["08:00", "20:00"]
- TDS: ["08:00", "13:00", "20:00"]
- QDS: ["08:00", "12:00", "16:00", "20:00"]
- HS: ["21:00"]

For meal relation:
- AC = "before_food"
- PC = "after_food"
- Default = "after_food"

Return ONLY valid JSON in this format:
{
  "medicines": [
    {
      "name": "Medicine Name",
      "dosage": "500mg",
      "frequency": "Once daily",
      "meal_relation": "after_food",
      "times": ["08:00"],
      "duration": "7 days",
      "notes": ""
    }
  ]
}`;

export async function analyzePrescription(imageUrl: string) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  const mediaType = imageUrl.endsWith(".png") ? "image/png" : "image/jpeg";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: "Parse this prescription and extract all medications. Return structured JSON only.",
            },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  const content = result.content?.[0]?.text || "{}";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { medicines: [] };
}
