"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));

// src/ChatViewProvider.ts
var vscode = __toESM(require("vscode"));
var ChatViewProvider = class {
  constructor(_extensionUri, apiKey, API_URL2) {
    this._extensionUri = _extensionUri;
    this._apiKey = apiKey;
    this.API_URL = API_URL2;
    this.getModels().then((models) => {
      this.modelNames = models;
      if (this._view) {
        this._view.webview.postMessage({
          command: "updateModels",
          data: { models: this.modelNames }
        });
      }
    });
  }
  _view;
  _messages = [];
  _isInitialized = false;
  _apiKey;
  modelNames = [];
  selectedModel = null;
  isProcessing = false;
  API_URL;
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    this._isInitialized = true;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "getModels":
          webviewView.webview.postMessage({
            command: "updateModels",
            data: { models: this.modelNames }
          });
          break;
        case "selectModel":
          await this.handleModelSelection(message.model);
          break;
        case "sendMessage":
          await this.handleUserMessage(message.text, message.model);
          break;
      }
    });
    this._updateWebview();
  }
  async handleModelSelection(model) {
    this.selectedModel = model;
    this._messages.push({
      role: "system",
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
      vscode.window.showInformationMessage("Please wait for the current message to be processed.");
      return;
    }
    if (!this.selectedModel) {
      vscode.window.showErrorMessage("Please select a model first.");
      return;
    }
    if (!this._apiKey) {
      vscode.window.showErrorMessage("API Key not set. Please provide the API Key to continue.");
      return;
    }
    try {
      this.isProcessing = true;
      this._messages.push({
        role: "user",
        content: message
      });
      this._postMessagesToWebview();
      const stream = false;
      const options = {
        method: "POST",
        headers: { "api-key": `${this._apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: message,
          model,
          stream
        })
      };
      const response = await fetch(`${this.API_URL}/chat`, options);
      console.log(`response: ${JSON.stringify(response.statusText)}`);
      const data = await response.json();
      this._messages.push({
        role: "assistant",
        content: data.content
      });
      this._postMessagesToWebview();
    } catch (error) {
      console.error("Error in handleUserMessage:", error);
      this._messages.push({
        role: "system",
        content: "Error: Failed to get response from AI model"
      });
      this._postMessagesToWebview();
      vscode.window.showErrorMessage("Failed to send message. Please check your API key and network connection.");
    } finally {
      this.isProcessing = false;
    }
  }
  _postMessagesToWebview() {
    if (this._view) {
      this._view.webview.postMessage({ command: "updateMessages", messages: this._messages });
    }
  }
  _updateWebview() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview();
    }
  }
  async getModels() {
    const modelsAvailable = [];
    try {
      const options = { method: "GET", headers: { "api-key": `${this._apiKey}` } };
      const response = await fetch(`${this.API_URL}/chat/models`, options);
      const data = await response.json();
      data.forEach((modelInfo) => {
        modelsAvailable.push(modelInfo.model);
      });
    } catch (error) {
      console.error("Error getting models defaulting to gpt-4o-mini :", error);
      modelsAvailable.push("gpt-4o-mini");
      vscode.window.showErrorMessage("Failed to fetch available models. Using default model.");
    }
    return modelsAvailable;
  }
  _getHtmlForWebview() {
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
                    chatContainer.innerHTML = '<div class="system-message"> Selected model: ' + selectedModel + '</div>';
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
};

// src/extension.ts
var chatViewProvider;
var CONFIG_DIR = path.join(os.homedir(), ".qbraid");
var CONFIG_FILE = path.join(CONFIG_DIR, "qbraidrc");
var API_URL = "https://api.qbraid.com/api";
function readApiKey() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, "utf8");
      const match = content.match(/^api-key\s*=\s*(.+)$/m);
      return match ? match[1].trim() : void 0;
    } catch (error) {
      vscode2.window.showErrorMessage("Error reading API key from qbraidrc.");
    }
  }
  return void 0;
}
async function getOrSetApiKey() {
  let apiKey = readApiKey();
  if (apiKey) {
    return apiKey;
  }
  apiKey = await vscode2.window.showInputBox({
    prompt: "Enter your qBraid API Key:",
    ignoreFocusOut: true,
    password: true
  });
  if (apiKey) {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      const configContent = `[default]
url = ${API_URL}
api-key = ${apiKey}
`;
      fs.writeFileSync(CONFIG_FILE, configContent, { encoding: "utf8", mode: 384 });
      vscode2.window.showInformationMessage("API Key saved successfully!");
    } catch (error) {
      vscode2.window.showErrorMessage("Error saving API key.");
    }
  }
  return apiKey;
}
async function activate(context) {
  console.log("Activating QBraid Chat extension");
  const apiKey = await getOrSetApiKey();
  if (!apiKey) {
    vscode2.window.showErrorMessage("API key is required for qBraid Chat extension.");
    return;
  } else {
    console.log("API key found");
  }
  chatViewProvider = new ChatViewProvider(context.extensionUri, apiKey, API_URL);
  const viewRegistration = vscode2.window.registerWebviewViewProvider(
    "chatView",
    chatViewProvider,
    {
      webviewOptions: { retainContextWhenHidden: true }
    }
  );
  try {
    setTimeout(() => {
      vscode2.commands.executeCommand("chatView.focus");
    }, 100);
  } catch (error) {
    console.error("Failed to focus chat view:", error);
  }
  ;
  const sendMessageCommand = vscode2.commands.registerCommand("qbraid-chat.sendMessage", async () => {
    console.log("Command triggered: qbraid-chat.sendMessage");
    const message = await vscode2.window.showInputBox({
      placeHolder: "Type your message...",
      prompt: "Send a message to the chat"
    });
    if (message) {
      await chatViewProvider.handleUserMessage(message, "gpt-4o-mini");
    }
  });
  context.subscriptions.push(viewRegistration, sendMessageCommand);
  console.log('Congratulations, your extension "qBraid Chat" is now active!');
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
