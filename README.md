# Ocean Protocol VSCode Extension

This VSCode extension enables you to interact with Ocean Protocol directly from your development environment. You can run compute jobs and test algorithms without leaving VSCode.

## Features

- 🌊 **Ocean Protocol Integration**: Direct integration with Ocean Protocol's core functionality
- 💻 **Compute-to-Data**: Start and monitor compute jobs using JavaScript or Python algorithms
- 🔄 **Active File Integration**: Automatically detects and uses currently open .js or .py files as algorithms
- 📁 **Results Management**: Specify output locations and view computation results directly in VSCode

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

   - Optional: Configure RPC URL, or use the default.
   - Optional: Set Ocean Node URL, or use the default.
   - Optional: Enter private key for transactions, or use the default.

2. **Start Compute Job**
   - Select algorithm file (automatically detects open .js or .py files)
   - Configure compute environment
   - Select results folder location
   - Start and monitor compute-to-data jobs

### Basic Operations

#### Starting a Compute Job

1. Navigate to the "Start Compute Job" section
2. Your currently open JavaScript or Python file will be automatically selected as the algorithm
3. Select a results folder for computation output
4. Enter the compute environment URL
5. Click "Start Compute Job"

## Development

### Project Structure

```
ocean-protocol-vscode/
├── src/
│   ├── extension.ts        # Main extension entry point
│   ├── viewProvider.ts     # WebView UI provider
│   └── helpers/           # Helper functions
│       └── compute.ts     # Compute job functionality
├── test/                  # Test files
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
