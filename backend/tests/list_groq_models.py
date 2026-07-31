import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

try:
    models = client.models.list()
    print("--- Available Groq Models ---")
    for m in models.data:
        print(m.id)
except Exception as e:
    print(f"Failed to list Groq models: {e}")
