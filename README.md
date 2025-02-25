# Ocean Protocol VSCode Extension

This VSCode extension enables you to execute compute-to-data jobs using Ocean Protocol directly from your development environment. The extension automatically detects your active algorithm file and streamlines job submission, monitoring, and results retrieval.

## Features

- **Compute-to-Data**: Run secure compute jobs without downloading raw data.
- **Active File Detection**: Automatically uses your open JavaScript (.js) or Python (.py) file as the compute algorithm.
- **Dataset & Results Integration**: Optionally select a dataset file and specify a results folder.
- **Job Monitoring**: View job status and algorithm logs in the output panel while results are automatically opened upon job completion.

## Prerequisites

- Node.js (version specified in `.nvmrc`)
- VSCode version 1.93.0 or higher
- Git

## Running the Extension Locally

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

## Usage

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

## Development & Contributing

Refer to the project structure and available scripts for local development. Contributions are always welcome—please check our guidelines in the repository.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Contact

For bug reports and feature requests, please open an issue in the GitHub repository.

For general questions about Ocean Protocol, join the [Ocean Protocol Discord](https://discord.gg/TnXjkR5).
