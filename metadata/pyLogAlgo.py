import time
import asyncio
import os
import json
import tarfile

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
            
            # Save results to a JSON file first
            json_file = f'{output_dir}/results.json'
            output_data = {
                'results': results,
                'total_time': elapsed_time,
                'iterations': current_iteration - 1
            }
            
            with open(json_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            # Create tar archive
            tar_file = f'{output_dir}/outputs.tar'
            with tarfile.open(tar_file, 'w') as tar:
                tar.add(json_file, arcname='results.json')
            
            print(f"Results saved and archived as {tar_file}")
            return 'completed'
            
        await asyncio.sleep(LOG_INTERVAL)

if __name__ == "__main__":
    asyncio.run(run_logging())