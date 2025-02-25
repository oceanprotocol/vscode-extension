import time
import asyncio
import os

# Constants for timing (in seconds)
TOTAL_DURATION = 10  # 10 seconds
LOG_INTERVAL = 1     # 1 second

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
            
            # Create the output directory if it doesn't exist
            output_dir = '/data/outputs'
            os.makedirs(output_dir, exist_ok=True)
            
            # Save results to a text file
            txt_file = f'{output_dir}/results.txt'
            
            with open(txt_file, 'w') as f:
                f.write(f'Algorithm Results\n')
                f.write(f'Total time: {elapsed_time:.3f} seconds\n')
                f.write(f'Total iterations: {current_iteration - 1}\n')
            
            print(f"Results saved as {txt_file}")
            return 'completed'
            
        await asyncio.sleep(LOG_INTERVAL)

if __name__ == "__main__":
    asyncio.run(run_logging())