import time
import asyncio

# Constants for timing (in seconds)
TOTAL_DURATION = 10  # 10 seconds
LOG_INTERVAL = 1     # 1 second

# Function to run the logging
async def run_logging():
    print('RAW CODE: Starting logging process...')
    
    start_time = time.time()
    current_iteration = 1
    
    while True:
        elapsed_time = time.time() - start_time
        
        print(f'Log iteration {current_iteration}: {elapsed_time:.3f} seconds elapsed')
        current_iteration += 1
        
        if elapsed_time >= TOTAL_DURATION:
            print('Completed')
            return 'completed'
            
        await asyncio.sleep(LOG_INTERVAL)

# Run the logging function
asyncio.run(run_logging())
