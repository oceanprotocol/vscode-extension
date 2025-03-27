const faceapi = require('face-api.js')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { Canvas, Image, ImageData, createCanvas, loadImage } = require('canvas')

faceapi.env.monkeyPatch({ Canvas, Image, ImageData })
const outputVideo = path.join('/data/outputs/', 'output.mp4')

async function getFilename() {
  const url =
    'https://raw.githubusercontent.com/oceanprotocol/c2d-examples/main/face-detection/face-demographics-walking-and-pause-short.mp4'
  const response = await fetch(url, { method: 'HEAD' })
  const contentDisposition = response.headers.get('Content-Disposition')

  if (contentDisposition && contentDisposition.includes('filename=')) {
    console.log(
      `file name: ${contentDisposition.split('filename=')[1].replace(/['"]/g, '')}`
    )
    return contentDisposition.split('filename=')[1].replace(/['"]/g, '')
  }
  console.log(`file name: ${url.split('/').pop().split('?')[0]}`)
  // Fallback: Extract from URL if Content-Disposition header is missing
  return url.split('/').pop().split('?')[0]
}

async function getOriginalFrames() {
  const outputDirectoryForOriginalFrames = 'frames'

  if (!fs.existsSync(outputDirectoryForOriginalFrames)) {
    fs.mkdirSync(outputDirectoryForOriginalFrames)
  }
  const inputVideo = await getFilename()

  const ffmpegCommand = `ffmpeg -i '${inputVideo}' '${outputDirectoryForOriginalFrames}/%04d.png'`

  exec(ffmpegCommand, (error) => {
    if (error) {
      console.error('Error:', error)
    } else {
      console.log('Frames extracted successfully.')
    }
  })
}

async function downloadModels(directory) {
  const folderPath = path.join(directory, 'models')
  const urls = [
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_expression_model-shard1',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_expression_model-weights_manifest.json',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_landmark_68_model-shard1',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_landmark_68_model-weights_manifest.json',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_recognition_model-shard1',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_recognition_model-shard2',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/face_recognition_model-weights_manifest.json',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/tiny_face_detector_model-shard1',
    'https://github.com/oceanprotocol/c2d-examples/raw/refs/heads/main/face-detection/models/tiny_face_detector_model-weights_manifest.json'
  ]
  // Ensure the folder exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true })
  }

  // Function to download a file
  const downloadFile = async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(
          `Failed to download ${url}: ${response.status} ${response.statusText}`
        )
      }

      const fileName = path.basename(new URL(url).pathname)
      const filePath = path.join(folderPath, fileName)

      const fileStream = fs.createWriteStream(filePath)
      return new Promise((resolve, reject) => {
        response.body.pipe(fileStream)
        response.body.on('error', reject)
        fileStream.on('finish', () => {
          console.log(`Downloaded: ${fileName}`)
          resolve()
        })
      })
    } catch (error) {
      console.error(`Error downloading ${url}:`, error)
    }
  }

  // Download all files concurrently
  await Promise.all(urls.map(downloadFile))
  console.log('All downloads completed!')
}

async function loadModels(directory) {
  await downloadModels(directory)
  await faceapi.nets.tinyFaceDetector.loadFromDisk('models')
  await faceapi.nets.faceLandmark68Net.loadFromDisk('models')
  await faceapi.nets.faceRecognitionNet.loadFromDisk('models')
  await faceapi.nets.faceExpressionNet.loadFromDisk('models')
}

async function processImages(inputDirectory, outputDirectory) {
  const imageFiles = fs.readdirSync(inputDirectory)

  for (const file of imageFiles) {
    if (file.endsWith('.png')) {
      const inputImagePath = path.join(inputDirectory, file)
      const outputImagePath = path.join(outputDirectory, file)
      const image = await loadImage(inputImagePath)

      const faceDetectionOptions = new faceapi.TinyFaceDetectorOptions()
      const detections = await faceapi
        .detectAllFaces(image, faceDetectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions()

      const canvas = createCanvas(image.width, image.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      faceapi.draw.drawDetections(canvas, detections)

      fs.writeFileSync(outputImagePath, canvas.toBuffer('image/png'))
    }
  }
  console.log('Frame processing complete')
}

function isDirectoryNotEmpty(directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath)

    return files.length > 0
  } catch (error) {
    // Handle errors, such as if the directory doesn't exist
    return false
  }
}

async function main() {
  const inputDirectory = 'frames'
  const outputDirectoryForProcessedFrames = 'processed_frames'

  if (!isDirectoryNotEmpty(inputDirectory)) {
    getOriginalFrames()
  }

  if (!fs.existsSync(outputDirectoryForProcessedFrames)) {
    fs.mkdirSync(outputDirectoryForProcessedFrames)
  }

  await loadModels(inputDirectory)

  await processImages(inputDirectory, outputDirectoryForProcessedFrames)

  console.log('Face detection and processing complete.')

  const ffmpegCommandOutput = `ffmpeg -i ${outputDirectoryForProcessedFrames}/%04d.png -c:v libx264 -pix_fmt yuv420p ${outputVideo}`
  exec(ffmpegCommandOutput, async (error) => {
    if (error) {
      console.error('Error:', error)
      // Try again to process the frames
      if (!fs.existsSync(outputDirectoryForProcessedFrames)) {
        fs.mkdirSync(outputDirectoryForProcessedFrames)
      }
      await processImages(inputDirectory, outputDirectoryForProcessedFrames)
    } else {
      console.log('Frames extracted successfully.')
    }
  })
}

main()
