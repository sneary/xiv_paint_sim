
import cv2
import numpy as np
import sys

def find_markers(image_path):
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        print("Failed to load image")
        sys.exit(1)

    height, width, _ = img.shape
    # Target dimensions: 1024 x 575
    target_w = 1024
    target_h = 575
    
    scale_x = target_w / width
    scale_y = target_h / height

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Define color ranges (Approximate for Waymarks)
    # Red (1)
    lower_red1 = np.array([0, 100, 100])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([160, 100, 100])
    upper_red2 = np.array([180, 255, 255])

    # Yellow (2, B)
    lower_yellow = np.array([20, 100, 100])
    upper_yellow = np.array([30, 255, 255])

    # Blue (3) - Usually Cyan/Blue
    lower_blue = np.array([100, 100, 100])
    upper_blue = np.array([130, 255, 255])

    # Purple (4, D)
    lower_purple = np.array([130, 50, 50]) # Adjusted for potential variance
    upper_purple = np.array([160, 255, 255])

    def get_centroids(mask, label):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        centroids = []
        for c in contours:
            M = cv2.moments(c)
            if M["m00"] > 100: # Filter noise
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                
                # Normalize
                nx = int(cx * scale_x)
                ny = int(cy * scale_y)
                centroids.append((nx, ny))
        return centroids

    # 1 (Red)
    mask_r1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask_r2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_red = cv2.add(mask_r1, mask_r2)
    
    # Yellow (2, B)
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
    
    # Blue (3)
    mask_blue = cv2.inRange(hsv, lower_blue, upper_blue)
    
    # Purple (4, D)
    mask_purple = cv2.inRange(hsv, lower_purple, upper_purple)

    print("Red (1):", get_centroids(mask_red, "Red"))
    print("Yellow (2, B):", get_centroids(mask_yellow, "Yellow"))
    print("Blue (3):", get_centroids(mask_blue, "Blue"))
    print("Purple (4, D):", get_centroids(mask_purple, "Purple"))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analyze_markers.py <image_path>")
        sys.exit(1)
    find_markers(sys.argv[1])
