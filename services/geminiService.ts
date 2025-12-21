
import { GoogleGenAI, Type } from "@google/genai";
import { SermonStudy, UserSettings, StudyLength, Bulletin } from '../types';
import { getCurrentUser } from './authService';

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Defensive JSON parsing helper
const cleanAndParseJSON = (text: string) => {
    try {
        // Remove markdown formatting if present
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON Parsing failed for Gemini output:", text);
        throw new Error("The AI returned a malformed response. Please try again.");
    }
};

/**
 * Uses gemini-2.5-flash for Maps Grounding tasks as per guidelines.
 */
export const searchChurch = async (query: string): Promise<{name: string, address: string, lat: number, lng: number, uri?: string, serviceTimes?: string[]}[]> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Find the church matching "${query}". 
  Provide the name, address, latitude, and longitude for the top matches (max 3).
  Crucial: Try to find Sunday service times from the available information and include them as an array of strings (e.g. ["9:00 AM", "11:00 AM"]). If unknown, return empty array.
  Return the response as a raw JSON array of objects.
  Each object must have these keys: "name", "address", "lat" (number), "lng" (number), "uri" (Google Maps link if available), "serviceTimes" (array of strings).
  Do not include markdown formatting.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
    }
  });

  const text = response.text;
  if (!text) return [];

  try {
    const results = cleanAndParseJSON(text);
    if (Array.isArray(results)) {
        return results.filter((r: any) => 
            r && 
            typeof r.name === 'string' && 
            typeof r.lat === 'number' && 
            typeof r.lng === 'number'
        );
    }
    return [];
  } catch (e) {
    return [];
  }
};

/**
 * Uses gemini-3-flash-preview for general text and image analysis tasks.
 */
export const processBulletin = async (images: Blob[]): Promise<Bulletin> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      rawSummary: { type: Type.STRING },
      events: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            location: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "date", "time", "location", "description"]
        }
      }
    },
    required: ["title", "events", "rawSummary"]
  };

  const parts: any[] = [];
  for (const imgBlob of images) {
    const base64Img = await blobToBase64(imgBlob);
    parts.push({
        inlineData: {
            mimeType: imgBlob.type || 'image/jpeg',
            data: base64Img
        }
    });
  }

  const instruction = `Analyze these images of a church bulletin. 
  Extract a list of upcoming events. 
  Infer the correct YYYY-MM-DD for dates based on current date: ${new Date().toISOString().split('T')[0]}.`;

  parts.push({ text: instruction });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to process bulletin");

  const data = cleanAndParseJSON(text);
  const user = getCurrentUser();

  return {
    id: crypto.randomUUID(),
    userId: user?.id || 'anonymous',
    dateScanned: new Date().toISOString(),
    title: data.title || "Announcements",
    events: (data.events || []).map((e: any) => ({
      ...e,
      id: crypto.randomUUID()
    })),
    rawSummary: data.rawSummary || ""
  };
};

/**
 * Uses gemini-3-pro-preview for complex reasoning and content generation.
 */
export const generateBibleStudy = async (
  input: { audioBlob?: Blob; text?: string; images?: Blob[] },
  settings: UserSettings
): Promise<SermonStudy> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let wordCount = "150";
  if (settings.studyLength === StudyLength.MEDIUM) wordCount = "300";
  if (settings.studyLength === StudyLength.LONG) wordCount = "600";
  const refCount = settings.supportingReferencesCount || 0;

  const schema = {
    type: Type.OBJECT,
    properties: {
      sermonTitle: { type: Type.STRING },
      preacher: { type: Type.STRING },
      summary: { type: Type.STRING },
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            topic: { type: Type.STRING },
            scriptureReference: { type: Type.STRING },
            supportingScriptures: { type: Type.ARRAY, items: { type: Type.STRING } },
            devotionalContent: { type: Type.STRING },
            reflectionQuestion: { type: Type.STRING },
            prayerFocus: { type: Type.STRING },
          },
          required: ["day", "topic", "scriptureReference", "supportingScriptures", "devotionalContent", "reflectionQuestion", "prayerFocus"]
        }
      }
    },
    required: ["sermonTitle", "days"]
  };

  let parts = [];
  const instruction = `You are an expert Bible Study creator.
    Create a ${settings.studyDuration}-day study based on provided sermon content.
    Daily devotionals should be ~${wordCount} words. Include ${refCount} supporting scriptures per day.`;

  if (input.audioBlob) {
    const base64Audio = await blobToBase64(input.audioBlob);
    parts.push({ inlineData: { mimeType: input.audioBlob.type || 'audio/mp3', data: base64Audio } });
  } 
  
  if (input.images && input.images.length > 0) {
    for (const imgBlob of input.images) {
        const base64Img = await blobToBase64(imgBlob);
        parts.push({ inlineData: { mimeType: imgBlob.type || 'image/jpeg', data: base64Img } });
    }
  }

  if (input.text) {
    parts.push({ text: input.text });
  } 
  
  parts.push({ text: instruction });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,
    }
  });

  const responseText = response.text;
  if (!responseText) throw new Error("Empty response from AI.");

  const data = cleanAndParseJSON(responseText);
  const user = getCurrentUser();

  if (!data.days || !Array.isArray(data.days) || data.days.length === 0) {
      throw new Error("AI failed to generate study days.");
  }

  return {
    id: crypto.randomUUID(),
    userId: user?.id || 'anonymous',
    sermonTitle: data.sermonTitle || "New Bible Study",
    preacher: data.preacher || "Guest Speaker",
    dateRecorded: new Date().toISOString(),
    originalAudioDuration: 0,
    isCompleted: false,
    days: data.days.map((d: any) => ({ ...d, isCompleted: false }))
  };
};
