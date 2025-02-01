import * as vscode from 'vscode';
import { getWebviewContent } from './WebViewContent';
// import * as fs from 'fs';
// import * as path from 'path';
// import * as os from 'os';
// const CONFIG_DIR = path.join(os.homedir(), '.qbraid');
// const CONFIG_FILE = path.join(CONFIG_DIR, 'qbraidrc');
// const API_URL = 'https://api.qbraid.com/api';
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface ChatResponse {
    "content": string,
    "usage": any
}
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private  _view?: vscode.WebviewView;
    private _messages: ChatMessage[] = [];
    private _isInitialized: boolean = false;
    private _apiKey: string | undefined;
    private modelNames: string[] = [];
    private selectedModel: string | null = null;
    private isProcessing: boolean = false;
    private API_URL: string;
    
    constructor(private readonly _extensionUri: vscode.Uri, apiKey: string, API_URL: string) {
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
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,) {
        // console.log('Resolving webview view');
    this._view = webviewView;
    this._isInitialized = true;

    this._view.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri]
    };
    this._view.webview.html = getWebviewContent();
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

    private async handleModelSelection(model: string) {
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
    public async handleUserMessage(message: string, model: string) {
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
                headers: {'api-key': `${this._apiKey}`, 'Content-Type': 'application/json'},
                body:  JSON.stringify({
                    prompt: message,
                    model: model,
                    stream: stream
                })
            };
            // console.log("options: %o",options);
            const response = await fetch(`${this.API_URL}/chat`, options);
            const data: ChatResponse = await response.json() as ChatResponse;
            console.log(`response: ${JSON.stringify(response.statusText)} ${JSON.stringify(data)}`);
            

            // Add assistant response
            this._messages.push({
                role: 'assistant',
                content: data.content
            });
            console.log('Messages after API response:', this._messages); // Debug log
            this._postMessagesToWebview();

        } catch (error) {
            console.error('Error in handleUserMessage:', error);
            this._messages.push({
                role: 'system',
                content: 'Error: Failed to get response from AI model'
            });
            this._postMessagesToWebview();
            vscode.window.showErrorMessage('Failed to send message. Please check your API key and network connection.');
        } finally {
            this.isProcessing = false;
        }
    }
    private _postMessagesToWebview() {
        if (this._view) {
            console.log('Updating webview with messages:', this._messages);
            this._view.webview.postMessage({
                command: 'updateMessages', 
                data: { messages: this._messages }
             });
        } else {
            console.error('Webview is not initialized.');
        }
    }
    

    private _updateWebview() {
        if (this._view) {
            this._view.webview.html = getWebviewContent();
        }
    }

    private async getModels(): Promise<string[]> {
        const modelsAvailable: string[] = [];
        try {
            const options = {method: 'GET', headers: {'api-key': `${this._apiKey}`}};
            
            const response = await fetch(`${this.API_URL}/chat/models`, options);
            const data: any[] = await response.json() as any[];            
            data.forEach((modelInfo: any) => {
                modelsAvailable.push(modelInfo.model);
            });
        } catch (error) {
            console.error('Error getting models defaulting to gpt-4o-mini :', error);
            modelsAvailable.push('gpt-4o-mini');
            vscode.window.showErrorMessage('Failed to fetch available models. Using default model.');
        }
        return modelsAvailable;
    }

