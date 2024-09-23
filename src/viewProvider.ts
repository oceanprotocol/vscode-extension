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
        case 'searchAssets':
          vscode.commands.executeCommand('ocean-protocol.searchAssets', data.config)
          break
        case 'getAssetDetails':
          vscode.commands.executeCommand('ocean-protocol.getAssetDetails', data.config)
          break
      }
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ocean Protocol Explorer</title>
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
          </style>
      </head>
      <body>
          <label for="rpcUrl">RPC URL</label>
          <input id="rpcUrl" placeholder="RPC URL" />

          <label for="nodeUrl">Ocean Node URL</label>
          <input id="nodeUrl" placeholder="Ocean Node URL" />

          <button id="searchAssetsBtn">Search Assets</button>
          <button id="getAssetDetailsBtn">Get Asset Details</button>

          <script>
              const vscode = acquireVsCodeApi();
              
              function getConfig() {
                return {
                  rpcUrl: document.getElementById('rpcUrl').value,
                  aquariusUrl: document.getElementById('nodeUrl').value,
                  providerUrl: document.getElementById('nodeUrl').value
                };
              }

              document.getElementById('searchAssetsBtn').addEventListener('click', () => {
                  vscode.postMessage({ type: 'searchAssets', config: getConfig() });
              });
              document.getElementById('getAssetDetailsBtn').addEventListener('click', () => {
                  vscode.postMessage({ type: 'getAssetDetails', config: getConfig() });
              });
          </script>
      </body>
      </html>
    `
  }
}
