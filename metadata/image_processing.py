import os
import json
import requests
from io import BytesIO
from PIL import Image, ImageFilter


def apply_filters(image_url, filter):
    if not filter:
        print("Filter is not provided.")
        return
    response = requests.get(image_url)
    img = Image.open(BytesIO(response.content))
    filtered_img = None

    # Apply filter
    if filter == "blur":
        blurred_img = img.filter(ImageFilter.GaussianBlur(radius=5))
        filtered_img = blurred_img
    elif filter == "grayscale":
        grayscale_img = img.convert("L")
        filtered_img = grayscale_img
    elif filter == "unsharp":
        unsharp_img = img.filter(ImageFilter.UnsharpMask(radius=5))
        filtered_img = unsharp_img
    else:
        print("Unknown filter.")
        return

    return filtered_img

if __name__ == "__main__":
    filtered_img = apply_filters(image_url='https://upload.wikimedia.org/wikipedia/en/7/7d/Lenna_%28test_image%29.png', filter='blur')
    filename = "/data/outputs/filtered_image.png"
    filtered_img.save(filename)
    print(f"Filters applied and images saved successfully as {filename}")