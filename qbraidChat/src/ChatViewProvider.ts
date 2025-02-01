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
            console.log('Messages before API response:', this._messages); // Debug log
            this._messages.push({
                role: 'system',
                content: 'Processing your request...'
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
                console.log('Previous messages for context:', previousMessages); // Debug log
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
                console.log('Sending request to API with options for chat'); // Debug log
                const response = await fetch(`${this.API_URL}${category.endpoint}`, options);
                
                const data: ChatResponse = await response.json() as ChatResponse;
                console.log(`response: ${JSON.stringify(response.statusText)} ${JSON.stringify(data)} ${JSON.stringify(formattedPrompt)}`);
                

                // Add assistant response
                this._messages.push({
                    role: 'assistant',
                    content: data.content
                });
            } else{
                // // Handle device or job queries
                console.log('Sending request to API with options for category'); 
                const apiResponse = await this.fetchApiResponse(category);
                this._messages = this._messages.filter(msg => 
                    msg.role !== 'system' || msg.content !== 'Processing your request...'
                );
                const summary = await this.summarizeApiResponse(apiResponse, category.category);
                console.log('Summary from API response:', summary);
                this._messages.push({
                    role: 'assistant',
                    content: summary
                });

                // const options = {
                //     method: category.method,
                //     headers: {'api-key': `${this._apiKey}`},
                // };

                // const response = await fetch(`${this.API_URL}${category.endpoint}`, options);
                // const data = await response.json();

                // // Add formatted response to chat
                // this._messages.push({
                //     role: 'assistant',
                //     content: JSON.stringify(data, null, 2)
                // });
            }
            // console.log('Messages after API response:', this._messages); // Debug log
            this._postMessagesToWebview();

        } catch (error) {
            console.error('Error in handleUserMessage:', error);
            this._messages = this._messages.filter(msg => 
                msg.role !== 'system' || msg.content !== 'Processing your request...'
            );
            this._messages.push({
                role: 'system',
                content: `Error: ${(error as Error).message || 'Failed to process request'}`
            });
            this._postMessagesToWebview();
            vscode.window.showErrorMessage('Failed to process message. Please try again.');
        } finally {
            this.isProcessing = false;
        }
    }

    private async fetchApiResponse(category: ApiCategory): Promise<any> {
        const options = {
            method: category.method,
            headers: {'api-key': `${this._apiKey}`},
        };
        console.log('Sending request to API with options fetchApiResponse'); 
        const response = await fetch(`${this.API_URL}${category.endpoint}`, options);
        return await response.json();
    }
    //this function is very slow and responds very slow
    private async summarizeApiResponse(apiResponse: any, category: string): Promise<string> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 100000);

            const prompt = `Summarize the following ${category} information in a clear, human-readable format:
                ${JSON.stringify(apiResponse)}
                Provide a concise summary highlighting the key information.`;

            const options = {
                method: 'POST',
                headers: {'api-key': `${this._apiKey}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({
                    prompt: prompt,
                    model: this.selectedModel,
                    stream: false
                }),
                signal: controller.signal
            };
            console.log('Sending request to API with options summarizeApiResponse', options); 
            try {
                const response = await fetch(`${this.API_URL}/chat`, options);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`API responded with status: ${response.status}`);
                }

                const data = await response.json() as ChatResponse;
                
                // Format the response with both summary and raw data
                return `Summary:\n${data.content}\n\nRaw Data:\n\`\`\`json\n${JSON.stringify(apiResponse, null, 2)}\n\`\`\``;

            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    console.log('Summarization timed out, falling back to formatted raw data');
                    return this.formatRawResponse(apiResponse, category);
                }
                throw error;
            }
        }catch (error) {
            console.error('Error in summarizeApiResponse:', error);
            return this.formatRawResponse(apiResponse, category);
        }       
        
    }

    private formatRawResponse(apiResponse: any, category: string): string {
        let formattedResponse = '';

        try {
            // Basic formatting based on response type
            if (category === 'quantum-devices') {
                formattedResponse = 'Available Quantum Devices:\n';
                if (Array.isArray(apiResponse)) {
                    formattedResponse += apiResponse.map(device => 
                        `• ${device.name || 'Unnamed Device'}`
                    ).join('\n');
                }
            } else if (category === 'quantum-jobs') {
                formattedResponse = 'Quantum Jobs Status:\n';
                if (Array.isArray(apiResponse)) {
                    formattedResponse += apiResponse.map(job => 
                        `• Job ${job.id || 'Unknown'}: ${job.status || 'Status Unknown'}`
                    ).join('\n');
                }
            } else {
                formattedResponse = 'Response Data:';
            }

            // Always include the raw data for reference
            return `${formattedResponse}\n\nRaw Data:\n\`\`\`json\n${JSON.stringify(apiResponse, null, 2)}\n\`\`\``;

        } catch (error) {
            console.error('Error formatting raw response:', error);
            // If all else fails, just return stringified data
            return `Failed to format response. Raw data:\n\`\`\`json\n${JSON.stringify(apiResponse, null, 2)}\n\`\`\``;
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
}

