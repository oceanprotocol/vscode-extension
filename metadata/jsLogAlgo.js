// Constants for timing (in milliseconds)
const TOTAL_DURATION = 5 * 60 * 1000 // 5 minutes
const LOG_INTERVAL = 1000 // 1 second

// Function to run the logging
async function runLogging() {
  console.log('Starting logging process...')

  const startTime = Date.now()
  let currentIteration = 1

  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const elapsedTime = Date.now() - startTime

      console.log(
        `Log iteration ${currentIteration}: ${elapsedTime / 1000} seconds elapsed`
      )
      currentIteration++

      if (elapsedTime >= TOTAL_DURATION) {
        clearInterval(intervalId)
        console.log('Completed')
        resolve('completed')
      }
    }, LOG_INTERVAL)
  })
}

// Run the logging function
runLogging()
