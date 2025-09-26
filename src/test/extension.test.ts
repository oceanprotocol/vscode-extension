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
import { SelectedConfig } from '../types'

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
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'console.log("test")'

    sandbox.stub(ProviderInstance, 'getComputeEnvironments').resolves(mockEnvResponse)
    sandbox.stub(ProviderInstance, 'freeComputeStart').resolves(mockComputeResponse)
    const mockConfig: SelectedConfig = new SelectedConfig({ nodeUrl: mockNodeUrl, environmentId: mockEnvResponse[0].id, isFreeCompute: true });

    const result = await computeStart(
      mockConfig,
      mockAlgorithm,
      'js',
    )


    assert.strictEqual(result.jobId, 'test-job-id')
    assert.strictEqual(result.statusText, 'Created')
  })

  test('computeStart should handle Python algorithm correctly', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'print("test")'

    sandbox.stub(ProviderInstance, 'getComputeEnvironments').resolves(mockEnvResponse)
    const computeStartStub = sandbox
      .stub(ProviderInstance, 'freeComputeStart')
      .resolves(mockComputeResponse)

    const mockConfig: SelectedConfig = new SelectedConfig({ nodeUrl: mockNodeUrl, environmentId: mockEnvResponse[0].id, isFreeCompute: true });

    const result = await computeStart(
      mockConfig,
      mockAlgorithm,
      'py',
    )

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.ok(
      computeStartStub.calledWith(mockConfig.nodeUrl, mockConfig.authToken, mockConfig.environmentId, [], sinon.match({
        meta: {
          rawcode: mockAlgorithm,
          container: sinon.match({
            entrypoint: 'python $ALGO',
            image: 'oceanprotocol/c2d_examples',
            tag: 'py-general',
          })
        }
      }))
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

    const mockConfig: SelectedConfig = new SelectedConfig({ nodeUrl: mockNodeUrl, environmentId: mockEnvResponse[0].id, isFreeCompute: true });

    const status = await checkComputeStatus(mockConfig, mockJobId)
    assert.strictEqual(status.statusText, 'Running')
  })

  test('computeStart should handle missing compute environments', async () => {
    const mockNodeUrl = 'http://test-node:8001'
    const mockAlgorithm = 'console.log("test")'
    const mockConfig: SelectedConfig = new SelectedConfig({ nodeUrl: mockNodeUrl, isFreeCompute: true });

    sandbox.stub(ProviderInstance, 'getComputeEnvironments').resolves([])

    await assert.rejects(
      computeStart(mockConfig, mockAlgorithm, 'js'),
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

    const mockConfig: SelectedConfig = new SelectedConfig({ nodeUrl: mockNodeUrl, environmentId: mockEnvResponse[0].id, isFreeCompute: true });

    const result = await getComputeResult(mockConfig, mockJobId)
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
