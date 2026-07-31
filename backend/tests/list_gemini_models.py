import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("--- Available Gemini Models (generateContent) ---")
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(f"  {m.name}  (display: {m.display_name})")
