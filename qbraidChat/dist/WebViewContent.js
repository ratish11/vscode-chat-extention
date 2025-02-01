"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .model-selector-container { 
                    padding: 10px;
                }

                .model-selector { 
                    width: 100%;
                    padding: 8px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }

                .chat-container { 
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    margin-bottom: 10px;
                }

                .message {
                    margin-bottom: 15px;
                    max-width: 85%;
                    clear: both;
                }

                .user-message { 
                    background-color: rgb(64, 100, 126); 
                    color: white;
                    padding: 12px; 
                    border-radius: 15px 15px 2px 15px;
                    margin-left: auto;
                    float: right;
                }

                .assistant-message { 
                    background-color: rgb(182, 51, 171); 
                    color: white;
                    padding: 12px; 
                    border-radius: 15px 15px 15px 2px;
                    float: left;
                }

                .system-message {
                    color: #666;
                    font-style: italic;
                    text-align: center;
                    margin: 10px 0;
                    clear: both;
                }

                .input-section {
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                    border-top: 1px solid var(--vscode-widget-border);
                }

                .input-container {
                    display: flex;
                    gap: 5px;
                    max-width: 100%;
                    margin: 0 auto;
                }

                #messageInput { 
                    flex-grow: 1;
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }

                button { 
                    padding: 8px 16px;
                    background-color: #007acc;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                button:hover {
                    background-color: #005999;
                }

                button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }

                /* Clear float after messages */
                .chat-container::after {
                    content: "";
                    clear: both;
                    display: table;
                }
            </style>
        </head>
        <body>
            <div class="model-selector-container">
                <select id="modelSelector" class="model-selector">
                    <option value="">Select a model...</option>
                </select>
            </div>
            <div class="chat-container" id="chat-container"></div>
            <div class="input-container">
                <input id="messageInput" type="text" placeholder="Type a message..." disabled />
                <button onclick="sendMessage()" id="sendButton" disabled>Send</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let selectedModel = null;

                // Initialize the interface
                window.addEventListener('message', event => {
                console.log('Received message in webview:', event.data);
                const message = event.data; // Get the entire message object
                
                switch (message.command) {
                    case 'updateModels':
                        console.log('Updating models:', message.data.models);
                        updateModelSelector(message.data.models);
                        break;
                    case 'updateMessages':
                        console.log('Updating messages:', message.data.messages);
                        updateChatMessages(message.data.messages);
                        break;
                }
            });

                // Request models when page loads
                vscode.postMessage({ command: 'getModels' });

                function updateModelSelector(models) {
                    const selector = document.getElementById('modelSelector');
                    selector.innerHTML = '<option value="">Select a model...</option>';
                    
                    models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        selector.appendChild(option);
                    });
                }

                function updateChatMessages(messages) {
                    console.log('Processing messages in updateChatMessages:', messages); // Add this debug log
                    const chatContainer = document.getElementById('chat-container');
                    chatContainer.innerHTML = messages.map(msg => {
                        if (msg.role === 'system') {
                            return '<div class="message system-message">' + msg.content + '</div>';
                        }
                        return '<div class="message ' + msg.role + '-message">' + msg.content + '</div>';
                    }).join('');
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }

                // Handle model selection
                document.getElementById('modelSelector').addEventListener('change', (e) => {
                    selectedModel = e.target.value;
                    const messageInput = document.getElementById('messageInput');
                    const sendButton = document.getElementById('sendButton');
                    
                    if (selectedModel) {
                        messageInput.disabled = false;
                        sendButton.disabled = false;
                        
                        // Notify extension about model selection
                        vscode.postMessage({ 
                            command: 'selectModel', 
                            model: selectedModel 
                        });
                    } else {
                        messageInput.disabled = true;
                        sendButton.disabled = true;
                    }
                });

                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const text = input.value.trim();
                    
                    if (text && selectedModel) {
                        vscode.postMessage({ 
                            command: 'sendMessage',
                            text,
                            model: selectedModel
                        });
                        input.value = '';
                    }
                }
                
                // Handle Enter key in input
                document.getElementById('messageInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            </script>
        </body>
        </html>
    `;
}
//# sourceMappingURL=WebViewContent.js.map