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

def get_algorithm_consumer_params():
    algorithm_did = os.getenv("TRANSFORMATION_DID", None)

    if not algorithm_did:
        print("No algorithm DID found in environment. Aborting.")
        return

    with open(f"/data/ddos/{algorithm_did}", "r") as algo_struc:
        algo_data = json.load(algo_struc)

        return algo_data['metadata']['algorithm']['consumerParameters']



if __name__ == "__main__":
    # Get consumer parameters
    consumer_params = get_algorithm_consumer_params()
    print(f"data for consumer parameters: {consumer_params}")

    for cp in consumer_params:
        if cp['name'] == "image_url":
            image_url = cp['default']
        if cp['name'] == "image_filter":
            filter = cp['default']

    filtered_img = apply_filters(image_url=image_url, filter=filter)
    filename = "/data/outputs/filtered_image.png"
    filtered_img.save(filename)
    print(f"Filters applied and images saved successfully as {filename}")