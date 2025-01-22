# Ocean Protocol VSCode Extension

This VSCode extension enables you to interact with Ocean Protocol directly from your development environment. You can publish assets, run compute jobs, and manage Ocean Protocol operations without leaving VSCode.

## Features

- 🌊 **Ocean Protocol Integration**: Direct integration with Ocean Protocol's core functionality
- 📝 **Asset Publishing**: Publish datasets and algorithms with a simple interface
- 🔍 **Asset Discovery**: View details of published assets
- 💻 **Compute-to-Data**: Start and monitor compute jobs
- 🔄 **P2P Network**: View and interact with Ocean Protocol's P2P network
- ⬇️ **Asset Downloads**: Download assets directly through the extension

## Prerequisites

- Node.js (version specified in `.nvmrc`)
- VSCode version 1.93.0 or higher
- Git

## Running the extension locally

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

- Press F5 to start debugging
- This will open a new VSCode window with the extension loaded

## Usage

### Extension Layout

The extension adds a new Ocean Protocol icon to the activity bar. Clicking it reveals several sections:

1. **Setup**

   - Configure RPC URL
   - Set Ocean Node URL
   - Enter private key for transactions

2. **Get Asset Details**

   - Enter an asset's DID to view its details
   - View metadata and other asset information

3. **Publish Asset**

   - Select a JSON file containing asset metadata
   - Publish new datasets or algorithms to Ocean Protocol

4. **Start Compute Job**

   - Select dataset and algorithm files
   - Configure compute environment
   - Start and monitor compute-to-data jobs

5. **P2P**

   - View your node's ID
   - See connected Ocean peers
   - Monitor P2P network status

6. **Download Asset**
   - Enter asset DID
   - Specify download location
   - Download assets directly through VSCode

### Basic Operations

#### Publishing an Asset

1. Click the Ocean Protocol icon in the activity bar
2. Open the "Publish Asset" section
3. Click "Select Asset File" to choose your metadata JSON file
4. Enter your private key in the setup section
5. Click "Publish Asset"

#### Starting a Compute Job

1. Navigate to the "Start Compute Job" section
2. Select both dataset and algorithm files
3. Enter the compute environment URL
4. Click "Start Compute Job"

#### Downloading Assets

1. Open the "Download Asset" section
2. Enter the asset's DID
3. Specify the download path
4. Click "Download Asset"

## Development

### Project Structure

```
ocean-protocol-vscode/
├── src/
│   ├── extension.ts        # Main extension entry point
│   ├── viewProvider.ts     # WebView UI provider
│   ├── helpers/           # Helper functions
│   │   ├── download.ts
│   │   ├── freeCompute.ts
│   │   ├── oceanNode.ts
│   │   └── publish.ts
│   └── @types/           # TypeScript type definitions
├── test/                 # Test files
└── package.json          # Project configuration
```

### Available Scripts

- `npm run compile`: Compile the TypeScript code
- `npm run watch`: Compile in watch mode
- `npm run lint`: Run ESLint
- `npm run test`: Run tests
- `npm run package`: Create VSIX package for distribution

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contact

For bug reports and feature requests, please open an issue in the GitHub repository.

For general questions about Ocean Protocol, join the [Ocean Protocol Discord](https://discord.gg/TnXjkR5).
