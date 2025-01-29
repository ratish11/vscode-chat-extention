rm -rf dist/
mkdir -p dist/
find . -name "*.vsix" -type f -delete
npm install
npm run vsce:package
code --install-extension "qbraid-chat-0.1.0.vsix" --force