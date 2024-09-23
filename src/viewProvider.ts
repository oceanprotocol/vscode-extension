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
          <input id="rpcUrl" placeholder="RPC URL" value="https://polygon-rpc.com/" />

          <label for="nodeUrl">Ocean Node URL</label>
          <input id="nodeUrl" placeholder="Ocean Node URL" value="https://v4.aquarius.oceanprotocol.com" />

          <label for="didInput">Ocean Asset DID</label>
          <input id="didInput" placeholder="Enter the DID for the asset" />

          <button id="getAssetDetailsBtn">Get Asset DDO</button>

          <script>
              const vscode = acquireVsCodeApi();
              
              function getConfig() {
                const defaultAquariusUrl = 'https://v4.aquarius.oceanprotocol.com';
                return {
                  rpcUrl: document.getElementById('rpcUrl').value || 'https://polygon-rpc.com/',
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
          </script>
      </body>
      </html>
    `
  }
}
