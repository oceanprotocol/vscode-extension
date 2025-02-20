import time
import asyncio
import os
import json

# Constants for timing (in seconds)
TOTAL_DURATION = 10  # 10 seconds
LOG_INTERVAL = 1     # 1 second

# Function to run the logging
async def run_logging():
    print('RAW CODE: Starting logging process...')
    
    start_time = time.time()
    current_iteration = 1
    results = []
    
    while True:
        elapsed_time = time.time() - start_time
        
        log_entry = f'Log iteration {current_iteration}: {elapsed_time:.3f} seconds elapsed'
        print(log_entry)
        results.append(log_entry)
        current_iteration += 1
        
        if elapsed_time >= TOTAL_DURATION:
            print('Completed')
            
            # Write output file
            output_dir = '/data/outputs'
            os.makedirs(output_dir, exist_ok=True)
            
            with open(f'{output_dir}/results.json', 'w') as f:
                json.dump({
                    'results': results,
                    'total_time': elapsed_time
                }, f)
                
            return 'completed'
            
        await asyncio.sleep(LOG_INTERVAL)

# Run the logging function
asyncio.run(run_logging())