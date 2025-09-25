export const dockerfilePy = `
FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y \
    python3-pip \
    python3-venv \
    && apt-get clean

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /tmp/
RUN pip install --upgrade pip wheel
RUN pip install -r /tmp/requirements.txt
`

export const algoPy = `
import os
import json

def main():
    print("Hello world 🌊")
    
    result = {"message": "Algorithm executed successfully"}
    
    with open('./data/outputs/result.json', 'w') as f:
        json.dump(result, f)
    
    print("Algorithm completed!")

if __name__ == "__main__":
    main()
`

export const requirementsPy = `
numpy>=1.21.0
pandas>=1.3.0
requests>=2.25.0
`