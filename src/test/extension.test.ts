import * as assert from 'assert'
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import { computeStart, checkComputeStatus } from '../helpers/compute'
import { Wallet } from 'ethers'
import axios from 'axios'

// Use VS Code test runner syntax
suite('Ocean Protocol Extension Test Suite', () => {
  let sandbox: sinon.SinonSandbox

  setup(() => {
    sandbox = sinon.createSandbox()
  })

  teardown(() => {
    sandbox.restore()
  })

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('ocean-protocol'))
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
})
