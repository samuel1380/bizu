
import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyC6k7sVc9me6pc6AL8ScvAvo9LOBlTteZ0";
const client = new GoogleGenAI({ apiKey });

async function test() {
    console.log("Testing Gemini 2.0 Flash with provided key...");
    try {
        const model = "gemini-2.0-flash";
        const response = await client.models.generateContent({
            model: model,
            contents: "Hello, answer with 'OK' if you can hear me."
        });
        console.log("Success!");
        console.log("Response:", response.text);
    } catch (error) {
        console.error("Error occurred:");
        console.error(error);
    }
}

test();
