import * as assert from 'assert'
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import {
  computeStart,
  checkComputeStatus,
  getComputeResult,
  saveResults,
  streamToString
} from '../helpers/compute'
import * as fs from 'fs'
import * as path from 'path'
import { ComputeEnvironment, ComputeJob } from '@oceanprotocol/lib'
import { SelectedConfig } from '../types'
// p2p is mocked in run.test.ts; use require() so we get the raw mock and can stub P2PCommand
const P2PCommand = require('../helpers/p2p') as typeof import('../helpers/p2p')

// Use VS Code test runner syntax
suite('Ocean Protocol Extension Test Suite', () => {
  const mockAuthToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxMjM0NTY3ODkwYWJjZGVmIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  const mockPeerId = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJaBcmbNtpbT3QYxYOpB'

  const mockEnvResponse: ComputeEnvironment[] = [
    {
      id: 'mock-environment-id',
      description: 'mock-environment-description',
      consumerAddress: 'mock-consumer-address',
      runningJobs: 1000,
      fees: null
    }
  ]

  const mockComputeResponse: ComputeJob = {
    jobId: 'test-job-id',
    status: 0,
    statusText: 'Created',
    owner: 'mock-owner',
    dateCreated: 'mock-date-created',
    dateFinished: 'mock-date-finished',
    results: [],
    expireTimestamp: 1000
  }
  let sandbox: sinon.SinonSandbox
  let outputChannel: vscode.OutputChannel
  let directCommandStub: sinon.SinonStub

  const setupDirectCommandStub = (customHandlers?: Record<string, any>) => {
    directCommandStub = sandbox
      .stub(P2PCommand, 'P2PCommand')
      .callsFake(async (command: string) => {
        if (customHandlers && customHandlers[command]) {
          return customHandlers[command]
        }

        switch (command) {
          case 'nonce':
            return 1
          case 'freeStartCompute':
            return mockComputeResponse
          case 'getComputeStatus':
            return mockComputeResponse
          case 'getComputeResult': {
            const buf = Buffer.from('hello')
            const body = (async function* () {
              yield new Uint8Array(buf)
            })()
            return { ok: true, status: 200, body }
          }
          default:
            return {}
        }
      })
    return directCommandStub
  }

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
    const mockAlgorithm = 'console.log("test")'

    setupDirectCommandStub()

    const mockConfig: SelectedConfig = new SelectedConfig({
      peerId: mockPeerId,
      environmentId: mockEnvResponse[0].id,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    const result = await computeStart(mockConfig, mockAlgorithm, 'js')

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.strictEqual(result.statusText, 'Created')
  })

  test('computeStart should handle Python algorithm correctly', async () => {
    const mockAlgorithm = 'print("test")'

    setupDirectCommandStub()

    const mockConfig: SelectedConfig = new SelectedConfig({
      peerId: mockPeerId,
      environmentId: mockEnvResponse[0].id,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    const result = await computeStart(mockConfig, mockAlgorithm, 'py')

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.ok(
      directCommandStub.calledWith(
        'freeStartCompute',
        mockConfig.peerId,
        sinon.match({
          algorithm: sinon.match({
            meta: {
              rawcode: mockAlgorithm,
              container: sinon.match({
                entrypoint: 'python $ALGO',
                image: 'oceanprotocol/c2d_examples',
                tag: 'py-general'
              })
            }
          })
        })
      )
    )
  })

  test('checkComputeStatus should return correct status', async () => {
    const mockJobId = 'test-job-id'

    setupDirectCommandStub({
      getComputeStatus: {
        ...mockComputeResponse,
        status: 1,
        statusText: 'Running'
      }
    })

    const mockConfig: SelectedConfig = new SelectedConfig({
      peerId: mockPeerId,
      environmentId: mockEnvResponse[0].id,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    const status = await checkComputeStatus(mockConfig, mockJobId)
    assert.strictEqual(status.statusText, 'Running')
  })

  test('computeStart should handle missing compute environments', async () => {
    const mockAlgorithm = 'console.log("test")'
    const mockConfig: SelectedConfig = new SelectedConfig({
      peerId: mockPeerId,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    await assert.rejects(
      computeStart(mockConfig, mockAlgorithm, 'js'),
      /No environment ID provided/
    )
  })

  // test('getComputeLogs should handle successful log streaming', async () => {
  //   const mockJobId = 'test-job-id'
  //   const mockConsumerAddress = '0x123'
  //   const mockSignature = '0xabc'
  //   const mockNonce = 123

  //   const mockStream = new PassThrough()
  //   const mockResponse = {
  //     ok: true,
  //     body: mockStream,
  //     statusText: 'OK'
  //   }

  //   // Mock global fetch
  //   const fetchStub = sandbox.stub().resolves(mockResponse)
  //   global.fetch = fetchStub

  //   // Start the log streaming
  //   const logPromise = getComputeLogs(
  //     mockPeerId,
  //     mockJobId,
  //     mockConsumerAddress,
  //     mockNonce,
  //     mockSignature,
  //     outputChannel
  //   )

  //   // Simulate stream data
  //   mockStream.write('Log line 1\n')
  //   mockStream.write('Log line 2\n')
  //   mockStream.end()

  //   await logPromise

  //   assert.ok(fetchStub.calledOnce)
  //   assert.ok(
  //     fetchStub.calledWith(
  //       `${mockPeerId}/directCommand`,
  //       sinon.match({
  //         method: 'POST',
  //         body: sinon.match.string
  //       })
  //     )
  //   )
  // })

  test('getComputeResult should handle successful result retrieval', async () => {
    const mockJobId = 'test-job-id'
    const mockResult = 'hello'

    setupDirectCommandStub({
      getComputeResult: (() => {
        const buf = Buffer.from(mockResult)
        const body = (async function* () {
          yield new Uint8Array(buf)
        })()
        return { ok: true, status: 200, body }
      })()
    })

    const mockConfig: SelectedConfig = new SelectedConfig({
      peerId: mockPeerId,
      environmentId: mockEnvResponse[0].id,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    const result = await getComputeResult(mockConfig, mockJobId)
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.status, 200)
    const content = await streamToString(result.body)
    assert.strictEqual(content, mockResult)
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
      const filePath = await saveResults(JSON.stringify(mockResults), mockFolderPath)

      // Verify file exists and content
      const fileExists = fs.existsSync(filePath)
      assert.ok(fileExists, 'Result file should exist')

      const content = await fs.promises.readFile(filePath, 'utf8')
      assert.strictEqual(content, JSON.stringify(mockResults))

      const pathParts = filePath.split(path.sep)
      const logsFolderName = pathParts[pathParts.length - 2]
      const dateFolderName = pathParts[pathParts.length - 3]
      assert.strictEqual(logsFolderName, 'logs', 'File should be in logs folder')
      assert.ok(
        dateFolderName.startsWith('results-'),
        'File should be in a folder with a date'
      )

      await fs.promises.rmdir(mockFolderPath, { recursive: true })
    } catch (error) {
      // Clean up in case of failure
      if (fs.existsSync(mockFolderPath)) {
        await fs.promises.rmdir(mockFolderPath, { recursive: true })
      }
      throw error
    }
  })

  // test('getComputeLogs should handle failed response', async () => {
  //   const mockJobId = 'test-job-id'

  //   const fetchStub = sandbox.stub().resolves({
  //     ok: false,
  //     statusText: 'Not Found'
  //   }) as sinon.SinonStub
  //   global.fetch = fetchStub

  //   await getComputeLogs(mockPeerId, mockJobId, '0x123', 123, '0xabc', outputChannel)

  //   assert.ok(fetchStub.calledOnce)
  // })
})
