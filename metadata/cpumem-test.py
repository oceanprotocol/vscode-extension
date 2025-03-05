import time
import os
import random
from multiprocessing import Process

# there is no memory allocation test for now
def thr(duration,memory_alloc):
    initial_timestamp=time.time()
    while True:
        time_now=time.time()
        if time_now>initial_timestamp+duration:  break
        rand=random.getrandbits(32)

if __name__ =="__main__":
    threads_nr=os.getenv('THREADS', 8)
    duration = os.getenv('SECONDS', 2*60)
    memory = os.getenv('MEMORY', 1024)
    print(f"Starting {threads_nr} threads for a duration of {duration} seconds each...")
    t = [None] * threads_nr
    for n in range(0,threads_nr):
        t[n] = Process(target=thr, args=(duration,memory,))
        t[n].start()

    # wait for threads to complete
    for n in range(0,threads_nr):
        t[n-1].join()
    print("Done!")