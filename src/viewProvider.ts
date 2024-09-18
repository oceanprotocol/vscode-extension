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
          vscode.commands.executeCommand('ocean-protocol.searchAssets')
          break
        case 'getAssetDetails':
          vscode.commands.executeCommand('ocean-protocol.getAssetDetails')
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
            </head>
            <body>
                <button id="searchAssetsBtn">Search Assets</button>
                <button id="getAssetDetailsBtn">Get Asset Details</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('searchAssetsBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'searchAssets' });
                    });
                    document.getElementById('getAssetDetailsBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'getAssetDetails' });
                    });
                </script>
            </body>
            </html>
        `
  }
}
