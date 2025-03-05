// Constants for timing (in milliseconds)
const TOTAL_DURATION = 10 * 1000 // 10 seconds
const LOG_INTERVAL = 1000 // 1 second
const fs = require('fs')
const path = require('path')

// Function to run the logging
async function runLogging() {
  console.log('RAW CODE: Starting logging process...\n')

  const startTime = Date.now()
  let currentIteration = 1
  const logEntries = []

  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const elapsedTime = Date.now() - startTime
      const logMessage = `Log iteration ${currentIteration}: ${elapsedTime / 1000} seconds elapsed`

      console.log(logMessage + '\n')
      logEntries.push(logMessage)
      currentIteration++

      if (elapsedTime >= TOTAL_DURATION) {
        clearInterval(intervalId)
        console.log('Completed\n')

        // Save results to file
        const outputDir = path.join('/data', 'outputs')
        fs.mkdirSync(outputDir, { recursive: true })

        const outputPath = path.join(outputDir, 'results.txt')
        const summary = `JS Algorithm Results\nTotal time: ${elapsedTime / 1000} seconds\nTotal iterations: ${currentIteration - 1}\n\nLog entries:\n${logEntries.join('\n')}`

        fs.writeFileSync(outputPath, summary)
        console.log(`Results saved as ${outputPath}`)

        resolve('completed')
      }
    }, LOG_INTERVAL)
  })
}

// Run the logging function
runLogging()
