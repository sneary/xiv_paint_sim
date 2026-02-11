from PIL import Image
import os

directory = 'client/public/assets/debuffs'

def crop_to_content(path):
    try:
        img = Image.open(path)
        img = img.convert("RGBA")
        
        # GetBoundingBox returns the box of non-zero regions
        bbox = img.getbbox()
        
        if bbox:
            cropped = img.crop(bbox)
            cropped.save(path, "PNG")
            print(f"Cropped {path} to {bbox}")
        else:
            print(f"No content found in {path}")
            
    except Exception as e:
        print(f"Failed to process {path}: {e}")

if not os.path.exists(directory):
    print(f"Directory not found: {directory}")
else:
    for filename in os.listdir(directory):
        if filename.endswith(".png"):
            crop_to_content(os.path.join(directory, filename))
