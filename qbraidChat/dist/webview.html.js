"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 10px; }
                .model-selector-container { margin-bottom: 15px; }
                .model-selector { 
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 10px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
                .chat-container { 
                    max-height: 400px; 
                    overflow-y: auto; 
                    border: 1px solid #ddd; 
                    padding: 10px;
                    margin-bottom: 10px;
                }
                .user-message { 
                    background-color: rgb(64, 100, 126); 
                    color: white;
                    padding: 8px; 
                    border-radius: 5px; 
                    margin: 5px 0; 
                }
                .assistant-message { 
                    background-color: rgb(182, 51, 171); 
                    color: white;
                    padding: 8px; 
                    border-radius: 5px; 
                    margin: 5px 0; 
                }
                .input-container {
                    display: flex;
                    gap: 10px;
                }
                #messageInput { 
                    flex-grow: 1;
                    padding: 8px; 
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
                .system-message {
                    color: #666;
                    font-style: italic;
                    text-align: center;
                    margin: 10px 0;
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
                    const { command, data } = event.data;
                    
                    switch (command) {
                        case 'updateModels':
                            updateModelSelector(data.models);
                            break;
                        case 'updateMessages':
                            updateChatMessages(data.messages);
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
                    const chatContainer = document.getElementById('chat-container');
                    chatContainer.innerHTML = messages.map(msg =>
                        '<div class="' + msg.role + '-message"><strong>' + msg.role + ':</strong> ' + msg.content + '</div>'
                    ).join('');
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
                
                        // Add system message to chat
                        const chatContainer = document.getElementById('chat-container');
                        chatContainer.innerHTML = '<div class="system-message">Selected model: ' + selectedModel + '</div>';
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
//# sourceMappingURL=webview.html.js.map