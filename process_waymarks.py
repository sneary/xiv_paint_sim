import os
from PIL import Image
import sys

def crop_waymarks(image_path, output_dir):
    try:
        img = Image.open(image_path)
        # Convert to RGBA
        img = img.convert("RGBA")
        
        # The background is black, but let's assume we want to keep the transparency or make black transparent?
        # The user said "cut out". Usually waymarks have transparency.
        # The source image has a black background. I should probably make black transparent or just crop.
        # Let's simple crop first. If user wants transparency, I might need to filter.
        # Actually, standard FFXIV waymarks often glow against the ground. Keeping them as is (with black box?) might look ugly on non-black floors.
        # But the arena floor is dark gray/black usually.
        # Let's try to make black transparent.
        
        datas = img.getdata()
        newData = []
        for item in datas:
            # Change all black (also dark dark gray) pixels to transparent
            # Increased threshold to 50 to clear more noise/glow that might inflate bbox
            if item[0] < 50 and item[1] < 50 and item[2] < 50:
                newData.append((0, 0, 0, 0))
            else:
                newData.append(item)
        img.putdata(newData)
        
        width, height = img.size
        print(f"Image size: {width}x{height}")
        
        # Simplified approach: 2 columns, 4 rows.
        cell_w = width // 2
        cell_h = height // 4
        
        names = ['1', '2', '3', '4', 'A', 'B', 'C', 'D']
        
        TARGET_SIZE = 128
        
        for i, name in enumerate(names):
            row = i // 2
            col = i % 2
            
            left = col * cell_w
            top = row * cell_h
            right = left + cell_w
            bottom = top + cell_h
            
            # Crop the cell
            cell = img.crop((left, top, right, bottom))
            
            # Trim the cell to content
            bbox = cell.getbbox()
            if bbox:
                cell = cell.crop(bbox)
                
            # Resize logic: Fit into TARGET_SIZE x TARGET_SIZE maintaining aspect ratio
            w, h = cell.size
            ratio = min(TARGET_SIZE / w, TARGET_SIZE / h)
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            
            cell = cell.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Create final square canvas
            final_img = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
            offset_x = (TARGET_SIZE - new_w) // 2
            offset_y = (TARGET_SIZE - new_h) // 2
            final_img.paste(cell, (offset_x, offset_y))
            
            final_img.save(os.path.join(output_dir, f"{name}.png"))
            print(f"Saved {name}.png normalized to {TARGET_SIZE}x{TARGET_SIZE}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    src_img = r"C:/Users/Sean/.gemini/antigravity/brain/26de1bfe-59b8-4e9e-b5fa-f97797a66fea/uploaded_image_1767404306781.png"
    out_dir = r"c:/Users/Sean/Desktop/xiv_sim/client/public/waymarks"
    crop_waymarks(src_img, out_dir)
