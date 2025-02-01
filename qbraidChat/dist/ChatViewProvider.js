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
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const WebViewContent_1 = require("./WebViewContent");
class ChatViewProvider {
    _extensionUri;
    _view;
    _messages = [];
    _isInitialized = false;
    _apiKey;
    modelNames = [];
    selectedModel = null;
    isProcessing = false;
    API_URL;
    constructor(_extensionUri, apiKey, API_URL) {
        this._extensionUri = _extensionUri;
        this._apiKey = apiKey;
        this.API_URL = API_URL;
        this.getModels().then((models) => {
            this.modelNames = models;
            // Send models to webview if it's already initialized
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'updateModels',
                    data: { models: this.modelNames }
                });
            }
        });
    }
    resolveWebviewView(webviewView, context, _token) {
        // console.log('Resolving webview view');
        this._view = webviewView;
        this._isInitialized = true;
        this._view.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        this._view.webview.html = (0, WebViewContent_1.getWebviewContent)();
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'getModels':
                    webviewView.webview.postMessage({
                        command: 'updateModels',
                        data: { models: this.modelNames }
                    });
                    break;
                case 'selectModel':
                    await this.handleModelSelection(message.model);
                    break;
                case 'sendMessage':
                    console.log('Message from webview:', message.text);
                    await this.handleUserMessage(message.text, message.model);
                    break;
            }
        });
        if (this._messages.length > 0) {
            this._postMessagesToWebview();
        }
    }
    async handleModelSelection(model) {
        this.selectedModel = model;
        this._messages.push({
            role: 'system',
            content: `Model selected: ${model}`
        });
        this._postMessagesToWebview();
    }
    // Check if the API key exists, otherwise prompt the user
    // private async initializeApiKey() {
    //     if (!this._apiKey) {
    //         this._apiKey = this.readApiKey();
    //     }
    //     if (!this._apiKey) {
    //         // Prompt the user for the API key
    //         this._apiKey = await vscode.window.showInputBox({
    //             prompt: 'Enter your qBraid API Key:',
    //             ignoreFocusOut: true,
    //             password: true,
    //         });
    //         if (this._apiKey) {
    //             this.saveApiKey(this._apiKey);
    //             vscode.window.showInformationMessage('API Key saved successfully!');
    //         } else {
    //             vscode.window.showErrorMessage('API Key is required to use the chat feature.');
    //         }
    //     }
    // }
    // // Read the API key from ~/.qbraid/qbraidrc
    // private readApiKey(): string | undefined {
    //     if (fs.existsSync(CONFIG_FILE)) {
    //         try {
    //             const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    //             const match = content.match(/^api-key\s*=\s*(.+)$/m);
    //             return match ? match[1].trim() : undefined;
    //         } catch (error) {
    //             vscode.window.showErrorMessage('Error reading API key from qbraidrc.');
    //         }
    //     }
    //     return undefined;
    // }
    // // Save the API key to ~/.qbraid/qbraidrc
    // private saveApiKey(apiKey: string) {
    //     try {
    //         if (!fs.existsSync(CONFIG_DIR)) {
    //             fs.mkdirSync(CONFIG_DIR, { recursive: true });
    //         }
    //         const configContent = `[default]\nurl = ${API_URL}\napi-key = ${apiKey}\n`;
    //         fs.writeFileSync(CONFIG_FILE, configContent, { encoding: 'utf8', mode: 0o600 });
    //     } catch (error) {
    //         vscode.window.showErrorMessage('Error saving API key.');
    //     }
    // }
    async handleUserMessage(message, model) {
        if (this.isProcessing) {
            vscode.window.showInformationMessage('Please wait for the current message to be processed.');
            return;
        }
        if (!this.selectedModel) {
            vscode.window.showErrorMessage('Please select a model first.');
            return;
        }
        if (!this._apiKey) {
            vscode.window.showErrorMessage('API Key not set. Please provide the API Key to continue.');
            return;
        }
        //TODO
        //If this.modelSelected is not same is as the model passed in, load the chat history and send it to the LLM 
        try {
            this.isProcessing = true;
            // Add user message
            this._messages.push({
                role: 'user',
                content: message
            });
            this._postMessagesToWebview();
            console.log('Messages after user input:', this._messages);
            // Make API call
            const stream = false;
            const options = {
                method: 'POST',
                headers: { 'api-key': `${this._apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: message,
                    model: model,
                    stream: stream
                })
            };
            // console.log("options: %o",options);
            const response = await fetch(`${this.API_URL}/chat`, options);
            const data = await response.json();
            console.log(`response: ${JSON.stringify(response.statusText)} ${JSON.stringify(data)}`);
            // Add assistant response
            this._messages.push({
                role: 'assistant',
                content: data.content
            });
            console.log('Messages after API response:', this._messages); // Debug log
            this._postMessagesToWebview();
        }
        catch (error) {
            console.error('Error in handleUserMessage:', error);
            this._messages.push({
                role: 'system',
                content: 'Error: Failed to get response from AI model'
            });
            this._postMessagesToWebview();
            vscode.window.showErrorMessage('Failed to send message. Please check your API key and network connection.');
        }
        finally {
            this.isProcessing = false;
        }
    }
    _postMessagesToWebview() {
        if (this._view) {
            console.log('Updating webview with messages:', this._messages);
            this._view.webview.postMessage({
                command: 'updateMessages',
                data: { messages: this._messages }
            });
        }
        else {
            console.error('Webview is not initialized.');
        }
    }
    _updateWebview() {
        if (this._view) {
            this._view.webview.html = (0, WebViewContent_1.getWebviewContent)();
        }
    }
    async getModels() {
        const modelsAvailable = [];
        try {
            const options = { method: 'GET', headers: { 'api-key': `${this._apiKey}` } };
            const response = await fetch(`${this.API_URL}/chat/models`, options);
            const data = await response.json();
            data.forEach((modelInfo) => {
                modelsAvailable.push(modelInfo.model);
            });
        }
        catch (error) {
            console.error('Error getting models defaulting to gpt-4o-mini :', error);
            modelsAvailable.push('gpt-4o-mini');
            vscode.window.showErrorMessage('Failed to fetch available models. Using default model.');
        }
        return modelsAvailable;
    }
}
exports.ChatViewProvider = ChatViewProvider;
//# sourceMappingURL=ChatViewProvider.js.map