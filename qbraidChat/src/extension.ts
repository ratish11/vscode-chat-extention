// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ChatViewProvider } from './ChatViewProvider';
let chatViewProvider: ChatViewProvider;

const CONFIG_DIR = path.join(os.homedir(), '.qbraid');
const CONFIG_FILE = path.join(CONFIG_DIR, 'qbraidrc');
const API_URL = 'https://api.qbraid.com/api';

// Function to read the API key from ~/.qbraid/qbraidrc
function readApiKey(): string | undefined {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const content = fs.readFileSync(CONFIG_FILE, 'utf8');
            const match = content.match(/^api-key\s*=\s*(.+)$/m);
            return match ? match[1].trim() : undefined;
        } catch (error) {
            vscode.window.showErrorMessage('Error reading API key from qbraidrc.');
        }
    }
    return undefined;
}

/**
 * If the API key is saved in the config `.qbraid/qbraidrc` file, return it. Otherwise, prompt the user to enter it.
 * 
 * @returns The API key from the config file, or undefined if it doesn't exist
 */
async function getOrSetApiKey(): Promise<string | undefined> {
    let apiKey = readApiKey();
    if (apiKey) {
        return apiKey;
    }

    // Ask for API key if not found
    apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your qBraid API Key:',
        ignoreFocusOut: true,
        password: true,
    });

    if (apiKey) {
        try {
            if (!fs.existsSync(CONFIG_DIR)) {
                fs.mkdirSync(CONFIG_DIR, { recursive: true });
            }
            const configContent = `[default]\nurl = ${API_URL}\napi-key = ${apiKey}\n`;
            fs.writeFileSync(CONFIG_FILE, configContent, { encoding: 'utf8', mode: 0o600 });
            vscode.window.showInformationMessage('API Key saved successfully!');
        } catch (error) {
            vscode.window.showErrorMessage('Error saving API key.');
        }
    }

    return apiKey;
}
// async function getOrSetApiKey(): Promise<string | undefined> {
//     // Check if the config file exists
//     if (fs.existsSync(CONFIG_FILE)) {
//         try {
//             // Read and return the API key
//             const apiKey = fs.readFileSync(CONFIG_FILE, 'utf8').trim();
//             if (apiKey) {
//                 return apiKey;
//             }
//         } catch (error) {
//             vscode.window.showErrorMessage('Error reading API key from qbraidrc.');
//         }
//     }

//     // If the file doesn't exist or is empty, ask for a new API key
//     const apiKey = await vscode.window.showInputBox({
//         prompt: 'Enter your qBraid API Key:',
//         ignoreFocusOut: true,
//         password: true,
//     });

//     if (apiKey) {
//         try {
//             // Ensure the config directory exists
//             if (!fs.existsSync(CONFIG_DIR)) {
//                 fs.mkdirSync(CONFIG_DIR, { recursive: true });
//             }
//             // Save API key to file
//             fs.writeFileSync(CONFIG_FILE, apiKey, { encoding: 'utf8', mode: 0o600 });
//             vscode.window.showInformationMessage('API Key saved successfully!');
//         } catch (error) {
//             vscode.window.showErrorMessage('Error saving API key.');
//         }
//     }

//     return apiKey;
// }

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Activating QBraid Chat extension'); 
	chatViewProvider  = new ChatViewProvider(context.extensionUri);

	// Register the webview provider
    const viewRegistration = vscode.window.registerWebviewViewProvider(
        'chatView',
        chatViewProvider,
        {
            webviewOptions: { retainContextWhenHidden: true }
        }
    );


	// Register send message command
    const sendMessageCommand = vscode.commands.registerCommand(
        'qbraid-chat.sendMessage',
        async () => {
            console.log('Command triggered: qbraid-chat.sendMessage');
            
            // Fetch API key when extension activates
            const apiKey = await getOrSetApiKey();
            if (!apiKey) {
                vscode.window.showErrorMessage('API key is required for qBraid Chat extension.');
                return;
            }else {
                console.log('API key found');
            }
            // First ensure the chat view is visible
            try {
                await vscode.commands.executeCommand('chatView.focus');
                
                const message = await vscode.window.showInputBox({
                    placeHolder: 'Type your message...',
                    prompt: 'Send a message to the chat'
                });

                if (message) {
                    await chatViewProvider.sendMessage(message);
                }
            } catch (error) {
                console.error('Error in command execution:', error);
                vscode.window.showErrorMessage('Failed to initialize chat view');
            }
        }
    );

    context.subscriptions.push(viewRegistration, sendMessageCommand);

	console.log('Congratulations, your extension "qBraid Chat" is now active!');
}

// This method is called when your extension is deactivated
export function deactivate() {}
