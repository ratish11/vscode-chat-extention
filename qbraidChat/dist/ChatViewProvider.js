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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class ChatViewProvider {
    _extensionUri;
    _view;
    _messages = [];
    _isInitialized = false;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    async sendMessage(message) {
        // If view isn't initialized, try to show it first
        if (!this._isInitialized) {
            await vscode.commands.executeCommand('workbench.view.extension.chatViewContainer');
            // Wait a bit for the view to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!this._view) {
            console.error('Chat view still not initialized');
            vscode.window.showErrorMessage('Unable to initialize chat view. Please try reopening the chat panel.');
            return;
        }
        try {
            console.log('Processing message:', message);
            this._messages.push({ role: 'user', content: message });
            this._updateWebview();
            const response = await axios_1.default.post('YOUR_API_ENDPOINT', {
                message: message
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_API_KEY'
                }
            });
            this._messages.push({
                role: 'assistant',
                content: response.data.message
            });
            this._updateWebview();
        }
        catch (error) {
            console.error('Error in sendMessage:', error);
            vscode.window.showErrorMessage('Failed to send message');
        }
    }
    resolveWebviewView(webviewView, context, _token) {
        console.log('Resolving webview view');
        this._view = webviewView;
        this._isInitialized = true;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        this._updateWebview();
    }
    _updateWebview() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview();
        }
    }
    _getHtmlForWebview() {
        const messages = this._messages.map(msg => `
            <div class="${msg.role}-message">
                <strong>${msg.role}:</strong> ${msg.content}
            </div>
        `).join('');
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body {
                            padding: 10px;
                        }
                        .user-message {
                            margin: 10px 0;
                            padding: 10px;
                            background-color: #e3f2fd;
                            border-radius: 5px;
                        }
                        .assistant-message {
                            margin: 10px 0;
                            padding: 10px;
                            background-color: #f5f5f5;
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div id="chat-container">
                        ${messages}
                        ${this._messages.length === 0 ? '<p>No messages yet. Start chatting!</p>' : ''}
                    </div>
                </body>
            </html>
        `;
    }
}
exports.ChatViewProvider = ChatViewProvider;
//# sourceMappingURL=ChatViewProvider.js.map