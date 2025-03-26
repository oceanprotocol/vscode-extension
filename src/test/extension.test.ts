import * as assert from 'assert'
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import { Wallet } from 'ethers'
import axios from 'axios'
import { PassThrough } from 'stream'
import * as fs from 'fs'
import * as path from 'path'

// Use VS Code test runner syntax
suite('Ocean Protocol Extension Test Suite', () => {
  let sandbox: sinon.SinonSandbox
  let outputChannel: vscode.OutputChannel

  setup(() => {
    sandbox = sinon.createSandbox()
    outputChannel = vscode.window.createOutputChannel('Test Channel')
  })

  teardown(() => {
    sandbox.restore()
    outputChannel.dispose()
  })

  test('Extension should be present', () => {
    assert.ok(
      vscode.extensions.getExtension('OceanProtocol.ocean-protocol-vscode-extension')
    )
  })

  test('computeStart should handle JavaScript algorithm correctly', async () => {
    // Dynamically import the helpers module
    const { computeStart } = await import('../helpers/compute')

    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'console.log("test")'

    const mockEnvResponse = {
      data: [
        {
          id: 'mock-environment-id'
        }
      ]
    }

    const mockComputeResponse = {
      data: [
        {
          jobId: 'test-job-id',
          status: 0,
          statusText: 'Created'
        }
      ]
    }

    sandbox.stub(axios, 'get').resolves(mockEnvResponse)
    sandbox.stub(axios, 'post').resolves(mockComputeResponse)

    const result = await computeStart(mockAlgorithm, mockSigner, mockNodeUrl, 'js')

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.strictEqual(result.statusText, 'Created')
  })

  test('computeStart should handle Python algorithm correctly', async () => {
    // Dynamically import the helpers module
    const { computeStart } = await import('../helpers/compute')

    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'print("test")'

    const mockEnvResponse = {
      data: [
        {
          id: 'mock-environment-id'
        }
      ]
    }

    const mockComputeResponse = {
      data: [
        {
          jobId: 'test-job-id',
          status: 0,
          statusText: 'Created'
        }
      ]
    }

    sandbox.stub(axios, 'get').resolves(mockEnvResponse)
    const postStub = sandbox.stub(axios, 'post').resolves(mockComputeResponse)

    const result = await computeStart(mockAlgorithm, mockSigner, mockNodeUrl, 'py')

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.ok(
      postStub.calledWith(
        `${mockNodeUrl}/directCommand`,
        sinon.match({
          algorithm: {
            meta: {
              container: {
                image: 'oceanprotocol/algo_dockers',
                tag: 'python-branin'
              }
            }
          }
        })
      )
    )
  })

  test('checkComputeStatus should return correct status', async () => {
    // Dynamically import the helpers module
    const { checkComputeStatus } = await import('../helpers/compute')

    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'

    const mockResponse = {
      data: [
        {
          status: 1,
          statusText: 'Running'
        }
      ]
    }

    sandbox.stub(axios, 'post').resolves(mockResponse)

    const status = await checkComputeStatus(mockNodeUrl, mockJobId)
    assert.strictEqual(status.statusText, 'Running')
  })

  test('computeStart should handle missing compute environments', async () => {
    // Dynamically import the helpers module
    const { computeStart } = await import('../helpers/compute')

    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'console.log("test")'

    sandbox.stub(axios, 'get').resolves({ data: [] })

    await assert.rejects(
      computeStart(mockAlgorithm, mockSigner, mockNodeUrl, 'js'),
      /No compute environments available/
    )
  })

  test('getComputeResult should handle successful result retrieval', async () => {
    // Dynamically import the helpers module
    const { getComputeResult } = await import('../helpers/compute')

    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'

    const mockResponse = {
      data: {
        algorithm: {
          results: [
            {
              filename: 'results.txt',
              fileContent: 'Test results content'
            }
          ]
        }
      }
    }

    const mockSigner = new Wallet('0x' + '1'.repeat(64))

    sandbox.stub(axios, 'post').resolves(mockResponse)

    const results = await getComputeResult(
      mockSigner,
      mockNodeUrl,
      mockJobId,
      mockNodeUrl
    )
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].filename, 'results.txt')
    assert.strictEqual(results[0].fileContent, 'Test results content')
  })

  test('saveResults should save files to the specified directory', async () => {
    // Dynamically import the helpers module
    const { saveResults } = await import('../helpers/compute')

    const tempDir = await fs.promises.mkdtemp(path.join(__dirname, 'test-results-'))
    const results = [
      {
        filename: 'test1.txt',
        fileContent: 'Content 1'
      },
      {
        filename: 'test2.txt',
        fileContent: 'Content 2'
      }
    ]

    const writeFileStub = sandbox.stub(fs.promises, 'writeFile').resolves()
    const savedPaths = await saveResults(results, tempDir)

    assert.strictEqual(savedPaths.length, 2)
    assert.ok(writeFileStub.calledTwice)
    assert.ok(savedPaths[0].endsWith('test1.txt'))
    assert.ok(savedPaths[1].endsWith('test2.txt'))

    // Clean up
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })
})
