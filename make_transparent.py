from PIL import Image
import os

directory = 'client/public/assets/debuffs'

def make_transparent(path):
    try:
        img = Image.open(path)
        img = img.convert("RGBA")
        datas = img.getdata()

        new_data = []
        for item in datas:
            # Check for black background (adjust threshold if needed)
            # Assuming pure black or very close to it
            if item[0] < 10 and item[1] < 10 and item[2] < 10:
                new_data.append((0, 0, 0, 0)) # Transparent
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(path, "PNG")
        print(f"Processed {path}")
    except Exception as e:
        print(f"Failed to process {path}: {e}")

if not os.path.exists(directory):
    print(f"Directory not found: {directory}")
else:
    for filename in os.listdir(directory):
        if filename.endswith(".png"):
            make_transparent(os.path.join(directory, filename))
