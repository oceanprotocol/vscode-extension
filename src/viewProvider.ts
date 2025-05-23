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

      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

      webviewView.webview.onDidReceiveMessage(async (data) => {
        console.log('Received message from webview:', data)

        try {
          switch (data.type) {
            case 'validateDatasetFromInput':
              const isValid = await vscode.commands.executeCommand(
                'ocean-protocol.validateDataset',
                data.nodeUrl,
                data.input
              )
              webviewView.webview.postMessage({
                type: 'datasetValidationResult',
                isValid: isValid
              })
              break
            case 'getEnvironments':
              try {
                const environments = await vscode.commands.executeCommand(
                  'ocean-protocol.getEnvironments',
                  data.nodeUrl
                )
                webviewView.webview.postMessage({
                  type: 'environmentsLoaded',
                  environments: environments
                })
              } catch (error) {
                console.error('Error loading environments:', error)
                webviewView.webview.postMessage({
                  type: 'environmentsLoaded',
                  environments: [],
                  error: 'Failed to load compute environments'
                })
              }
              break
            case 'openFilePicker':
              const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Select',
                defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
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
                data.dockerTag,
                data.environmentId
              )
              break
            case 'copyToClipboard':
              vscode.env.clipboard.writeText(data.text)
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
            margin: 10px 0;
          }
          .environment-section {
            margin: 15px 0;
          }
          .environment-select {
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
          }
          .environment-details {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 0.9em;
            display: none;
          }
          .environment-details.active {
            display: block;
          }
          .environment-details p {
            margin: 5px 0;
          }
          .environment-details .label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
          }
          .error-message {
            color: var(--vscode-errorForeground);
            font-size: 0.9em;
            display: none;
          }
        </style>
    </head>
    <body>
          <div class="container">
              <div id="selectedAlgorithmPath" class="selectedFile">
                <span class="filePrefix">Selected algorithm: </span>
                <span class="filePath">Please select a .js or .py file</span>
              </div>
              
              <button id="startComputeBtn">Start Compute Job</button>
              <div id="errorMessage" class="error-message"></div>
          </div>

          <div class="section">
              <div id="setupHeader" class="section-header">
                  <span class="chevron">&#9658;</span>Setup
              </div>
              <div id="setup" class="section-content">
                  <div class="container">

                      <label for="nodeUrlInput">Node URL (including port)</label>
                      <input id="nodeUrlInput" placeholder="Enter compute environment ID" value="${this.randomNodeUrl}" />

                      <div class="environment-section">
                        <label for="environmentSelect">Compute Environment</label>
                        <select id="environmentSelect" class="environment-select">
                          <option value="">Loading environments...</option>
                        </select>
                        <div id="environmentDetails" class="environment-details"></div>
                      </div>

                      <label>Algorithm</label>
                      <button id="selectAlgorithmBtn">Select Algorithm File</button>

                      <label>Results Folder</label>
                      <button id="selectResultsFolderBtn">Select Results Folder</button>
                      <div id="selectedResultsFolderPath" class="selectedFile"></div>

                      <div style="display: flex; align-items: baseline; gap: 8px;">
                        <label for="datasetInput">Dataset URL/IPFS/Arweave/DID</label>
                        <span id="datasetValidationIcon" style="font-size: 1em; min-width: 20px; line-height: 1;"></span>
                      </div>
                      <input id="datasetInput" placeholder="Enter URL, IPFS hash, Arweave ID, or DID" />

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
              let selectedAlgorithmPath = '';
              let selectedResultsFolderPath = '';
              let isUsingDefaultAlgorithm = false;
              let selectedEnvironment = null;
              let availableEnvironments = [];

              const environmentDetails = document.getElementById('environmentDetails');
              const nodeUrlInput = document.getElementById('nodeUrlInput');
              const select = document.getElementById('environmentSelect');

              function toggleSection(sectionId) {
                  const header = document.getElementById(sectionId + 'Header');
                  const content = document.getElementById(sectionId);
                  header.classList.toggle('active');
                  content.classList.toggle('active');
              }

              // Initialize only the setup section toggle
              document.getElementById('setupHeader').addEventListener('click', () => toggleSection('setup'));

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

              if (document.getElementById('datasetInput')) {
                document.getElementById('datasetInput').addEventListener('input', (e) => {
                  const input = e.target.value.trim();
                  const validationIcon = document.getElementById('datasetValidationIcon');
                  const nodeUrl = document.getElementById('nodeUrlInput').value;
                  
                  if (!input) {
                    validationIcon.textContent = '';
                    document.getElementById('errorMessage').style.display = 'none';
                    return;
                  }

                  console.log('Dataset input changed:', input);
                  vscode.postMessage({
                    type: 'validateDatasetFromInput',
                    nodeUrl: nodeUrl,
                    input: input
                  });
                });
              }

              if (document.getElementById('startComputeBtn')) {
                  document.getElementById('startComputeBtn').addEventListener('click', () => {
                      const privateKey = document.getElementById('privateKeyInput').value;
                      const nodeUrl = document.getElementById('nodeUrlInput').value || "${this.randomNodeUrl}";
                      const dockerImage = document.getElementById('dockerImageInput').value;
                      const dockerTag = document.getElementById('dockerTagInput').value;
                      const errorMessage = document.getElementById('errorMessage');
                      
                      // Check for required fields
                      if (!selectedAlgorithmPath) {
                          errorMessage.textContent = 'Please select an algorithm file';
                          errorMessage.style.display = 'block';
                          return;
                      }
                      
                      if (!selectedResultsFolderPath) {
                          errorMessage.textContent = 'Please select a results folder';
                          errorMessage.style.display = 'block';
                          return;
                      }

                      // Clear any previous error
                      errorMessage.style.display = 'none';

                      // Clear any previous error
                      errorMessage.style.display = 'none';

                      const datasetInput = document.getElementById('datasetInput').value;
                      vscode.postMessage({ 
                          type: 'startComputeJob',
                          privateKey: privateKey,
                          algorithmPath: selectedAlgorithmPath,
                          resultsFolderPath: selectedResultsFolderPath,
                          nodeUrl: nodeUrl,
                          datasetPath: datasetInput || undefined,
                          dockerImage: dockerImage || undefined,
                          dockerTag: dockerTag || undefined,
                          environmentId: document.getElementById('environmentSelect').value || undefined
                      });
                  });
              }

              async function loadEnvironments() {
                const nodeUrl = nodeUrlInput.value;
                if (!nodeUrl) return;

                select.innerHTML = '<option value="">Loading environments...</option>';
                select.disabled = true;
                environmentDetails.style.display = 'none';

                try {
                  vscode.postMessage({
                    type: 'getEnvironments',
                    nodeUrl: nodeUrl
                  });
                } catch (error) {
                  console.error('Error loading environments:', error);
                  select.innerHTML = '<option value="">Error loading environments</option>';
                  select.disabled = true;
                  environmentDetails.style.display = 'none';
                }
              }

              nodeUrlInput.addEventListener('input', loadEnvironments);
              loadEnvironments();

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
                      case 'datasetValidationResult':
                        const validationIcon = document.getElementById('datasetValidationIcon');
                        if(!message.isValid) {
                          validationIcon.textContent = 'x';
                          validationIcon.style.color = 'var(--vscode-errorForeground)';
                          return
                        }
                        validationIcon.textContent = '✓';
                        validationIcon.style.color = '#4CAF50';
                        break;
                      case 'environmentsLoaded':
                          console.log('Environments loaded:', message.environments);
                          availableEnvironments = message.environments;
                          const select = document.getElementById('environmentSelect');
                          
                          if (message.error) {
                            select.innerHTML = '<option value="">' + message.error + '</option>';
                            select.disabled = true;
                            document.getElementById('environmentDetails').style.display = 'none';
                            return;
                          }
                          
                          if (!message.environments || message.environments.length === 0) {
                            select.innerHTML = '<option value="">No environments available</option>';
                            select.disabled = true;
                            document.getElementById('environmentDetails').style.display = 'none';
                            return;
                          }

                          select.innerHTML = '';
                          message.environments.forEach(env => {
                              const option = document.createElement('option');
                              option.value = env.id;
                              const truncatedId = env.id.length > 13 
                                  ? env.id.substring(0, 6) + '...' + env.id.substring(env.id.length - 4)
                                  : env.id;
                              option.textContent = env.platform.os + ' (' + truncatedId + ')';
                              select.appendChild(option);
                          });
                          select.disabled = false;
                          document.getElementById('environmentDetails').style.display = 'none';

                          function showEnvDetails(envId) {
                              const detailsDiv = document.getElementById('environmentDetails');
                              const selectedEnv = availableEnvironments.find(e => e.id === envId);
                              if (!selectedEnv) {
                                  detailsDiv.style.display = 'none';
                                  return;
                              }

                              // Format environment ID to show first and last few characters
                              const truncatedId = selectedEnv.id.length > 13 
                                  ? selectedEnv.id.substring(0, 6) + '...' + selectedEnv.id.substring(selectedEnv.id.length - 4)
                                  : selectedEnv.id;

                              // Process resources to show min/max values for paid resources
                              const paidResourceDetails = selectedEnv.resources.map(r => {
                                  let value = '';
                                  if (r.id === 'ram' || r.id === 'disk') {
                                      const minGb = Math.round(r.min / (1024 * 1024 * 1024));
                                      const maxGb = Math.round(r.max / (1024 * 1024 * 1024));
                                      value = minGb + '/' + maxGb + ' GB';
                                  } else {
                                      value = r.min + '/' + r.max;
                                  }
                                  return '<p style="margin: 4px 0;"><span class="label">' + r.id.toUpperCase() + ' (Min/Max):</span> ' + value + '</p>';
                              }).join('');

                              // Process resources for free tier
                              const freeResourceDetails = selectedEnv.free.resources.map(r => {
                                  let value = '';
                                  if (r.id === 'ram' || r.id === 'disk') {
                                      const maxGb = Math.round(r.max / (1024 * 1024 * 1024));
                                      value = maxGb + ' GB';
                                  } else {
                                      value = r.max;
                                  }
                                  return '<p style="margin: 4px 0;"><span class="label">' + r.id.toUpperCase() + ' (Max):</span> ' + value + '</p>';
                              }).join('');

                              detailsDiv.innerHTML = 
                                  '<p><span class="label">Environment ID:</span> ' + truncatedId + '</p>' +
                                  '<p><span class="label">OS:</span> ' + selectedEnv.platform.os + '</p>' +
                                  '<p><span class="label">Architecture:</span> ' + selectedEnv.platform.architecture + '</p>' +
                                  '<div style="margin: 4px 0;">' +
                                  '<div class="label" style="margin-bottom: 2px;">Consumer Address:</div>' +
                                  '<div style="display: flex; align-items: center; gap: 8px; background: var(--vscode-input-background); padding: 4px; border-radius: 4px;">' +
                                  '<span style="font-family: monospace; flex-grow: 1; overflow-x: auto; white-space: nowrap;">' + 
                                  (selectedEnv.consumerAddress.length > 24 
                                      ? selectedEnv.consumerAddress.substring(0, 12) + '...' + selectedEnv.consumerAddress.substring(selectedEnv.consumerAddress.length - 8)
                                      : selectedEnv.consumerAddress) + 
                                  '</span>' +
                                  '<button id="copyAddressBtn" ' +
                                  'style="padding: 2px 8px; margin: 0; width: auto; min-width: 60px; font-size: 0.9em;">Copy</button>' +
                                  '</div>' +
                                  '</div>' +
                                  '<p><span class="label">Free Resources:</span></p>' +
                                  '<div style="margin-left: 8px;">' + 
                                  freeResourceDetails +
                                  '<p style="margin: 4px 0;"><span class="label">Max Job Duration:</span> ' + selectedEnv.free.maxJobDuration + ' seconds</p>' +
                                  '</div>';
                              detailsDiv.style.display = 'block';

                              const copyBtn = document.getElementById('copyAddressBtn');
                              if (copyBtn) {
                                  copyBtn.addEventListener('click', () => {
                                      vscode.postMessage({
                                          type: 'copyToClipboard',
                                          text: selectedEnv.consumerAddress
                                      });
                                      copyBtn.textContent = 'Copied!';
                                      setTimeout(() => {
                                          copyBtn.textContent = 'Copy';
                                      }, 1500);
                                  });
                              }
                          }

                          if (select.options.length > 0) {
                              select.selectedIndex = 0;
                              showEnvDetails(select.value);
                          }

                          select.addEventListener('change', function() {
                              showEnvDetails(this.value);
                          });
                          break;
                  }
              });
          </script>
    </body>
    </html>
    `
  }
}
