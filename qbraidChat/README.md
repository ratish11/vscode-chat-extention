# QBraid Chat Extension for Visual Studio Code

A Visual Studio Code extension that provides an interactive chat interface with REST API integration.

## Features

- Dedicated chat panel in VS Code
- Real-time message sending and receiving
- REST API integration for message processing
- Clean and intuitive user interface
- Command palette integration for quick access

## Installation

You can install this extension in one of two ways:

1. **Direct Installation**
   ```bash
   code --install-extension qbraid-chat-0.1.0.vsix
   ```

2. **From Source**
   ```bash
   git clone [https://github.com/ratish11/vscode-chat-extention.git]
   cd qbraid-chat
   npm install
   npm run vsce:package
   code --install-extension qbraid-chat-0.1.0.vsix
   ```

## Usage

1. Open the Chat panel from the VS Code activity bar
2. Start chatting by:
   - Using the chat input in the panel
   - Running the "Chat: Send Message" command from the command palette

## Commands

- `Chat: Send Message`: Opens an input box to send a new message

## Configuration

The extension can be configured through VS Code settings:
- API endpoint
- Authentication settings
- UI preferences

## Requirements

- Visual Studio Code version 1.60.0 or higher
- Active internet connection for API communication

## Development

To build and run the extension locally:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the project in VS Code
4. Press F5 to start debugging

## Building

To create a VSIX package:
```bash
npm run vsce:package
```

## License

[Your chosen license]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.