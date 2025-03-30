import cv2
import requests
import os
import subprocess
import glob


# Function to download video from URL
def download_video(url, output_path):
    print("Downloading video...")
    response = requests.get(url, stream=True)
    with open(output_path, 'wb') as file:
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                file.write(chunk)
    print("Download complete.")


def extract_frames(video_path, frame_dir):
    """Extract frames from a video using FFmpeg."""
    os.makedirs(frame_dir, exist_ok=True)
    
    command = [
        "ffmpeg", "-i", video_path, os.path.join(frame_dir, "%04d.png")
    ]
    
    subprocess.run(command, check=True)
    print(f"✅ Frames extracted to {frame_dir}")

def detect_faces(image_dir, output_dir):
    """Detects faces in images and saves processed frames."""
    os.makedirs(output_dir, exist_ok=True)

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    images = sorted(glob.glob(os.path.join(image_dir, "*.png")))
    if not images:
        raise Exception("🚨 No frames found for face detection!")

    for img_path in images:
        img = cv2.imread(img_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        for (x, y, w, h) in faces:
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)

        output_path = os.path.join(output_dir, os.path.basename(img_path))
        cv2.imwrite(output_path, img)
    
    print(f"✅ Processed {len(images)} frames with face detection.")

def create_video_from_images(image_dir, output_video):
    command = [
    "ffmpeg",  "-i", "processed_frames/%04d.png",
     "-vf", "scale=1280:720", "-vcodec", "libx264", "-crf", "23", "-preset", "fast", "-x264opts", "keyint=30", "-pix_fmt", "yuv420p", "-f", "mp4", "-c:a", "aac", "-movflags", "faststart", "-an", output_video,
     "-loglevel", "debug"
    ]
    subprocess.run(command, check=True)
   
    print(f"✅Final video saved at: {output_video}")


if __name__ == "__main__":
    video_url = "https://raw.githubusercontent.com/oceanprotocol/c2d-examples/main/face-detection/face-demographics-walking-and-pause-short.mp4"  # Replace with the actual URL
    video_path = "downloaded_video.mp4"
    frames_dir = "output_frames"
    processed_frames_dir = "processed_frames"
    output_path = "/data/outputs/output_faces.mp4"

    download_video(video_url, video_path)
    extract_frames(video_path, frames_dir)
    detect_faces(frames_dir, processed_frames_dir)
    create_video_from_images(processed_frames_dir, output_path)

    # Cleanup downloaded video
    os.remove(video_path)