import asyncio
import os
import sys

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

async def list_models():
    # Groq
    try:
        from groq import AsyncGroq
        groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        models = await groq_client.models.list()
        print("GROQ MODELS:")
        for m in models.data:
            print("  -", m.id)
    except Exception as e:
        print("Groq error:", e)

    # Gemini
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        print("\nGEMINI MODELS:")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print("  -", m.name)
    except Exception as e:
        print("Gemini error:", e)

if __name__ == "__main__":
    asyncio.run(list_models())
