import * as vscode from 'vscode'

export class OceanProtocolViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'oceanProtocolExplorer'

  private _view?: vscode.WebviewView

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    webviewView.webview.onDidReceiveMessage((data) => {
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
        case 'openFilePicker':
          this.openFilePicker()
          break
      }
    })
  }

  private async openFilePicker() {
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
        filePath: fileUri[0].fsPath
      })
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ocean Protocol Extension</title>
          <style>
            body { 
              padding: 10px; 
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
            }
            input, button { 
              margin: 5px 0; 
              width: 100%; 
              padding: 8px;
              border: 1px solid var(--vscode-input-border);
              background-color: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
            }
            button {
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
            }
            button:hover {
              background-color: var(--vscode-button-hoverBackground);
            }
            label {
              margin-top: 10px;
              display: block;
            }
            #selectedFilePath {
              margin-top: 5px;
              font-style: italic;
            }
          </style>
      </head>
      <body>
          <h2>Ocean Protocol Explorer</h2>

          <h3>Configuration</h3>
          <label for="rpcUrl">RPC URL</label>
          <input id="rpcUrl" placeholder="RPC URL" value="http://127.0.0.1:8545" />

          <label for="nodeUrl">Ocean Node URL</label>
          <input id="nodeUrl" placeholder="Ocean Node URL" value="http://127.0.0.1:8001" />

          <h3>Get Asset Details</h3>
          <label for="didInput">Ocean Asset DID</label>
          <input id="didInput" placeholder="Enter the DID for the asset" />
          <button id="getAssetDetailsBtn">Get Asset DDO</button>

          <h3>Publish Asset</h3>
          <button id="selectFileBtn">Select Asset File</button>
          <div id="selectedFilePath"></div>

          <label for="privateKeyInput">Private Key</label>
          <input id="privateKeyInput" type="password" placeholder="Enter your private key" />

          <button id="publishAssetBtn">Publish Asset</button>

          <script>
              const vscode = acquireVsCodeApi();
              let selectedFilePath = '';
              
              function getConfig() {
                const defaultAquariusUrl = 'http://127.0.0.1:8001';
                return {
                  rpcUrl: document.getElementById('rpcUrl').value || 'http://127.0.0.1:8545',
                  aquariusUrl: document.getElementById('nodeUrl').value || defaultAquariusUrl,
                  providerUrl: document.getElementById('nodeUrl').value || defaultAquariusUrl
                };
              }

              document.getElementById('getAssetDetailsBtn').addEventListener('click', () => {
                  const config = getConfig();
                  const did = document.getElementById('didInput').value;
                  vscode.postMessage({ 
                    type: 'getAssetDetails', 
                    config: config, 
                    did: did 
                  });
              });

              document.getElementById('selectFileBtn').addEventListener('click', () => {
                  vscode.postMessage({ type: 'openFilePicker' });
              });

              document.getElementById('publishAssetBtn').addEventListener('click', () => {
                  const config = getConfig();
                  const privateKey = document.getElementById('privateKeyInput').value;
                  vscode.postMessage({ 
                    type: 'publishAsset', 
                    config: config, 
                    filePath: selectedFilePath,
                    privateKey: privateKey
                  });
              });

              window.addEventListener('message', event => {
                  const message = event.data;
                  switch (message.type) {
                      case 'fileSelected':
                          selectedFilePath = message.filePath;
                          document.getElementById('selectedFilePath').textContent = 'Selected file: ' + selectedFilePath;
                          break;
                  }
              });
          </script>
      </body>
      </html>
    `
  }
}
