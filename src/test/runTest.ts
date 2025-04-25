import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

import { runTests } from '@vscode/test-electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')

    // The path to the test runner
    const extensionTestsPath = path.resolve(__dirname, './extension.test')

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath })
  } catch (err) {
    console.error('Failed to run tests:', err)
    process.exit(1)
  }
}

main()