//     private _getHtmlForWebview(): string {
//         return `
//             <!DOCTYPE html>
//             <html>
//             <head>
//                 <style>
//                     body { font-family: Arial, sans-serif; padding: 10px; }
//                     .model-selector-container { margin-bottom: 15px; }
//                     .model-selector { 
//                         width: 100%;
//                         padding: 8px;
//                         margin-bottom: 10px;
//                         border-radius: 4px;
//                         border: 1px solid #ddd;
//                     }
//                     .chat-container { 
//                         max-height: 400px; 
//                         overflow-y: auto; 
//                         border: 1px solid #ddd; 
//                         padding: 10px;
//                         margin-bottom: 10px;
//                     }
//                     .user-message { 
//                         background-color: rgb(64, 100, 126); 
//                         color: white;
//                         padding: 8px; 
//                         border-radius: 5px; 
//                         margin: 5px 0; 
//                     }
//                     .assistant-message { 
//                         background-color: rgb(182, 51, 171); 
//                         color: white;
//                         padding: 8px; 
//                         border-radius: 5px; 
//                         margin: 5px 0; 
//                     }
//                     .input-container {
//                         display: flex;
//                         gap: 10px;
//                     }
//                     #messageInput { 
//                         flex-grow: 1;
//                         padding: 8px; 
//                     }
//                     button { 
//                         padding: 8px 16px;
//                         background-color: #007acc;
//                         color: white;
//                         border: none;
//                         border-radius: 4px;
//                         cursor: pointer;
//                     }
//                     button:hover {
//                         background-color: #005999;
//                     }
//                     .system-message {
//                         color: #666;
//                         font-style: italic;
//                         text-align: center;
//                         margin: 10px 0;
//                     }
//                 </style>
//             </head>
//             <body>
//                 <div class="model-selector-container">
//                     <select id="modelSelector" class="model-selector">
//                         <option value="">Select a model...</option>
//                     </select>
//                 </div>
//                 <div class="chat-container" id="chat-container"></div>
//                 <div class="input-container">
//                     <input id="messageInput" type="text" placeholder="Type a message..." disabled />
//                     <button onclick="sendMessage()" id="sendButton" disabled>Send</button>
//                 </div>

//                 <script>
//                     const vscode = acquireVsCodeApi();
//                     let selectedModel = null;

//                      // Initialize the interface
//                     window.addEventListener('message', event => {
//                         const { command, data } = event.data;
                        
//                         switch (command) {
//                             case 'updateModels':
//                                 updateModelSelector(data.models);
//                                 break;
//                             case 'updateMessages':
//                                 updateChatMessages(data.messages);
//                                 break;
//                         }
//                     });

//                     // Request models when page loads
//                     vscode.postMessage({ command: 'getModels' });

//                     function updateModelSelector(models) {
//                         const selector = document.getElementById('modelSelector');
//                         selector.innerHTML = '<option value="">Select a model...</option>';
                        
//                         models.forEach(model => {
//                             const option = document.createElement('option');
//                             option.value = model;
//                             option.textContent = model;
//                             selector.appendChild(option);
//                         });
//                     }

//                     function updateChatMessages(messages) {
//                         const chatContainer = document.getElementById('chat-container');
//                         chatContainer.innerHTML = messages.map(msg =>
//                             '<div class="' + msg.role + '-message"><strong>' + msg.role + ':</strong> ' + msg.content + '</div>'
//                         ).join('');
//                         chatContainer.scrollTop = chatContainer.scrollHeight;
//                     }

//                     // Handle model selection
//                     document.getElementById('modelSelector').addEventListener('change', (e) => {
//                         selectedModel = e.target.value;
//                         const messageInput = document.getElementById('messageInput');
//                         const sendButton = document.getElementById('sendButton');
                        
//                     if (selectedModel) {
//                         messageInput.disabled = false;
//                         sendButton.disabled = false;
                        
//                         // Notify extension about model selection
//                         vscode.postMessage({ 
//                             command: 'selectModel', 
//                             model: selectedModel 
//                         });
                
//                     // Add system message to chat
//                     const chatContainer = document.getElementById('chat-container');
//                     chatContainer.innerHTML = '<div class="system-message"> Selected model: ' + selectedModel + '</div>';
//                         } else {
//                             messageInput.disabled = true;
//                             sendButton.disabled = true;
//                         }
//                     });

//                     function sendMessage() {
//                         const input = document.getElementById('messageInput');
//                         const text = input.value.trim();
                        
//                         if (text && selectedModel) {
//                             vscode.postMessage({ 
//                                 command: 'sendMessage',
//                                 text,
//                                 model: selectedModel
//                             });
//                             input.value = '';
//                         }
//                     }
                    
//                     // Handle Enter key in input
//                     document.getElementById('messageInput').addEventListener('keypress', (e) => {
//                         if (e.key === 'Enter') {
//                             sendMessage();
//                         }
//                     });
//                 </script>
//             </body>
//             </html>
//         `;
//     }
}