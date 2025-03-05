import * as assert from 'assert'
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import {
  computeStart,
  checkComputeStatus,
  getComputeLogs,
  getComputeResult,
  saveResults
} from '../helpers/compute'
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
    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'console.log("test")'

    sandbox.stub(axios, 'get').resolves({ data: [] })

    await assert.rejects(
      computeStart(mockAlgorithm, mockSigner, mockNodeUrl, 'js'),
      /No compute environments available/
    )
  })

  test('getComputeLogs should handle successful log streaming', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'
    const mockConsumerAddress = '0x123'
    const mockSignature = '0xabc'
    const mockNonce = 123

    const mockStream = new PassThrough()
    const mockResponse = {
      ok: true,
      body: mockStream,
      statusText: 'OK'
    }

    // Mock global fetch
    const fetchStub = sandbox.stub().resolves(mockResponse)
    global.fetch = fetchStub

    // Start the log streaming
    const logPromise = getComputeLogs(
      mockNodeUrl,
      mockJobId,
      mockConsumerAddress,
      mockNonce,
      mockSignature,
      outputChannel
    )

    // Simulate stream data
    mockStream.write('Log line 1\n')
    mockStream.write('Log line 2\n')
    mockStream.end()

    await logPromise

    assert.ok(fetchStub.calledOnce)
    assert.ok(
      fetchStub.calledWith(
        `${mockNodeUrl}/directCommand`,
        sinon.match({
          method: 'POST',
          body: sinon.match.string
        })
      )
    )
  })

  test('getComputeResult should handle successful result retrieval', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'
    const mockConsumerAddress = '0x123'
    const mockSigner = new Wallet('0x' + '1'.repeat(64))

    const mockResponse = {
      data: {
        result: 'Success',
        output: 'Test output'
      }
    }

    sandbox.stub(axios, 'post').resolves(mockResponse)

    const result = await getComputeResult(
      mockSigner,
      mockNodeUrl,
      mockJobId,
      mockConsumerAddress
    )

    assert.deepStrictEqual(result, mockResponse.data)
  })

  test('saveResults should correctly save to file', async () => {
    const mockResults = {
      filename: 'test.json',
      filesize: 123,
      type: 'json',
      index: 0,
      content: 'Test results',
      output: 'Test output'
    }
    const mockFolderPath = path.join(process.cwd(), 'test-results')

    // Create a temporary directory for testing
    if (!fs.existsSync(mockFolderPath)) {
      await fs.promises.mkdir(mockFolderPath, { recursive: true })
    }

    try {
      const filePath = await saveResults(mockResults, mockFolderPath)

      // Verify file exists and content
      const fileExists = fs.existsSync(filePath)
      assert.ok(fileExists, 'Result file should exist')

      const content = await fs.promises.readFile(filePath, 'utf8')
      assert.strictEqual(content, JSON.stringify(mockResults, null, 2))

      // Clean up
      await fs.promises.unlink(filePath)
      await fs.promises.rmdir(mockFolderPath)
    } catch (error) {
      // Clean up in case of failure
      if (fs.existsSync(mockFolderPath)) {
        await fs.promises.rmdir(mockFolderPath, { recursive: true })
      }
      throw error
    }
  })

  test('getComputeLogs should handle failed response', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'

    const fetchStub = sandbox.stub().resolves({
      ok: false,
      statusText: 'Not Found'
    }) as sinon.SinonStub
    global.fetch = fetchStub

    await getComputeLogs(mockNodeUrl, mockJobId, '0x123', 123, '0xabc', outputChannel)

    assert.ok(fetchStub.calledOnce)
  })
})
