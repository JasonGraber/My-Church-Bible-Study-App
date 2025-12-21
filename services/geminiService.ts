
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

export const searchChurch = async (query: string): Promise<{name: string, address: string, lat: number, lng: number, uri?: string, serviceTimes?: string[]}[]> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Find the church matching "${query}". 
  Provide the name, address, latitude, and longitude for the top matches (max 3).
  Crucial: Try to find Sunday service times from the available information and include them as an array of strings (e.g. ["9:00 AM", "11:00 AM"]). If unknown, return empty array.
  Return the response as a raw JSON array of objects.
  Each object must have these keys: "name", "address", "lat" (number), "lng" (number), "uri" (Google Maps link if available), "serviceTimes" (array of strings).
  Do not include markdown formatting.`;

  // Fixed: Maps grounding is only supported in Gemini 2.5 series models.
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
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const results = JSON.parse(cleanText);
    
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
    console.error("Error parsing church search results:", e, text);
    return [];
  }
};

export const processBulletin = async (images: Blob[]): Promise<Bulletin> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A title for this bulletin, usually 'Announcements - [Date]'" },
      rawSummary: { type: Type.STRING, description: "A brief summary of general announcements that aren't specific events." },
      events: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING, description: "ISO Date String YYYY-MM-DD. If year is missing, assume current year or next occurrence." },
            time: { type: Type.STRING, description: "Time of the event e.g. 7:00 PM" },
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

  const instruction = `Analyze these images of a church bulletin/program. 
  Extract a list of upcoming events with their dates, times, and locations. 
  For the date, infer the correct YYYY-MM-DD based on the current date (${new Date().toISOString().split('T')[0]}). 
  Also provide a summary of other announcements.`;

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

  const data = JSON.parse(text);
  const user = getCurrentUser();

  return {
    id: crypto.randomUUID(),
    userId: user?.id || 'anonymous',
    dateScanned: new Date().toISOString(),
    title: data.title,
    events: (data.events || []).map((e: any) => ({
      ...e,
      id: crypto.randomUUID()
    })),
    rawSummary: data.rawSummary
  };
};

export const generateBibleStudy = async (
  input: { audioBlob?: Blob; text?: string; images?: Blob[] },
  settings: UserSettings
): Promise<SermonStudy> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let wordCount = "150";
  if (settings.studyLength === StudyLength.MEDIUM) wordCount = "300";
  if (settings.studyLength === StudyLength.LONG) wordCount = "600";

  const refCount = settings.supportingReferencesCount || 0;

  const schema = {
    type: Type.OBJECT,
    properties: {
      sermonTitle: { type: Type.STRING, description: "A catchy title for the sermon series" },
      preacher: { type: Type.STRING, description: "Name of the speaker if detected, otherwise 'Guest Speaker'" },
      summary: { type: Type.STRING, description: "A brief 2-sentence summary of the message" },
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            topic: { type: Type.STRING },
            scriptureReference: { type: Type.STRING, description: "Primary scripture focus for the day." },
            supportingScriptures: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: `Exactly ${refCount} additional scripture references.` 
            },
            devotionalContent: { type: Type.STRING, description: `A ${wordCount}-word devotional based on the sermon content.` },
            reflectionQuestion: { type: Type.STRING, description: "A deep question for personal application." },
            prayerFocus: { type: Type.STRING, description: "A short prayer prompt." },
          },
          required: ["day", "topic", "scriptureReference", "supportingScriptures", "devotionalContent", "reflectionQuestion", "prayerFocus"]
        }
      }
    },
    required: ["sermonTitle", "days"]
  };

  let parts = [];
  
  const instruction = `You are an expert Bible Study creator.
    Create a ${settings.studyDuration}-day personal Bible study plan based on the message content provided.
    The user wants a ${settings.studyLength} study each day.
    Include exactly ${refCount} supporting scripture references per day.
    IMPORTANT: If images are provided, they are photos of handwritten or printed sermon notes. Use OCR to carefully read all points, scriptures, and illustrations mentioned in the notes to build the study plan.`;

  if (input.audioBlob) {
    const base64Audio = await blobToBase64(input.audioBlob);
    parts.push({
      inlineData: {
        mimeType: input.audioBlob.type || 'audio/mp3',
        data: base64Audio
      }
    });
    parts.push({ text: instruction + " Listen to the attached sermon audio." });
  } 
  
  if (input.images && input.images.length > 0) {
    for (const imgBlob of input.images) {
        const base64Img = await blobToBase64(imgBlob);
        parts.push({
            inlineData: {
                mimeType: imgBlob.type || 'image/jpeg',
                data: base64Img
            }
        });
    }
    parts.push({ text: instruction + " Carefully read the attached photos of the sermon notes and use them as the primary source." });
  }

  if (input.text) {
    parts.push({
      text: instruction + ` Here is the transcript/notes text: "${input.text}"`
    });
  } 
  
  if (parts.length === 0) {
    throw new Error("No input provided.");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,
    }
  });

  const responseText = response.text;
  if (!responseText) {
      throw new Error("Failed to generate study content. The AI returned an empty response.");
  }

  try {
      const data = JSON.parse(responseText);
      const user = getCurrentUser();

      // Validation check: Ensure we have days
      if (!data.days || !Array.isArray(data.days) || data.days.length === 0) {
          throw new Error("The AI failed to generate any daily study steps. Please try again with more detailed notes.");
      }

      return {
        id: crypto.randomUUID(),
        userId: user?.id || 'anonymous',
        sermonTitle: data.sermonTitle || "New Bible Study",
        preacher: data.preacher || "Guest Speaker",
        dateRecorded: new Date().toISOString(),
        originalAudioDuration: 0,
        isCompleted: false,
        days: data.days.map((d: any) => ({
            ...d,
            isCompleted: false
        }))
      };
  } catch (parseError: any) {
      console.error("AI Parse Error:", responseText);
      throw new Error("We couldn't parse the AI's response. " + (parseError.message || ""));
  }
};
