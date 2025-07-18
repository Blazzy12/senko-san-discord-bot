# Senko San Discord Bot

A Discord bot built with Node.js and Discord.js.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- A Discord application and bot token

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd senko-san-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm install better-sqlite3
   ```

3. **Configure the bot**
   - Rename `config.json.template` to `config.json`
   - Fill in your bot configuration:
    ```json
    {
        "development": true, // Will use instant deployment and not global
        "token": "Bot-Token",
        "clientId": "Application-Id",
        "guildId": "Guild-Id"
    }
    ```

## ⚙️ Setup

### Deploy Commands
```bash
node ./deploy-commands.js
```

### Launch the Bot
```bash
node .
# or
node ./index.js
```

## 🛠️ Database

This bot uses SQLite3 for data storage. The `better-sqlite3` package is required and will be installed automatically with the dependencies.

## 📝 Development

### Linting (Recommended)

For better code quality, install the ESLint extension:
- [ESLint for VS Code](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

If you encounter linting issues, install the required ESLint packages:
```bash
npm install --save-dev eslint @eslint/js
```

## 📁 Project Structure

```
📦 senko-san-discord-bot
├─ LICENSE
├─ README.md
├─ commands
│  ├─ configuration
│  │  └─ configuration.js
│  ├─ fun
│  ├─ moderation
│  │  ├─ ban.js
│  │  ├─ jwarnsystem.js
│  │  ├─ kick.js
│  │  ├─ lockdown.js
│  │  ├─ mute.js
│  │  ├─ purge.js
│  │  └─ warnsystem.js
│  └─ utility
│     ├─ avatar.js
│     ├─ ping.js
│     ├─ help.js
│     └─ serverinfo.js
├─ config.json.template
├─ deploy-commands.js
├─ eslint.config.js
├─ events
│  ├─ interactionCreate.js
│  ├─ messageCreate.js
│  ├─ ready.js
│  └─ selectCreate.js
├─ index.js
└─ package.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the GPL-2.0 License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Made with ❤️ for the Discord community