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
    async determineMessageCategory(message) {
        // First ask the AI to categorize the message
        const categoryPrompt = `Given the following user message, determine which API category it belongs to. The message should be categorized into one of these endpoints:
        1. GET /quantum-devices - for questions about quantum devices, hardware, or machine specifications
        2. GET /quantum-jobs - for questions about quantum job status, running jobs, or job history
        3. POST /chat - for general questions, programming help, or quantum computing concepts
    
        User message: "${message}"
        
        Respond with just the endpoint that best matches the intent.`;
        try {
            const options = {
                method: 'POST',
                headers: { 'api-key': `${this._apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: categoryPrompt,
                    model: this.selectedModel,
                    stream: false
                })
            };
            const response = await fetch(`${this.API_URL}/chat`, options);
            const data = await response.json();
            console.log('Category determination response:', data);
            const responseText = typeof data === 'string' ? data : JSON.stringify(data);
            // Parse the response to determine the category
            if (responseText.toLowerCase().includes('quantum-devices')) {
                return { category: 'quantum-devices', endpoint: '/quantum-devices', method: 'GET' };
            }
            else if (responseText.toLowerCase().includes('quantum-jobs')) {
                return { category: 'quantum-jobs', endpoint: '/quantum-jobs', method: 'GET' };
            }
            else {
                return { category: 'chat', endpoint: '/chat', method: 'POST' };
            }
        }
        catch (error) {
            console.error('Error determining message category:', error);
            return { category: 'chat', endpoint: '/chat', method: 'POST' }; // Default to chat if categorization fails
        }
    }
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
        try {
            this.isProcessing = true;
            const category = await this.determineMessageCategory(message);
            console.log('Determined category:', category);
            // Add user message
            this._messages.push({
                role: 'user',
                content: message
            });
            this._postMessagesToWebview();
            // So far it is working, now I will add "Chain of Thoughts" feature to the model
            // It should only consist of messages from the user, assistant.
            // Handle the message based on the category
            if (category.category === 'chat') {
                // Existing chat logic
                const previousMessages = this._messages
                    .slice(0, -1)
                    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                    .map(msg => `${msg.role}: ${msg.content}`)
                    .join('\n');
                const formattedPrompt = `Answer the following question: ${message}\n\n${previousMessages.length > 0
                    ? `Here is our history in this chat session:\n${previousMessages}`
                    : ''}`;
                const options = {
                    method: category.method,
                    headers: { 'api-key': `${this._apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: formattedPrompt,
                        model: model,
                        stream: false
                    })
                };
                const response = await fetch(`${this.API_URL}${category.endpoint}`, options);
                const data = await response.json();
                // console.log(`response: ${JSON.stringify(response.statusText)} ${JSON.stringify(data)} ${JSON.stringify(formattedPrompt)}`);
                // Add assistant response
                this._messages.push({
                    role: 'assistant',
                    content: data.content
                });
            }
            else {
                // Handle device or job queries
                const options = {
                    method: category.method,
                    headers: { 'api-key': `${this._apiKey}` },
                };
                const response = await fetch(`${this.API_URL}${category.endpoint}`, options);
                const data = await response.json();
                // Add formatted response to chat
                this._messages.push({
                    role: 'assistant',
                    content: JSON.stringify(data, null, 2)
                });
            }
            // console.log('Messages after API response:', this._messages); // Debug log
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