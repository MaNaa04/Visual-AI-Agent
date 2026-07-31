import asyncio
import json
import os
import sys

# Add backend directory to path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.vision.gemini_client import GeminiVisionClient
from app.services.vision.groq_client import GroqVisionClient

async def run_benchoff():
    labels_file = os.path.join(os.path.dirname(__file__), "labels.json")
    if not os.path.exists(labels_file):
        print(f"❌ labels.json not found at {labels_file}")
        sys.exit(1)
        
    with open(labels_file, "r") as f:
        labels = json.load(f)
        
    gemini_client = GeminiVisionClient()
    groq_client = GroqVisionClient()
    
    results = {"gemini": {"app_hits": 0, "tag_recall_sum": 0.0, "total": 0, "failures": 0},
               "groq": {"app_hits": 0, "tag_recall_sum": 0.0, "total": 0, "failures": 0}}
               
    print(f"--- Starting Vision Bench-off on {len(labels)} Samples ---")
    
    for path, label in labels.items():
        if not os.path.exists(path):
            print(f"⚠️ Warning: Image not found at {path}, skipping.")
            continue
            
        with open(path, "rb") as f:
            image_bytes = f.read()
            
        print(f"\nEvaluating: {os.path.basename(path)}")
        print(f"Expected App Aliases: {label['app_aliases']}")
        print(f"Expected Tags: {label['expected_tags']}")
        
        for name, client in [("gemini", gemini_client), ("groq", groq_client)]:
            try:
                res = await client.classify(image_bytes)
                
                # App hit logic: case-insensitive substring/fuzzy match
                app_lower = res.app.lower()
                app_correct = any(alias in app_lower for alias in label["app_aliases"])
                
                # Tag recall logic: fraction of expected tags present in output
                out_tags = set(t.lower() for t in res.tags)
                exp_tags = set(t.lower() for t in label["expected_tags"])
                intersection = out_tags & exp_tags
                tag_recall = len(intersection) / max(len(exp_tags), 1)
                
                print(f"  [{name.upper()}] App: '{res.app}' (Correct: {app_correct})")
                print(f"  [{name.upper()}] Tags: {res.tags} (Recall: {tag_recall:.2f})")
                print(f"  [{name.upper()}] Confidence: {res.confidence}")
                print(f"  [{name.upper()}] Summary: {res.activitySummary}")
                
                results[name]["total"] += 1
                if app_correct:
                    results[name]["app_hits"] += 1
                results[name]["tag_recall_sum"] += tag_recall
                
            except Exception as e:
                print(f"  [{name.upper()}] Error: {e}")
                results[name]["failures"] += 1
                
    print("\n--- Bench-off Final Results ---")
    for name, stats in results.items():
        total = stats["total"]
        if total == 0:
            print(f"{name.upper()}: No samples evaluated.")
            continue
            
        app_accuracy = stats["app_hits"] / total
        avg_tag_recall = stats["tag_recall_sum"] / total
        print(f"{name.upper()}:")
        print(f"  App Accuracy:   {app_accuracy:.1%} ({stats['app_hits']}/{total})")
        print(f"  Avg Tag Recall: {avg_tag_recall:.1%}")
        print(f"  Failures:       {stats['failures']}")
        
if __name__ == "__main__":
    asyncio.run(run_benchoff())
