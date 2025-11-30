import { GoogleGenAI, Type } from "@google/genai";
import { SermonStudy, UserSettings, StudyLength, Bulletin } from '../types';

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/webm;base64,")
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
    // Strip markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const results = JSON.parse(cleanText);
    
    // Filter results to ensure they have valid coordinates
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
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to process bulletin");

  const data = JSON.parse(text);

  return {
    id: crypto.randomUUID(),
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

  // Determine prompt nuances based on settings
  let wordCount = "150";
  if (settings.studyLength === StudyLength.MEDIUM) wordCount = "300";
  if (settings.studyLength === StudyLength.LONG) wordCount = "600";

  const refCount = settings.supportingReferencesCount || 0;

  // Define the schema for the output
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
            scriptureReference: { type: Type.STRING, description: "Primary scripture focus for the day. Use standard format e.g. 'John 3:16' or '1 Corinthians 13:4'. Do not include text, only the reference." },
            supportingScriptures: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: `Exactly ${refCount} additional scripture references that support the topic. Use standard format e.g. 'Romans 8:28'.` 
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
    Create a ${settings.studyDuration}-day personal Bible study plan based on the main themes, scriptures, and applications found in the provided message.
    The user wants a ${settings.studyLength} study each day (approx ${wordCount} words).
    Include exactly ${refCount} supporting scripture references per day.
    Ensure the tone is encouraging, theologically sound, and practical.
    IMPORTANT: Format all scripture references cleanly as "Book Chapter:Verse" (e.g., "John 3:16", "2 Timothy 1:7") without extra text or parentheses.`;

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
    parts.push({ text: instruction + " Analyze the attached images of the sermon notes." });
  }

  if (input.text) {
    parts.push({
      text: instruction + ` Here is the transcript: "${input.text}"`
    });
  } 
  
  if (parts.length === 0) {
    throw new Error("No input provided. Please record audio, upload a file, paste text, or upload images.");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,
    }
  });

  const responseText = response.text;
  if (!responseText) {
      throw new Error("Failed to generate study content.");
  }

  const data = JSON.parse(responseText);

  // Map to internal type and add IDs
  return {
    id: crypto.randomUUID(),
    sermonTitle: data.sermonTitle,
    preacher: data.preacher,
    dateRecorded: new Date().toISOString(),
    originalAudioDuration: 0,
    isCompleted: false,
    days: data.days.map((d: any) => ({
        ...d,
        isCompleted: false
    }))
  };
};