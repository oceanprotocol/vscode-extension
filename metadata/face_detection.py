import cv2
import requests
import os


# Function to download video from URL
def download_video(url, output_path):
    print("Downloading video...")
    response = requests.get(url, stream=True)
    with open(output_path, 'wb') as file:
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                file.write(chunk)
    print("Download complete.")


# Function to detect faces in a video
def detect_faces(video_path, output_path):
    # pre-trained Haar cascade classifier for face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    cap = cv2.VideoCapture(video_path)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Face detection works better on grayscale images, so we convert the frame from color (RGB) to grayscale.
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 2)

        out.write(frame)
        cv2.imshow('Face Detection', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    out.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    video_url = "https://raw.githubusercontent.com/oceanprotocol/c2d-examples/main/face-detection/face-demographics-walking-and-pause-short.mp4"  # Replace with the actual URL
    video_path = "downloaded_video.mp4"
    output_path = "/data/outputs/output_faces.mp4"

    download_video(video_url, video_path)
    detect_faces(video_path, output_path)

    # Cleanup downloaded video
    os.remove(video_path)