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
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
          }
          .container {
            padding: 0 20px;
          }
          input, button { 
            margin: 5px 0; 
            width: 100%; 
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
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
          .section {
            margin-bottom: 10px;
          }
          .section-header {
            background-color: var(--vscode-sideBarSectionHeader-background);
            color: var(--vscode-sideBarSectionHeader-foreground);
            padding: 10px 20px;
            cursor: pointer;
            user-select: none;
            font-weight: bold;
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            align-items: center;
          }
          .section-content {
            padding: 10px 0;
            display: none;
          }
          .section-content.active {
            display: block;
          }
          .section-header:hover {
            background-color: var(--vscode-sideBarSectionHeader-hoverBackground);
          }
          .chevron {
            margin-right: 5px;
            transition: transform 0.3s ease;
          }
          .section-header.active .chevron {
            transform: rotate(90deg);
          }
        </style>
    </head>
    <body>
        <div class="section">
            <div id="setupHeader" class="section-header active">
                <span class="chevron">&#9658;</span>Setup
            </div>
            <div id="setup" class="section-content active">
                <div class="container">
                    <label for="rpcUrl">RPC URL</label>
                    <input id="rpcUrl" placeholder="RPC URL" value="http://127.0.0.1:8545" />

                    <label for="nodeUrl">Ocean Node URL</label>
                    <input id="nodeUrl" placeholder="Ocean Node URL" value="http://127.0.0.1:8001" />
                </div>
            </div>
        </div>

        <div class="section">
            <div id="getAssetHeader" class="section-header">
                <span class="chevron">&#9658;</span>Get Asset Details
            </div>
            <div id="getAsset" class="section-content">
                <div class="container">
                    <label for="didInput">Ocean Asset DID</label>
                    <input id="didInput" placeholder="Enter the DID for the asset" />
                    <button id="getAssetDetailsBtn">Get Asset DDO</button>
                </div>
            </div>
        </div>

        <div class="section">
            <div id="publishHeader" class="section-header">
                <span class="chevron">&#9658;</span>Publish Asset
            </div>
            <div id="publish" class="section-content">
                <div class="container">
                    <button id="selectFileBtn">Select Asset File</button>
                    <div id="selectedFilePath"></div>

                    <label for="privateKeyInput">Private Key</label>
                    <input id="privateKeyInput" type="password" placeholder="Enter your private key" />

                    <button id="publishAssetBtn">Publish Asset</button>
                </div>
            </div>
        </div>

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

            function toggleSection(sectionId) {
                const header = document.getElementById(sectionId + 'Header');
                const content = document.getElementById(sectionId);
                header.classList.toggle('active');
                content.classList.toggle('active');
            }

            document.addEventListener('DOMContentLoaded', (event) => {
                document.getElementById('setupHeader').addEventListener('click', () => toggleSection('setup'));
                document.getElementById('getAssetHeader').addEventListener('click', () => toggleSection('getAsset'));
                document.getElementById('publishHeader').addEventListener('click', () => toggleSection('publish'));
            });

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
