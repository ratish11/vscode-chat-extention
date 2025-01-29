import * as vscode from 'vscode';
import axios from 'axios';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _messages: Array<{role: string, content: string}> = [];
    private _isInitialized: boolean = false;
    
    constructor(private readonly _extensionUri: vscode.Uri) {}

    public async sendMessage(message: string) {
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

            const response = await axios.post('YOUR_API_ENDPOINT', {
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
        } catch (error) {
            console.error('Error in sendMessage:', error);
            vscode.window.showErrorMessage('Failed to send message');
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('Resolving webview view');
        this._view = webviewView;
        this._isInitialized = true;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this._updateWebview();
    }

    private _updateWebview() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview();
        }
    }

    private _getHtmlForWebview() {
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