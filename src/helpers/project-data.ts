import * as fs from 'fs'
import * as path from 'path'

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

export const dockerfileJs = `
FROM node:22 as builder

WORKDIR /usr/app
COPY package*.json ./
RUN npm install && npm cache clean --force
RUN apt-get update 
COPY . .

FROM node:22
COPY --from=builder /usr/app/ /
`

export const algoJs = `
const fs = require('fs');
const path = require('path');

function main() {
    console.log("Hello world 🌊");
    
    const result = { message: "Algorithm executed successfully" };
    
    const outputsDir = path.join('./data/outputs');
    console.log('Outputs directory:', outputsDir);
    if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(outputsDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log("Algorithm completed!");
}

if (require.main === module) {
    main();
}
`

export const packageJsonJs = `
{
  "name": "new-compute-job",
  "version": "1.0.0",
  "description": "New compute job",
  "main": "algo.js",
  "scripts": {
    "start": "node algo.js"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "bignumber.js": "^9.3.0",
    "ethers": "^6.14.0"
  }
}
`

export enum Language {
    PYTHON = 'Python',
    JAVASCRIPT = 'JavaScript'
}

export function getAvailableLanguages(): string[] {
    return Object.values(Language)
}

export function getLanguageTemplates(language: Language) {
    switch (language) {
        case Language.PYTHON:
            return {
                dockerfile: dockerfilePy,
                algorithm: algoPy,
                dependencies: requirementsPy,
                algorithmFileName: 'algo.py',
                dependenciesFileName: 'requirements.txt'
            }
        case Language.JAVASCRIPT:
            return {
                dockerfile: dockerfileJs,
                algorithm: algoJs,
                dependencies: packageJsonJs,
                algorithmFileName: 'algo.js',
                dependenciesFileName: 'package.json'
            }
        default:
            throw new Error(`Unsupported language: ${language}`)
    }
}

export async function detectProjectType(projectPath: string): Promise<Language> {
    try {
        const availableLanguages = getAvailableLanguages()

        const languageChecks = availableLanguages.map(async (language) => {
            const templates = getLanguageTemplates(language as Language)
            const algorithmFileName = templates.algorithmFileName
            const algorithmPath = path.join(projectPath, algorithmFileName)

            const exists = await fs.promises.access(algorithmPath).then(() => true).catch(() => false)
            return { language: language as Language, exists }
        })

        const results = await Promise.all(languageChecks)
        const foundLanguage = results.find(result => result.exists)

        return foundLanguage ? foundLanguage.language : Language.PYTHON
    } catch (error) {
        console.error('Error detecting project type:', error)
        return Language.PYTHON
    }
}

