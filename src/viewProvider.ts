import * as vscode from 'vscode'

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
      localResourceRoots: [this._extensionUri]
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'openFilePicker':
          this.openFilePicker(data.elementId)
          break
        case 'selectResultsFolder': {
          const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Results Folder'
          })

          if (folderUri && folderUri[0]) {
            webviewView.webview.postMessage({
              type: 'resultsFolder',
              path: folderUri[0].fsPath
            })
          }
          break
        }
        case 'startComputeJob':
          vscode.commands.executeCommand(
            'ocean-protocol.startComputeJob',
            data.config,
            data.datasetPath,
            data.algorithmPath,
            data.resultsFolderPath,
            data.privateKey,
            data.nodeUrl
          )
          break
      }
    })
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
          .selectedFile {
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
            <div id="computeHeader" class="section-header active">
                <span class="chevron">&#9658;</span>Start Compute Job
            </div>
            <div id="compute" class="section-content active">
                <div class="container">
                    <label>Dataset</label>
                    <button id="selectDatasetBtn">Select Dataset File</button>
                    <div id="selectedDatasetPath" class="selectedFile"></div>
                    
                    <label>Algorithm</label>
                    <button id="selectAlgorithmBtn">Select Algorithm File</button>
                    <div id="selectedAlgorithmPath" class="selectedFile"></div>
                    
                    <label>Results Folder</label>
                    <button id="selectResultsFolderBtn">Select Results Folder</button>
                    <div id="selectedResultsFolderPath" class="selectedFile"></div>
                    
                    <label for="nodeUrlInput">Node URL (including port)</label>
                    <input id="nodeUrlInput" placeholder="Enter compute environment ID" />
                    
                    <button id="startComputeBtn">Start Compute Job</button>
                </div>
            </div>

            <div class="section">
            <div id="setupHeader" class="section-header">
                <span class="chevron">&#9658;</span>Setup
            </div>
            <div id="setup" class="section-content">
                <div class="container">
                    <label for="rpcUrl">RPC URL</label>
                    <input id="rpcUrl" placeholder="RPC URL" value="http://127.0.0.1:8545" />

                    <label for="nodeUrl">Ocean Node URL</label>
                    <input id="nodeUrl" placeholder="Ocean Node URL" value="http://127.0.0.1:8000" />

                    <label for="privateKeyInput">Private Key</label>
                    <input id="privateKeyInput" type="password" placeholder="Enter your private key" />
                </div>
            </div>
        </div>
        </div>
        </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let selectedFilePath = '';
            let selectedDatasetPath = '';
            let selectedAlgorithmPath = '';

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
                document.getElementById('computeHeader').addEventListener('click', () => toggleSection('compute'));

                document.getElementById('selectFileBtn').addEventListener('click', () => {
                    vscode.postMessage({ 
                        type: 'openFilePicker',
                        elementId: 'selectedFilePath'
                    });
                });

                document.getElementById('selectDatasetBtn').addEventListener('click', () => {
                    vscode.postMessage({ 
                        type: 'openFilePicker',
                        elementId: 'selectedDatasetPath'
                    });
                });

                document.getElementById('selectAlgorithmBtn').addEventListener('click', () => {
                    vscode.postMessage({ 
                        type: 'openFilePicker',
                        elementId: 'selectedAlgorithmPath'
                    });
                });

                document.getElementById('selectResultsFolderBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'selectResultsFolder'
                    });
                });

                document.getElementById('startComputeBtn').addEventListener('click', () => {
                  const config = getConfig();
                    const privateKey = document.getElementById('privateKeyInput').value;
                    const nodeUrl = document.getElementById('nodeUrlInput').value;

                    if (!selectedDatasetPath || !selectedAlgorithmPath) {
                        vscode.postMessage({
                            type: 'error',
                            message: 'Please select both dataset and algorithm files'
                        });
                        return;
                    }

                    vscode.postMessage({ 
                        type: 'startComputeJob',
                        config: config,
                        privateKey: privateKey,
                        datasetPath: selectedDatasetPath,
                        algorithmPath: selectedAlgorithmPath,
                        resultsFolderPath: selectedResultsFolderPath,
                        nodeUrl: nodeUrl
                    });
                });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'fileSelected':
                        if (message.elementId === 'selectedDatasetPath') {
                            selectedDatasetPath = message.filePath;
                            document.getElementById('selectedDatasetPath').textContent = 'Selected dataset: ' + message.filePath;
                        } else if (message.elementId === 'selectedAlgorithmPath') {
                            selectedAlgorithmPath = message.filePath;
                            document.getElementById('selectedAlgorithmPath').textContent = 'Selected algorithm: ' + message.filePath;
                        } else {
                            selectedFilePath = message.filePath;
                            document.getElementById('selectedFilePath').textContent = 'Selected file: ' + message.filePath;
                        }
                        break;
                    case 'nodeId':
                        document.getElementById('nodeIdDisplay').textContent = message.nodeId;
                        break;
                    case 'resultsFolder':
                        selectedResultsFolderPath = message.path;
                        document.getElementById('selectedResultsFolderPath').textContent = message.path;
                        break;
                  }
            });
        </script>
    </body>
    </html>
    `
  }
}
