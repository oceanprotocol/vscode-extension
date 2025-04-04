import * as vscode from 'vscode'

export class OceanProtocolViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'oceanProtocolExplorer'
  private nodeUrls = require('./node-urls.json')
  // Get a random node URL from the list
  // private randomNodeUrl = this.nodeUrls[Math.floor(Math.random() * this.nodeUrls.length)]
  private randomNodeUrl = this.nodeUrls[0]

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
      if (currentFilePath && currentFilePath.endsWith('.js')) {
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
        if (editor) {
          const filePath = editor.document.uri.fsPath
          const fileExtension = filePath.split('.').pop()?.toLowerCase()

          if (fileExtension === 'js' || fileExtension === 'py') {
            webviewView.webview.postMessage({
              type: 'fileSelected',
              filePath: filePath,
              elementId: 'selectedAlgorithmPath',
              isDefault: true
            })
          } else {
            webviewView.webview.postMessage({
              type: 'fileSelected',
              filePath: 'Please open either a .js or .py file in the editor.',
              elementId: 'selectedAlgorithmPath',
              isDefault: true,
              error: 'Please open either a .js or .py file in the editor.'
            })
          }
        }
      })

      webviewView.webview.onDidReceiveMessage(async (data) => {
        console.log('Received message from webview:', data)

        try {
          switch (data.type) {
            case 'openFilePicker':
              const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Select',
                filters: {
                  'Algorithm Files': ['js', 'py'],
                  'Dataset Files': ['json']
                }
              }

              if (data.elementId === 'selectedDatasetPath') {
                options.filters = {
                  'Dataset Files': ['json']
                }
                options.openLabel = 'Select Dataset'
              } else if (data.elementId === 'selectedAlgorithmPath') {
                options.filters = {
                  'Algorithm Files': ['js', 'py']
                }
                options.openLabel = 'Select Algorithm'
              }

              const fileUri = await vscode.window.showOpenDialog(options)
              if (fileUri && fileUri[0]) {
                webviewView.webview.postMessage({
                  type: 'fileSelected',
                  filePath: fileUri[0].fsPath,
                  elementId: data.elementId
                })
              }
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
                data.algorithmPath,
                data.resultsFolderPath,
                data.privateKey,
                data.nodeUrl,
                data.datasetPath,
                data.dockerImage,
                data.dockerTag
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

                      <label for="nodeUrlInput">Node URL (including port)</label>
                      <input id="nodeUrlInput" placeholder="Enter compute environment ID" value="${this.randomNodeUrl}" />

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
                      
                      <label for="dockerImageInput">Docker Image (optional)</label>
                      <input id="dockerImageInput" placeholder="Enter custom Docker image name" />

                      <label for="dockerTagInput">Docker Tag (optional)</label>
                      <input id="dockerTagInput" placeholder="Enter custom Docker tag" />
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
                      const privateKey = document.getElementById('privateKeyInput').value;
                      const nodeUrl = document.getElementById('nodeUrlInput').value || "${this.randomNodeUrl}";
                      const dockerImage = document.getElementById('dockerImageInput').value;
                      const dockerTag = document.getElementById('dockerTagInput').value;
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
                              privateKey: privateKey,
                              algorithmPath: selectedAlgorithmPath,
                              resultsFolderPath: selectedResultsFolderPath,
                              nodeUrl: nodeUrl,
                              datasetPath: selectedDatasetPath || undefined,
                              dockerImage: dockerImage || undefined,
                              dockerTag: dockerTag || undefined
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
