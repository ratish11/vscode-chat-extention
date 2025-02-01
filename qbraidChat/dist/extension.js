"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const ChatViewProvider_1 = require("./ChatViewProvider");
let chatViewProvider;
const CONFIG_DIR = path.join(os.homedir(), '.qbraid');
const CONFIG_FILE = path.join(CONFIG_DIR, 'qbraidrc');
const API_URL = 'https://api.qbraid.com/api';
// Function to read the API key from ~/.qbraid/qbraidrc
function readApiKey() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const content = fs.readFileSync(CONFIG_FILE, 'utf8');
            const match = content.match(/^api-key\s*=\s*(.+)$/m);
            return match ? match[1].trim() : undefined;
        }
        catch (error) {
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
async function getOrSetApiKey() {
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
        }
        catch (error) {
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
async function activate(context) {
    console.log('Activating QBraid Chat extension');
    const apiKey = await getOrSetApiKey();
    if (!apiKey) {
        vscode.window.showErrorMessage('API key is required for qBraid Chat extension.');
        return;
    }
    else {
        console.log('API key found');
    }
    chatViewProvider = new ChatViewProvider_1.ChatViewProvider(context.extensionUri, apiKey, API_URL);
    // Register the webview provider
    const viewRegistration = vscode.window.registerWebviewViewProvider('chatView', chatViewProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    });
    // Automatically show the chat window after activation
    try {
        setTimeout(() => {
            vscode.commands.executeCommand('chatView.focus');
        }, 100); // Small delay to ensure UI is ready
    }
    catch (error) {
        console.error('Failed to focus chat view:', error);
    }
    ;
    // Register send message command
    // Register the send message command
    const sendMessageCommand = vscode.commands.registerCommand('qbraid-chat.sendMessage', async () => {
        console.log('Command triggered: qbraid-chat.sendMessage');
        const message = await vscode.window.showInputBox({
            placeHolder: 'Type your message...',
            prompt: 'Send a message to the chat',
        });
        if (message) {
            await chatViewProvider.handleUserMessage(message, "gpt-4o-mini");
        }
    });
    context.subscriptions.push(viewRegistration, sendMessageCommand);
    console.log('Congratulations, your extension "qBraid Chat" is now active!');
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map