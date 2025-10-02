import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { SelectedConfig } from './types'
import { Language, getAvailableLanguages, getLanguageTemplates, detectProjectType } from './helpers/project-data'

export class OceanProtocolViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'oceanProtocolExplorer'
  private nodeUrls = require('./node-urls.json')
  // Get a random node URL from the list
  // private randomNodeUrl = this.nodeUrls[Math.floor(Math.random() * this.nodeUrls.length)]
  private randomNodeUrl = this.nodeUrls[0]
  private config: SelectedConfig

  private _view?: vscode.WebviewView

  constructor() { }

  public notifyConfigUpdate(config: SelectedConfig) {
    this.config = config
    if (this._view?.webview) {
      this._view.webview.postMessage({
        type: 'configUpdate',
        config
      })
    }
  }

  public sendMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message)
    }
  }

  private async closeOldProjectTabs() {
    try {
      const openEditors = vscode.window.tabGroups.all.flatMap(group => group.tabs)
      const projectFileNames = ['algo.py', 'algo.js', 'Dockerfile', 'requirements.txt', 'package.json']

      for (const tab of openEditors) {
        if (tab.input instanceof vscode.TabInputText) {
          const fileName = path.basename(tab.input.uri.fsPath)
          if (projectFileNames.includes(fileName)) {
            await vscode.window.tabGroups.close(tab)
          }
        }
      }
    } catch (error) {
      console.error('Error closing old project tabs:', error)
    }
  }


  private async openProjectFiles(projectPath: string) {
    try {
      const projectFiles = [
        'Dockerfile',
        'algo.py',
        'requirements.txt',
        'algo.js',
        'package.json'
      ]

      const fileChecks = projectFiles.map(async (fileName) => {
        const filePath = path.join(projectPath, fileName)
        const exists = await fs.promises.access(filePath).then(() => true).catch(() => false)
        return { fileName, filePath, exists }
      })

      const fileResults = await Promise.all(fileChecks)

      const openPromises = fileResults
        .filter(file => file.exists)
        .map(file => vscode.window.showTextDocument(vscode.Uri.file(file.filePath), { preview: false }))

      await Promise.all(openPromises)
    } catch (error) {
      console.error('Error opening project files:', error)
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('resolveWebviewView called')

    try {
      this._view = webviewView

      webviewView.webview.options = {
        enableScripts: true
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
            case 'selectProjectFolder': {
              const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Project Folder'
              })

              if (folderUri && folderUri[0]) {
                await this.closeOldProjectTabs()
                await this.openProjectFiles(folderUri[0].fsPath)

                const projectType = await detectProjectType(folderUri[0].fsPath)
                const algorithmFileName = getLanguageTemplates(projectType).algorithmFileName

                webviewView.webview.postMessage({
                  type: 'projectFolder',
                  path: folderUri[0].fsPath,
                  projectType: projectType,
                  algorithmFileName: algorithmFileName
                })
              }
              break
            }
            case 'createNewProjectFolder': {
              const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Parent Directory'
              })

              if (folderUri && folderUri[0]) {
                const projectName = await vscode.window.showInputBox({
                  prompt: 'Enter project folder name',
                  placeHolder: 'new-compute-job',
                  value: 'new-compute-job'
                })

                if (projectName) {
                  // Show language selection dialog
                  const availableLanguages = getAvailableLanguages()
                  const language = await vscode.window.showQuickPick(
                    availableLanguages,
                    {
                      placeHolder: 'Select preferred language',
                      title: 'Choose Language'
                    }
                  )

                  if (language) {
                    const projectPath = path.join(folderUri[0].fsPath, projectName)

                    try {
                      await fs.promises.mkdir(projectPath, { recursive: true })

                      const templates = getLanguageTemplates(language as Language)

                      await fs.promises.writeFile(path.join(projectPath, 'Dockerfile'), templates.dockerfile)
                      await fs.promises.writeFile(path.join(projectPath, templates.dependenciesFileName), templates.dependencies)
                      await fs.promises.writeFile(path.join(projectPath, templates.algorithmFileName), templates.algorithm)

                      const resultsPath = path.join(projectPath, 'results')
                      await fs.promises.mkdir(resultsPath, { recursive: true })

                      await this.closeOldProjectTabs()
                      await this.openProjectFiles(projectPath)

                      webviewView.webview.postMessage({
                        type: 'projectCreated',
                        projectPath: projectPath,
                        algorithmPath: path.join(projectPath, templates.algorithmFileName),
                        resultsPath: resultsPath,
                        language: language
                      })
                    } catch (error) {
                      console.error('Error creating project:', error)
                      vscode.window.showErrorMessage(`Failed to create project: ${error}`)
                    }
                  }
                }
              }
              break
            }
            case 'startComputeJob':
              console.log('Starting compute job with data:', data)
              await vscode.commands.executeCommand(
                'ocean-protocol.startComputeJob',
                data.algorithmPath,
                data.resultsFolderPath,
                data.authToken,
                data.nodeUrl,
                data.datasetPath,
                data.dockerImage,
                data.dockerTag,
                data.environmentId
              )
              break
            case 'stopComputeJob':
              await vscode.commands.executeCommand('ocean-protocol.stopComputeJob', data.authToken)
              break
            case 'copyToClipboard':
              vscode.env.clipboard.writeText(data.text)
              break
            case 'openBrowser':
              const appName = vscode.env?.appName || 'vscode'
              vscode.env.openExternal(
                vscode.Uri.parse(
                  `${data.url}?ide=${appName?.toLowerCase()}&isFreeCompute=${this.config?.isFreeCompute || true}&nodeUrl=${data.nodeUrl}`
                )
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
          #selectedProjectPath {
            margin: 10px 0;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
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
            margin: 5px 0;
          }
          #configureCompute {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            cursor: pointer;
            padding: 8px;
            margin: 5px 0;
            width: 100%;
            font-size: var(--vscode-font-size);
            text-decoration: none;
          }
          #configureCompute:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
          #datasetInput {
            width: 100%; 
            padding: 8px;
          }
          #stopComputeBtn {
            margin: 5px 0;
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
              <div id="selectedProjectPath" class="selectedFile">
                <span class="filePrefix">Selected project folder: </span>
                <span class="filePath">Please create or select a project folder</span>
              </div>
              <div></div>
              <button id="startComputeBtn">Start <strong>FREE</strong> Compute Job</button>
              <button id="stopComputeBtn" style="display: none;">Stop Compute Job</button>
              <div id="errorMessage" class="error-message"></div>
              <button id="createNewProjectBtn">Create New Project Folder</button>

              <button id="selectProjectFolderBtn">Select Project Folder</button>
              <button id="configureCompute">Configure Compute ⚙️</button>
              <input id="datasetInput" placeholder="Dataset URL/IPFS/Arweave/DID" />
          </div>

          <div class="section">
              <div id="setupHeader" class="section-header">
                  <span class="chevron">&#9658;</span>Setup
              </div>
              <div id="setup" class="section-content">
                  <div class="container">

                      <label for="nodeUrlInput">Node URL (including port)</label>
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <input id="nodeUrlInput" placeholder="Enter compute environment ID" value="${this.randomNodeUrl}" style="flex: 1;" />
                        <button id="validateNodeBtn" style="padding: 2px 8px; font-size: 0.75em; width: 50px; height: 30px; flex-shrink: 0; box-sizing: border-box;">Check</button>
                      </div>

                      <div class="environment-section">
                        <label for="environmentSelect">Compute Environment</label>
                        <select id="environmentSelect" class="environment-select">
                          <option value="">Loading environments...</option>
                        </select>
                        <div id="environmentDetails" class="environment-details"></div>
                      </div>

                      <label for="authTokenInput">Auth Token</label>
                      <input id="authTokenInput" type="password" placeholder="Enter your auth token" />
                      
                      <div style="margin: 5px 0; font-size: 0.85em; color: var(--vscode-descriptionForeground); font-style: italic;">
                        *Dockerfile in project root takes priority
                      </div>
                      
                      <label for="dockerImageInput">Docker Image (optional)</label>
                      <input id="dockerImageInput" placeholder="Enter custom Docker image name" />

                      <label for="dockerTagInput">Docker Tag (optional)</label>
                      <input id="dockerTagInput" placeholder="Enter custom Docker tag" />
                  </div>
              </div>
          </div>

          <script>
              const vscode = acquireVsCodeApi();
              let selectedProjectPath = '';
              let selectedAlgorithmPath = '';
              let selectedResultsFolderPath = '';
              let availableEnvironments = [];
              let configResources = null;
              let jobDuration = null;
              let isFreeCompute = true; // Default to free compute


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

              if (document.getElementById('createNewProjectBtn')) {
                  document.getElementById('createNewProjectBtn').addEventListener('click', () => {
                      console.log('Create new project button clicked');
                      vscode.postMessage({ 
                          type: 'createNewProjectFolder'
                      });
                  });
              }

              if (document.getElementById('selectProjectFolderBtn')) {
                  document.getElementById('selectProjectFolderBtn').addEventListener('click', () => {
                      console.log('Select project folder button clicked');
                      vscode.postMessage({
                          type: 'selectProjectFolder' 
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

              // Toggle button visibility
              function showStartButton() {
                  document.getElementById('startComputeBtn').style.display = 'block';
                  document.getElementById('stopComputeBtn').style.display = 'none';
                  // Reset button state
                  document.getElementById('startComputeBtn').disabled = false;
                  document.getElementById('startComputeBtn').style.opacity = '1';
              }

              function showStopButton() {
                  document.getElementById('startComputeBtn').style.display = 'none';
                  document.getElementById('stopComputeBtn').style.display = 'block';
              }

              function disableStartButton() {
                document.getElementById('startComputeBtn').disabled = true;
                document.getElementById('startComputeBtn').style.opacity = '0.8';
              }

              if (document.getElementById('startComputeBtn')) {
                  document.getElementById('startComputeBtn').addEventListener('click', () => {
                      const authToken = document.getElementById('authTokenInput').value;
                      const nodeUrl = document.getElementById('nodeUrlInput').value || "${this.randomNodeUrl}";
                      const dockerImage = document.getElementById('dockerImageInput').value;
                      const dockerTag = document.getElementById('dockerTagInput').value;
                      const errorMessage = document.getElementById('errorMessage');
                      
                      if (!selectedProjectPath) {
                          errorMessage.textContent = 'Please create or select a project folder';
                          errorMessage.style.display = 'block';
                          return;
                      }

                      let algorithmPath = selectedAlgorithmPath;
                      let resultsFolderPath = selectedResultsFolderPath;
                      
                      if (!algorithmPath || !resultsFolderPath) {
                          errorMessage.textContent = 'Project folder must contain an algorithm file and results folder';
                          errorMessage.style.display = 'block';
                          return;
                      }

                      // Clear any previous error
                      errorMessage.style.display = 'none';

                      // Start compute job directly
                      vscode.postMessage({ 
                          type: 'startComputeJob',
                          authToken: authToken,
                          algorithmPath: algorithmPath,
                          resultsFolderPath: resultsFolderPath,
                          nodeUrl: nodeUrl,
                          datasetPath: document.getElementById('datasetInput').value || undefined,
                          dockerImage: dockerImage || undefined,
                          dockerTag: dockerTag || undefined,
                          environmentId: document.getElementById('environmentSelect').value || undefined
                      });
                  });
              }

              if (document.getElementById('configureCompute')) {
                  document.getElementById('configureCompute').addEventListener('click', () => {
                      vscode.postMessage({ 
                          type: 'openBrowser',
                          url: 'https://vscode-extension-config-test-page.vercel.app/',
                          nodeUrl: nodeUrlInput.value || "${this.randomNodeUrl}"
                      });
                  });
              }

              if (document.getElementById('stopComputeBtn')) {
                  document.getElementById('stopComputeBtn').addEventListener('click', () => {
                      const authToken = document.getElementById('authTokenInput').value;
                      vscode.postMessage({ type: 'stopComputeJob', authToken: authToken });
                  });
              }

              async function loadEnvironments() {
                const nodeUrl = nodeUrlInput.value;
                if (!nodeUrl) {
                  disableStartButton();
                  return;
                }

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
                  disableStartButton();
                }
              }

              if (document.getElementById('validateNodeBtn')) {
                  document.getElementById('validateNodeBtn').addEventListener('click', () => {
                      loadEnvironments();
                  });
              }
              
              // Listen for node URL input changes
              if (document.getElementById('nodeUrlInput')) {
                  document.getElementById('nodeUrlInput').addEventListener('input', () => {
                      checkStartButtonState();
                  });
              }
              
              // Disable start button initially until node URL is validated and project is selected
              disableStartButton();
              
              // Load environments on page load
              loadEnvironments();
              
              function checkStartButtonState() {
                  const hasProject = selectedProjectPath && selectedProjectPath.trim() !== '';
                  const hasEnvironments = availableEnvironments && availableEnvironments.length > 0;
                  const nodeUrl = document.getElementById('nodeUrlInput').value;
                  
                  if (hasProject && hasEnvironments && nodeUrl) {
                      document.getElementById('startComputeBtn').disabled = false;
                      document.getElementById('startComputeBtn').style.opacity = '1';
                  } else {
                      document.getElementById('startComputeBtn').disabled = true;
                      document.getElementById('startComputeBtn').style.opacity = '0.8';
                  }
              }

              window.addEventListener('message', event => {
                  const message = event.data;
                  console.log('Received message:', message);
                  
                  switch (message.type) {
                      case 'configUpdate':
                          if (message.config.nodeUrl) {
                              const nodeUrlInput = document.getElementById('nodeUrlInput');
                              if (nodeUrlInput) {
                                  nodeUrlInput.value = message.config.nodeUrl;
                                  loadEnvironments();
                              }
                          }
                          if (message.config.authToken) {
                              const authTokenInput = document.getElementById('authTokenInput');
                              if (authTokenInput) {
                                  authTokenInput.value = message.config.authToken;
                              }
                          }
                          if (message.config.environmentId) {
                            const environmentSelect = document.getElementById('environmentSelect');
                            if (environmentSelect) {
                              environmentSelect.value = message.config.environmentId;
                              // Refresh environment details if an environment is selected
                              if (message.config.environmentId && availableEnvironments.length > 0) {
                                showEnvDetails(message.config.environmentId);
                              }
                            }
                          }
                          if (message.config.resources) {
                            configResources = message.config.resources;
                            jobDuration = message.config.jobDuration;
                            // Refresh environment details if an environment is selected
                            const environmentSelect = document.getElementById('environmentSelect');
                            if (environmentSelect && environmentSelect.value) {
                              showEnvDetails(environmentSelect.value);
                            }
                          }
                          if (message.config.isFreeCompute !== undefined) {
                            isFreeCompute = message.config.isFreeCompute;
                            const startComputeBtn = document.getElementById('startComputeBtn');
                            if (startComputeBtn) {
                              startComputeBtn.innerHTML = message.config.isFreeCompute === true 
                                ? 'Start <strong>FREE</strong> Compute Job'
                                : 'Start <strong>PAID</strong> Compute Job';
                            }
                          }
                          break;
                      case 'projectFolder':
                          selectedProjectPath = message.path;
                          const projectElement = document.getElementById('selectedProjectPath');
                          const projectType = message.projectType;
                          const typeInfo = projectType ? ' (' + projectType + ')' : '';
                          projectElement.innerHTML = '<span class="filePrefix">Selected project folder: </span><span class="filePath">' + message.path + typeInfo + '</span>';
                          
                          selectedAlgorithmPath = message.path + '/' + message.algorithmFileName;
                          selectedResultsFolderPath = message.path + '/results';
                          
                          checkStartButtonState();
                          break;
                      case 'projectCreated':
                          selectedProjectPath = message.projectPath;
                          selectedAlgorithmPath = message.algorithmPath;
                          selectedResultsFolderPath = message.resultsPath;
                          
                          const projectElementCreated = document.getElementById('selectedProjectPath');
                          const languageInfo = message.language ? ' (' + message.language + ')' : '';
                          projectElementCreated.innerHTML = '<span class="filePrefix">Selected project folder: </span><span class="filePath">' + message.projectPath + languageInfo + '</span>';
                          
                          checkStartButtonState();
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
                            disableStartButton();
                            return;
                          }
                          
                          if (!message.environments || message.environments.length === 0) {
                            select.innerHTML = '<option value="">No environments available</option>';
                            select.disabled = true;
                            document.getElementById('environmentDetails').style.display = 'none';
                            disableStartButton();
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
                          
                          checkStartButtonState();

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

                              // Helper function to format resource values
                              function formatResourceValue(amount, resourceId) {
                                  if (resourceId === 'ram' || resourceId === 'disk') {
                                      return Math.round(amount) + ' GB';
                                  }
                                  return amount;
                              }

                              // Helper function to get available value for a resource
                              function getAvailableValue(resourceId, isFreeCompute) {
                                  if (isFreeCompute === false) {
                                      // For paid compute, use paid resources (max value)
                                      const paidResource = selectedEnv.resources.find(pr => pr.id === resourceId);
                                      if (paidResource) {
                                          return formatResourceValue(paidResource.max, resourceId);
                                      }
                                  } else {
                                      // For free compute, use free resources (available amount)
                                      const envResource = selectedEnv.free?.resources.find(fr => fr.id === resourceId);
                                      if (envResource) {
                                          return formatResourceValue(envResource.max - envResource.inUse, resourceId);
                                      }
                                  }
                                  return 'N/A';
                              }

                              // Process resources to show min/max values for paid resources
                              const paidResourceDetails = selectedEnv.resources.map(r => {
                                  const minValue = formatResourceValue(r.min, r.id);
                                  const maxValue = formatResourceValue(r.max, r.id);
                                  return '<p style="margin: 4px 0;"><span class="label">' + r.id.toUpperCase() + ' (Min/Max):</span> ' + minValue + ' / ' + maxValue + '</p>';
                              }).join('');

                              // Process resources for free tier
                              const freeResourceDetails = selectedEnv.free.resources.map(r => {
                                  const maxValue = formatResourceValue(r.max, r.id);
                                  const availableValue = formatResourceValue(r.max - r.inUse, r.id);
                                  return '<p style="margin: 4px 0;"><span class="label">' + r.id.toUpperCase() + ':</span> ' + maxValue + ' / ' + availableValue + '</p>';
                              }).join('');

                              // Combine resource details based on compute type
                              let resourceDetails = '';
                              let resourcesLabel = 'Resources:';
                              
                              if (configResources && configResources.length > 0) {
                                  // Show selected resources in "selected / available" format
                                  resourcesLabel = 'Resources (SELECTED / AVAILABLE):';
                                  resourceDetails = configResources.map(r => {
                                      const selectedValue = formatResourceValue(r.amount, r.id);
                                      const availableValue = getAvailableValue(r.id, isFreeCompute);
                                      
                                      return '<p style="margin: 4px 0;"><span class="label">' + r.id.toUpperCase() + ':</span> ' + selectedValue + ' / ' + availableValue + '</p>';
                                  }).join('');
                                  resourceDetails += '<p style="margin: 4px 0;"><span class="label">Job Duration:</span> ' + (jobDuration || 'N/A') + ' seconds</p>';
                              } else {
                                  // Show resources based on compute type when no specific resources are selected
                                  if (isFreeCompute === false) {
                                      // For paid compute, show paid resources (min/max)
                                      resourcesLabel = 'Resources (MIN / MAX):';
                                      resourceDetails = paidResourceDetails;
                                      resourceDetails += '<p style="margin: 4px 0;"><span class="label">Job Duration:</span> ' + (jobDuration || 'N/A') + ' seconds</p>';
                                  } else {
                                      // For free compute, show free resources (max/available)
                                      resourcesLabel = 'Resources (MAX / AVAILABLE):';
                                      resourceDetails = freeResourceDetails;
                                      resourceDetails += '<p style="margin: 4px 0;"><span class="label">Job Duration:</span> ' + (selectedEnv.free?.maxJobDuration || 'N/A') + ' seconds</p>';
                                  }
                              }

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
                                  '<p><span class="label">' + resourcesLabel + '</span></p>' +
                                  '<div style="margin-left: 8px;">' + 
                                  resourceDetails +
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

                      case 'jobLoading':
                          disableStartButton();
                          break;
                      case 'jobStarted':
                          showStopButton();
                          break;
                      case 'jobStopped':
                          showStartButton();
                          break;
                      case 'jobCompleted':
                          showStartButton();
                          break;
                  }
              });
          </script>
    </body>
    </html>
    `
  }
}
