import * as assert from 'assert'
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import {
  computeStart,
  checkComputeStatus,
  getComputeResult,
  saveResults
} from '../helpers/compute'
import { Wallet } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'
import { ComputeEnvironment, ComputeJob, ProviderInstance } from '@oceanprotocol/lib'

// Use VS Code test runner syntax
suite('Ocean Protocol Extension Test Suite', () => {
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

    sandbox.stub(ProviderInstance, 'getComputeEnvironments').resolves(mockEnvResponse)
    sandbox.stub(ProviderInstance, 'freeComputeStart').resolves(mockComputeResponse)

    const result = await computeStart(
      mockAlgorithm,
      mockSigner,
      mockNodeUrl,
      'js',
      mockEnvResponse[0].id
    )

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.strictEqual(result.statusText, 'Created')
  })

  test('computeStart should handle Python algorithm correctly', async () => {
    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'print("test")'

    sandbox.stub(ProviderInstance, 'getComputeEnvironments').resolves(mockEnvResponse)
    const computeStartStub = sandbox
      .stub(ProviderInstance, 'freeComputeStart')
      .resolves(mockComputeResponse)

    const result = await computeStart(
      mockAlgorithm,
      mockSigner,
      mockNodeUrl,
      'py',
      mockEnvResponse[0].id
    )

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.ok(
      // any for now - type 'import(lib.commonjs/providers/network").Network' is not assignable to type ('/lib.esm/providers/network").Network'.
      computeStartStub.calledWith(mockNodeUrl, mockSigner as any, mockEnvResponse[0].id, [], {
        meta: {
          rawcode: mockAlgorithm,
          container: {
            entrypoint: 'python $ALGO',
            image: 'oceanprotocol/c2d_examples',
            tag: 'py-general',
            checksum: ''
          }
        }
      })
    )
  })

  test('checkComputeStatus should return correct status', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'
    const mockConsumerAddress = '0x123'

    sandbox.stub(ProviderInstance, 'computeStatus').resolves({
      ...mockComputeResponse,
      status: 1,
      statusText: 'Running'
    })

    const status = await checkComputeStatus(mockNodeUrl, mockConsumerAddress, mockJobId)
    assert.strictEqual(status.statusText, 'Running')
  })

  test('computeStart should handle missing compute environments', async () => {
    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'console.log("test")'

    sandbox.stub(ProviderInstance, 'getComputeEnvironments').resolves([])

    await assert.rejects(
      computeStart(mockAlgorithm, mockSigner, mockNodeUrl, 'js', undefined),
      /No environment ID provided/
    )
  })

  // test('getComputeLogs should handle successful log streaming', async () => {
  //   const mockNodeUrl = 'http://test-node:8001'
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
  //     mockNodeUrl,
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
  //       `${mockNodeUrl}/directCommand`,
  //       sinon.match({
  //         method: 'POST',
  //         body: sinon.match.string
  //       })
  //     )
  //   )
  // })

  test('getComputeResult should handle successful result retrieval', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockJobId = 'test-job-id'
    const mockSigner = new Wallet('0x' + '1'.repeat(64))
    const mockResponse = 'http://dummy-node-url.com'
    const mockResult = 'hello'

    sandbox.stub(ProviderInstance, 'getComputeResultUrl').resolves(mockResponse)
    sandbox.stub(global, 'fetch').resolves({
      blob: () => Promise.resolve(new Blob([mockResult]))
    } as Response)

    const result = await getComputeResult(mockSigner, mockNodeUrl, mockJobId)
    assert.deepStrictEqual(result, Buffer.from(mockResult))
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

  // test('getComputeLogs should handle failed response', async () => {
  //   const mockNodeUrl = 'http://test-node:8001'
  //   const mockJobId = 'test-job-id'

  //   const fetchStub = sandbox.stub().resolves({
  //     ok: false,
  //     statusText: 'Not Found'
  //   }) as sinon.SinonStub
  //   global.fetch = fetchStub

  //   await getComputeLogs(mockNodeUrl, mockJobId, '0x123', 123, '0xabc', outputChannel)

  //   assert.ok(fetchStub.calledOnce)
  // })
})
