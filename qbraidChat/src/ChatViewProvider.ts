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

interface ApiCategory {
    category: 'quantum-devices' | 'quantum-jobs' | 'chat';
    endpoint: string;
    method: 'GET' | 'POST';
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


    public async determineMessageCategory(message: string): Promise<ApiCategory> {
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
                headers: {'api-key': `${this._apiKey}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({
                    prompt: categoryPrompt,
                    model: this.selectedModel,
                    stream: false
                })
            };
            const response = await fetch(`${this.API_URL}/chat`, options);
            const data = await response.json() as string;
            console.log('Category determination response:', data);
            
            const responseText = typeof data === 'string' ? data : JSON.stringify(data);

            // Parse the response to determine the category
            if (responseText.toLowerCase().includes('quantum-devices')) {
                return { category: 'quantum-devices', endpoint: '/quantum-devices', method: 'GET' };
            } else if (responseText.toLowerCase().includes('quantum-jobs')) {
                return { category: 'quantum-jobs', endpoint: '/quantum-jobs', method: 'GET' };
            } else {
                return { category: 'chat', endpoint: '/chat', method: 'POST' };
            }
        } catch (error) {
            console.error('Error determining message category:', error);
            return { category: 'chat', endpoint: '/chat', method: 'POST' }; // Default to chat if categorization fails
        }
    }
    
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

                const formattedPrompt = `Answer the following question: ${message}\n\n${
                    previousMessages.length > 0 
                        ? `Here is our history in this chat session:\n${previousMessages}`
                        : ''
                }`;

                const options = {
                    method: category.method,
                    headers: {'api-key': `${this._apiKey}`, 'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        prompt: formattedPrompt,
                        model: model,
                        stream: false
                    })
                };
                
                const response = await fetch(`${this.API_URL}${category.endpoint}`, options);
                
                const data: ChatResponse = await response.json() as ChatResponse;
                // console.log(`response: ${JSON.stringify(response.statusText)} ${JSON.stringify(data)} ${JSON.stringify(formattedPrompt)}`);
                

                // Add assistant response
                this._messages.push({
                    role: 'assistant',
                    content: data.content
                });
            } else{
                // Handle device or job queries
                const options = {
                    method: category.method,
                    headers: {'api-key': `${this._apiKey}`},
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

Level 1 basic are done, now lets do a little text cleaning and disply responses in a human readable manner and add a copy button to the response texts