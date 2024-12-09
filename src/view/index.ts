// oceanProtocolView.ts
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

export class OceanProtocolViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'oceanProtocolExplorer'
  private _view?: vscode.WebviewView

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private nodeId: string
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')]
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)
    webviewView.webview.onDidReceiveMessage(this.handleMessage.bind(this))
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get paths to resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'scripts', 'main.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'styles', 'main.css')
    )
    const nonce = getNonce()

    // Read HTML template
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      'src',
      'webview',
      'templates',
      'index.html'
    )
    let htmlTemplate = fs.readFileSync(htmlPath, 'utf-8')

    // Replace template variables
    return htmlTemplate
      .replace('${nonce}', nonce)
      .replace('${webview.cspSource}', webview.cspSource)
      .replace('${styleUri}', styleUri.toString())
      .replace('${scriptUri}', scriptUri.toString())
      .replace(
        '${nodeId}',
        this.nodeId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      )
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'getAssetDetails':
        vscode.commands.executeCommand(
          'ocean-protocol.getAssetDetails',
          data.config,
          data.did
        )
        break

      case 'publishAsset':
        vscode.commands.executeCommand(
          'ocean-protocol.publishAsset',
          data.config,
          data.filePath,
          data.privateKey
        )
        break

      case 'downloadAsset':
        vscode.commands.executeCommand(
          'ocean-protocol.downloadAsset',
          data.config,
          data.filePath,
          data.privateKey,
          data.assetDid
        )
        break

      case 'openFilePicker':
        this.openFilePicker(data.elementId)
        break

      case 'getOceanPeers':
        vscode.commands.executeCommand('ocean-protocol.getOceanPeers')
        break

      case 'startComputeJob':
        vscode.commands.executeCommand(
          'ocean-protocol.startComputeJob',
          data.config,
          data.datasetPath,
          data.algorithmPath,
          data.privateKey,
          data.nodeUrl
        )
        break

      case 'error':
        vscode.window.showErrorMessage(data.message)
        break
    }
  }

  private async openFilePicker(elementId: string) {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select',
      filters: {
        'JSON files': ['json']
      }
    }

    const fileUri = await vscode.window.showOpenDialog(options)
    if (fileUri && fileUri[0]) {
      this._view?.webview.postMessage({
        type: 'fileSelected',
        filePath: fileUri[0].fsPath,
        elementId: elementId
      })
    }
  }
}

function getNonce() {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
