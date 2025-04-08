import requests
from io import BytesIO
from PIL import Image, ImageFilter


def apply_filters(image_url, filter):
    if not filter:
        print("Filter is not provided.")
        return
    response = requests.get(image_url)

    if response.status_code == 200:
        img = Image.open(BytesIO(response.content))
        img.show()
    else:
        print(f"Failed to fetch image: {response.status_code}")
        print(response.text[:500])
    filtered_img = None
    # Apply filter
    if filter == "blur":
        blurred_img = img.filter(ImageFilter.GaussianBlur(radius=5))
        filtered_img = blurred_img
    elif filter == "grayscale":
        grayscale_img = img.convert("L")
        filtered_img = grayscale_img
    else:
        print("Unknown filter.")
        return

    return filtered_img

if __name__ == "__main__":
    filtered_img = apply_filters(image_url='https://raw.githubusercontent.com/mikolalysenko/lena/master/lena.png', filter='blur')
    filename = "/data/outputs/filtered_image.png"
    filtered_img.save(filename)
    print(f"Filters applied and images saved successfully as {filename}")