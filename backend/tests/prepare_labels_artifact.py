import os
import glob
import random
import shutil

def main():
    screenshots_dir = os.path.join(os.path.dirname(__file__), "..", "data", "screenshots")
    all_screenshots = glob.glob(os.path.join(screenshots_dir, "**", "*.jpg"), recursive=True)
    
    sample_size = min(30, len(all_screenshots))
    samples = random.sample(all_screenshots, sample_size)
    
    artifact_dir = r"C:\Users\MANAS\.gemini\antigravity-ide\brain\4d6b37b2-20a8-47d4-b1ee-2e1b28e797fe"
    
    md_lines = [
        "# Screenshot Labeling Batch",
        "",
        "Please review the following screenshots and provide the ground-truth `app_aliases` and `expected_tags` for each. You can just provide a JSON block or a simple list in your next message!",
        ""
    ]
    
    for i, path in enumerate(samples):
        filename = os.path.basename(path)
        dest_path = os.path.join(artifact_dir, filename)
        
        # Copy to artifact directory so it can be embedded properly
        shutil.copy2(path, dest_path)
        
        md_lines.append(f"### {i+1}. {filename}")
        # Use forward slashes for markdown image paths
        dest_path_fwd = dest_path.replace('\\', '/')
        md_lines.append(f"![Screenshot {i+1}](file:///{dest_path_fwd})")
        md_lines.append("")
        md_lines.append("```json")
        md_lines.append(f'"{filename}": {{')
        md_lines.append('    "app_aliases": [],')
        md_lines.append('    "expected_tags": []')
        md_lines.append("}")
        md_lines.append("```")
        md_lines.append("---")
        
    out_md = os.path.join(artifact_dir, "labeling_batch.md")
    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
        
    print(f"Created labeling_batch.md with {sample_size} images.")

if __name__ == "__main__":
    main()
