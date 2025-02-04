// Constants for timing (in milliseconds)
const TOTAL_DURATION = 10 * 1000 // 10 seconds
const LOG_INTERVAL = 1000 // 1 second

// Function to run the logging
async function runLogging() {
  console.log('RAW CODE: Starting logging process...\n')

  const startTime = Date.now()
  let currentIteration = 1

  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const elapsedTime = Date.now() - startTime

      console.log(
        `Log iteration ${currentIteration}: ${elapsedTime / 1000} seconds elapsed\n`
      )
      currentIteration++

      if (elapsedTime >= TOTAL_DURATION) {
        clearInterval(intervalId)
        console.log('Completed\n')
        resolve('completed')
      }
    }, LOG_INTERVAL)
  })
}

// Run the logging function
runLogging()
