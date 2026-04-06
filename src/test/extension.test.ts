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
import { ComputeEnvironment, ComputeJob, ProviderInstance } from '@oceanprotocol/lib'
import { SelectedConfig } from '../types'

suite('Ocean Orchestrator Test Suite', () => {
  const mockAuthToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxMjM0NTY3ODkwYWJjZGVmIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  const mockMultiaddr =
    '/ip4/35.202.16.215/tcp/9001/tls/sni/35-202-16-215.kzwfwjn5ji4puuok23h2yyzro0fe1rqv1bqzbmrjf7uqyj504rawjl4zs68mepr.libp2p.direct/ws/p2p/16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'

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
    sandbox.stub(ProviderInstance, 'setupP2P').resolves()
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
    sandbox.stub(ProviderInstance, 'freeComputeStart').resolves(mockComputeResponse)

    const mockConfig: SelectedConfig = new SelectedConfig({
      multiaddresses: [mockMultiaddr],
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
    const freeComputeStub = sandbox
      .stub(ProviderInstance, 'freeComputeStart')
      .resolves(mockComputeResponse)

    const mockConfig: SelectedConfig = new SelectedConfig({
      multiaddresses: [mockMultiaddr],
      environmentId: mockEnvResponse[0].id,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    const result = await computeStart(mockConfig, mockAlgorithm, 'py')

    assert.strictEqual(result.jobId, 'test-job-id')
    assert.ok(
      freeComputeStub.calledWith(
        mockMultiaddr,
        mockAuthToken,
        mockEnvResponse[0].id,
        sinon.match.array,
        sinon.match({
          meta: sinon.match({
            rawcode: mockAlgorithm,
            container: sinon.match({
              entrypoint: 'python $ALGO',
              image: 'oceanprotocol/c2d_examples',
              tag: 'py-general'
            })
          })
        }),
        sinon.match.any
      )
    )
  })

  test('checkComputeStatus should return correct status', async () => {
    const mockJobId = 'test-job-id'
    sandbox.stub(ProviderInstance, 'computeStatus').resolves({
      ...mockComputeResponse,
      status: 1,
      statusText: 'Running'
    })

    const mockConfig: SelectedConfig = new SelectedConfig({
      multiaddresses: [mockMultiaddr],
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
      multiaddresses: [mockMultiaddr],
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    await assert.rejects(
      computeStart(mockConfig, mockAlgorithm, 'js'),
      /No environment ID provided/
    )
  })

  test('getComputeResult should handle successful result retrieval', async () => {
    const mockJobId = 'test-job-id'
    const mockResult = 'hello'
    const buf = Buffer.from(mockResult)

    sandbox.stub(ProviderInstance, 'getComputeResult').resolves(
      (async function* () {
        yield new Uint8Array(buf)
      })()
    )

    const mockConfig: SelectedConfig = new SelectedConfig({
      multiaddresses: [mockMultiaddr],
      environmentId: mockEnvResponse[0].id,
      isFreeCompute: true,
      authToken: mockAuthToken
    })

    const result = await getComputeResult(mockConfig, mockJobId)
    const content = await streamToString(result)
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

    if (!fs.existsSync(mockFolderPath)) {
      await fs.promises.mkdir(mockFolderPath, { recursive: true })
    }

    try {
      const filePath = await saveResults(JSON.stringify(mockResults), mockFolderPath)

      const fileExists = fs.existsSync(filePath)
      assert.ok(fileExists, 'Result file should exist')

      const content = await fs.promises.readFile(filePath, 'utf8')
      assert.strictEqual(content, JSON.stringify(mockResults))

      const pathParts = filePath.split(path.sep)
      const logsFolderName = pathParts[pathParts.length - 2]
      assert.strictEqual(logsFolderName, 'logs', 'File should be in logs folder')

      await fs.promises.rmdir(mockFolderPath, { recursive: true })
    } catch (error) {
      if (fs.existsSync(mockFolderPath)) {
        await fs.promises.rmdir(mockFolderPath, { recursive: true })
      }
      throw error
    }
  })
})
