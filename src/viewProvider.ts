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
    console.log('resolveWebviewView called')

    try {
      this._view = webviewView

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri]
      }

      // Get the currently active file for algorithm
      const activeEditor = vscode.window.activeTextEditor
      const currentFilePath = activeEditor?.document.uri.fsPath

      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

      // If there's an active file, use it as the algorithm
      if (currentFilePath && currentFilePath.endsWith('.json')) {
        console.log('Setting default algorithm:', currentFilePath)
        webviewView.webview.postMessage({
          type: 'fileSelected',
          filePath: currentFilePath,
          elementId: 'selectedAlgorithmPath',
          isDefault: true
        })
      }

      // Listen for active editor changes
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.fsPath.endsWith('.json')) {
          console.log(
            'Active editor changed, new algorithm file:',
            editor.document.uri.fsPath
          )
          webviewView.webview.postMessage({
            type: 'fileSelected',
            filePath: editor.document.uri.fsPath,
            elementId: 'selectedAlgorithmPath',
            isDefault: true
          })
        }
      })

      webviewView.webview.onDidReceiveMessage(async (data) => {
        console.log('Received message from webview:', data)

        try {
          switch (data.type) {
            case 'openFilePicker':
              console.log('Opening file picker for:', data.elementId)
              await this.openFilePicker(data.elementId)
              break
            case 'selectResultsFolder': {
              console.log('Opening folder picker')
              const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Results Folder'
              })

              if (folderUri && folderUri[0]) {
                console.log('Selected folder:', folderUri[0].fsPath)
                webviewView.webview.postMessage({
                  type: 'resultsFolder',
                  path: folderUri[0].fsPath
                })
              }
              break
            }
            case 'startComputeJob':
              console.log('Starting compute job with data:', data)
              await vscode.commands.executeCommand(
                'ocean-protocol.startComputeJob',
                data.config,
                data.algorithmPath,
                data.resultsFolderPath,
                data.privateKey,
                data.nodeUrl,
                data.datasetPath
              )
              break
          }
        } catch (error) {
          console.error('Error handling message:', error)
          vscode.window.showErrorMessage(`Error handling message: ${error}`)
        }
      })
    } catch (error) {
      console.error('Error in resolveWebviewView:', error)
      vscode.window.showErrorMessage(`Failed to resolve webview: ${error}`)
    }
  }

  private async openFilePicker(elementId: string) {
    console.log('openFilePicker called with elementId:', elementId)

    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select',
      filters: {
        'JSON files': ['json']
      }
    }

    try {
      const fileUri = await vscode.window.showOpenDialog(options)
      console.log('File picker result:', fileUri)

      if (fileUri && fileUri[0]) {
        console.log('Posting message back to webview')
        this._view?.webview.postMessage({
          type: 'fileSelected',
          filePath: fileUri[0].fsPath,
          elementId: elementId
        })
      }
    } catch (error) {
      console.error('Error in openFilePicker:', error)
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
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
          }
          .filePath {
            font-style: italic;
            display: block;
            margin-top: 5px;
            color: var(--vscode-foreground);
          }
          .filePrefix {
            font-style: normal;
            font-weight: bold;
            font-size: 1.1em;
            display: block;
            color: var(--vscode-descriptionForeground);
          }
          #selectedAlgorithmPath {
            margin: 15px 0;
            padding: 5px 0;
          }
          .currentFile {
            margin-top: 5px;
            font-style: normal;
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
          .compute-container {
            padding: 15px 20px;
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
          }
          #startComputeBtn {
            margin: 15px 0;
          }
        </style>
    </head>
    <body>
          <div class="container">
              <div id="selectedAlgorithmPath" class="selectedFile"></div>
              
              <button id="startComputeBtn">Start Compute Job</button>
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

                      <label for="nodeUrlInput">Node URL (including port)</label>
                      <input id="nodeUrlInput" placeholder="Enter compute environment ID" value="http://34.159.64.236:8001" />

                      <label>Dataset</label>
                      <button id="selectDatasetBtn">Select Dataset File</button>
                      <div id="selectedDatasetPath" class="selectedFile"></div>

                      <label>Algorithm</label>
                      <button id="selectAlgorithmBtn">Select Algorithm File</button>

                      <label>Results Folder</label>
                      <button id="selectResultsFolderBtn">Select Results Folder</button>
                      <div id="selectedResultsFolderPath" class="selectedFile"></div>

                      <label for="privateKeyInput">Private Key</label>
                      <input id="privateKeyInput" type="password" placeholder="Enter your private key" />
                  </div>
              </div>
          </div>

          <script>
              const vscode = acquireVsCodeApi();
              let selectedFilePath = '';
              let selectedDatasetPath = '';
              let selectedAlgorithmPath = '';
              let selectedResultsFolderPath = '';
              let isUsingDefaultAlgorithm = false;

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

              // Initialize only the setup section toggle
              document.getElementById('setupHeader').addEventListener('click', () => toggleSection('setup'));

              if (document.getElementById('selectDatasetBtn')) {
                  document.getElementById('selectDatasetBtn').addEventListener('click', () => {
                      console.log('Dataset button clicked');
                      vscode.postMessage({ 
                          type: 'openFilePicker',
                          elementId: 'selectedDatasetPath'
                      });
                  });
              }

              if (document.getElementById('selectAlgorithmBtn')) {
                  document.getElementById('selectAlgorithmBtn').addEventListener('click', () => {
                      console.log('Algorithm button clicked');
                      vscode.postMessage({ 
                          type: 'openFilePicker',
                          elementId: 'selectedAlgorithmPath'
                      });
                  });
              }

              if (document.getElementById('selectResultsFolderBtn')) {
                  document.getElementById('selectResultsFolderBtn').addEventListener('click', () => {
                      console.log('Results folder button clicked');
                      vscode.postMessage({
                          type: 'selectResultsFolder'
                      });
                  });
              }

              if (document.getElementById('startComputeBtn')) {
                  document.getElementById('startComputeBtn').addEventListener('click', () => {
                      const config = getConfig();
                      const privateKey = document.getElementById('privateKeyInput').value;
                      const nodeUrl = document.getElementById('nodeUrlInput').value;

                      // Only require algorithm to be selected
                      if (!selectedAlgorithmPath) {
                          vscode.postMessage({
                              type: 'error',
                              message: 'Please select an algorithm file'
                          });
                          return;
                      }

                      vscode.postMessage({ 
                          type: 'startComputeJob',
                          config: config,
                          privateKey: privateKey,
                          algorithmPath: selectedAlgorithmPath,
                          resultsFolderPath: selectedResultsFolderPath,
                          nodeUrl: nodeUrl,
                          datasetPath: selectedDatasetPath || undefined // Make dataset optional
                      });
                  });
              }

              window.addEventListener('message', event => {
                  const message = event.data;
                  console.log('Received message:', message);
                  
                  switch (message.type) {
                      case 'fileSelected':
                          if (message.elementId === 'selectedDatasetPath') {
                              selectedDatasetPath = message.filePath;
                              const element = document.getElementById('selectedDatasetPath');
                              element.innerHTML = '<span class="filePrefix">Selected dataset: </span><span class="filePath">' + message.filePath + '</span>';
                          } else if (message.elementId === 'selectedAlgorithmPath') {
                              selectedAlgorithmPath = message.filePath;
                              isUsingDefaultAlgorithm = message.isDefault || false;
                              const element = document.getElementById('selectedAlgorithmPath');
                              const prefix = isUsingDefaultAlgorithm ? 'Current algorithm file: ' : 'Selected algorithm: ';
                              element.innerHTML = '<span class="filePrefix">' + prefix + '</span><span class="filePath">' + message.filePath + '</span>';
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
