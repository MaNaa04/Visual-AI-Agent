import asyncio
import os
import sys
import glob
import random
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

PROMPT = """
You are generating ground-truth labels for a screenshot bench-off.
Identify the application or website in this screenshot, and output a JSON object with:
1. "app_aliases": A list of 2-4 string aliases for the application name (e.g. ["whatsapp", "whatsapp web"]). Keep them lowercase.
2. "expected_tags": A list of 3-5 tags describing the activity/context (e.g. ["chat", "messaging", "communication"]). Keep them lowercase.
Output ONLY valid JSON. Example:
{
  "app_aliases": ["youtube", "yt"],
  "expected_tags": ["video", "entertainment", "watching"]
}
"""

async def generate_labels():
    screenshots_dir = os.path.join(os.path.dirname(__file__), "..", "data", "screenshots")
    all_screenshots = glob.glob(os.path.join(screenshots_dir, "**", "*.jpg"), recursive=True)
    
    print(f"Found {len(all_screenshots)} total screenshots.")
    sample_size = min(30, len(all_screenshots))
    samples = random.sample(all_screenshots, sample_size)
    print(f"Generating labels for {sample_size} samples...")
    
    labels = {}
    
    for i, path in enumerate(samples):
        print(f"Processing {i+1}/{sample_size}: {os.path.basename(path)}")
        try:
            with open(path, "rb") as f:
                image_bytes = f.read()
            
            response = model.generate_content([
                {"mime_type": "image/jpeg", "data": image_bytes},
                PROMPT
            ])
            
            # Clean response text if it has markdown blocks
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
                
            data = json.loads(text.strip())
            labels[path] = {
                "app_aliases": data.get("app_aliases", []),
                "expected_tags": data.get("expected_tags", [])
            }
        except Exception as e:
            print(f"  Error processing {os.path.basename(path)}: {e}")
        
        import time
        time.sleep(5)
            
    out_path = os.path.join(os.path.dirname(__file__), "labels.json")
    with open(out_path, "w") as f:
        json.dump(labels, f, indent=4)
        
    print(f"\nDone! Wrote labels.json with {len(labels)} entries.")

if __name__ == "__main__":
    asyncio.run(generate_labels())
