import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const predictHumidity = async (params: {
  location: string;
  neighborCrops: string;
  currentWeather: string;
}) => {
  const prompt = `
    As an agricultural AI expert for "AgroTech", predict the estimated soil humidity percentage (0-100) based on:
    - Location: ${params.location}
    - Crops grown by neighbors: ${params.neighborCrops}
    - General weather description: ${params.currentWeather}

    Return ONLY a JSON object with a single key "humidity" and the numeric value.
    Example: {"humidity": 65}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return data.humidity || 50;
  } catch (e) {
    return 50;
  }
};

export const analyzeSoil = async (params: {
  ph: number;
  humidity: number;
  season: string;
  waterAvailability: string;
  isBeginner: boolean;
  landSize?: number;
  landUnit?: string;
  history?: any[];
}) => {
  const historyContext = params.history && params.history.length > 0 
    ? `\nUser's Previous History (for context and trends):\n${params.history.slice(0, 3).map(r => `- ${r.type === 'soil' ? 'Soil Analysis' : 'Health Check'} on ${new Date(r.timestamp).toLocaleDateString()}: ${r.result.substring(0, 100)}...`).join('\n')}`
    : "";

  const prompt = `
    As an expert agricultural AI assistant for "AgroTech", analyze the following soil and environmental data:
    - Soil pH: ${params.ph}
    - Soil Humidity: ${params.humidity}%
    - Current Season: ${params.season}
    - Water Availability: ${params.waterAvailability}
    - User Type: ${params.isBeginner ? "Beginner (New to farming)" : "Experienced Farmer"}
    ${params.landSize ? `- Land Size: ${params.landSize} ${params.landUnit || 'Hectares'}` : ""}
    ${historyContext}

    Please provide:
    1. Soil Condition Analysis (Acidic/Normal/Basic) and what it means.
    2. Treatment Recommendations (if acidic/basic).
    3. Fertilizer Suggestions. For each fertilizer recommended, you MUST provide a brief 1-2 sentence description explaining:
       - What is in it (e.g., "food for green leaves" instead of Nitrogen).
       - How it helps the plant (e.g., "makes the plant strong against wind" or "helps grow big fruits").
       - Use very simple English.
    4. Best Crops to grow in this specific condition and season.
    5. Estimated Yield (rough amount).
    6. Watering Schedule/Predictions (Start this section with "### WATERING_SCHEDULE_START" and end with "### WATERING_SCHEDULE_END").
    7. ${params.isBeginner ? "Seed quantity recommendations for the land size." : "Advanced farming techniques for these crops."}
    8. Personalized Farming Tips: Based on the user's data and history (if provided), give 2-3 specific tips to improve their farming success. (Start this section with "### PERSONALIZED_TIPS_START" and end with "### PERSONALIZED_TIPS_END").
    
    IMPORTANT: Use very simple English that is easy for a basic farmer to understand. Avoid complex scientific words. 
    For example:
    - Instead of "Acidic", use "Sour soil (too much acid)".
    - Instead of "Alkaline/Basic", use "Sweet soil (too much lime)".
    - Instead of "Nitrogen", explain it as "food for green leaves".
    - Instead of "Phosphorus", explain it as "food for strong roots and flowers".
    - Instead of "Potassium", explain it as "food for healthy fruits and strength".
    - Instead of "Yield", use "Harvest amount".
    - Instead of "Treatment", use "How to fix the soil".
    - Instead of "pH", call it "Soil health score".
    - Instead of "Irrigation", use "Watering".
    - Instead of "Frequency", use "How often to water".
    - Instead of "Optimal moisture", use "Just enough water".
    - Instead of "Evapotranspiration", use "Water drying up in the sun".

    Format the response in clear Markdown with sections.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};

export const detectPest = async (imageBase64: string) => {
  const prompt = `
    Analyze this image of a plant/leaf. Identify any pests, insects, or diseases visible.
    Provide:
    1. Identification of the issue.
    2. Immediate actions to take.
    3. Organic and chemical remedy suggestions.
    4. Prevention tips for the future.
    
    Format the response in clear Markdown.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } }
      ]
    },
  });

  return response.text;
};

export const saveRecord = async (type: 'soil' | 'health', data: any, result: string) => {
  const response = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data, result }),
  });
  return response.json();
};

export const getRecords = async () => {
  const response = await fetch('/api/records');
  return response.json();
};
