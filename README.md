# Ocean Protocol VSCode Extension

Run compute jobs on Ocean Protocol directly from VS Code. The extension automatically detects your active algorithm file and streamlines job submission, monitoring, and results retrieval. Simply open a python or javascript file and click **Start Compute Job**.

![Ocean Protocol VSCode Extension](./screenshots/main-screenshot.png)

## Features

### 🚀 One-Click Compute Jobs

Select your algorithm, choose a dataset, and run compute jobs with a single click.

### 📊 Real-Time Monitoring

Track job progress and view algorithm logs directly in VS Code.

### 📁 Automatic Results Handling

Results are automatically saved and opened when your job completes.

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open the Ocean Protocol panel from the activity bar
3. Configure your compute settings:
   - Node URL (pre-filled with default Ocean compute node)
   - Optional private key for your wallet
4. Select your files:
   - Algorithm file (JS or Python)
   - Optional dataset file (JSON)
   - Results folder location
5. Click **Start Compute Job**
6. Monitor the job status and logs in the output panel
7. Once completed, the results file will automatically open in VSCode

### Requirements

VS Code 1.96.0 or higher

### Extension Layout

The extension adds a dedicated Ocean Protocol section to the activity bar. Here you can:

- Configure compute settings (Ocean Node URL, Private Key).
- Optionally select a dataset file.
- Choose a folder to store compute results.
- Start a compute job with the current algorithm file automatically detected.

### Starting a Compute Job

1. Navigate to the "Start Compute Job" section.
2. Ensure your active file is either a JavaScript or Python algorithm.
3. Optionally select a dataset file.
4. Choose a folder for saving results.
5. Click **Start Compute Job**.
6. Monitor the job status and logs in the output panel.
7. Once completed, the results file will automatically open in VSCode.

## Optional Setup

- Custom Compute Node: Enter your own node URL or use the default Ocean Protocol node
- Wallet Integration: Use auto-generated wallet or enter private key for your own wallet
- Custom Docker Images. If you need a custom environment with your own dependencies installed, you can use a custom docker image. Default is oceanprotocol/algo_dockers (Python) or node (JavaScript)
- Docker Tags: Specify version tags for your docker image (like python-branin or latest)
- Algorithm: The vscode extension automatically detects open JavaScript or Python files. Or alternatively you can specify the algorithm file manually here.
- Dataset: Optional JSON file for input data
- Results Folder: Where computation results will be saved

![Ocean Protocol VSCode Extension](./screenshots/setup-screenshot.png)

## Development & Contributing

Refer to the project structure and available scripts for local development. Contributions are always welcome—please check our guidelines in the repository.

### Prerequisites

- Node.js (version specified in `.nvmrc`)
- VSCode version 1.93.0 or higher
- Git

### Running the Extension Locally

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/ocean-protocol-vscode
   cd ocean-protocol-vscode
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run compile
   ```

4. Open in VSCode:
   - Press F5 to start debugging. This will open a new VSCode window with the extension loaded.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Contact

For bug reports and feature requests, please open an issue in the GitHub repository.

For general questions about Ocean Protocol, join the [Ocean Protocol Discord](https://discord.gg/TnXjkR5).
