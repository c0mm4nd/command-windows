# CommandWin

CommandWin is a desktop opeating system copilot based on multi-modal large language model, supporting all-platforms which have application window.

Inspired by [SOC](https://github.com/OthersideAI/self-operating-computer) but written in Electron with Javascript, 

Status:
- Actively in development and experimental
- Issues and Pull requests are welcomed!


## Features

Preview:

> Help me create a Google doc and write the definition of Blockchain on that

[![CommandWin Test Video](https://img.youtube.com/vi/0nnb4PhPv4k/0.jpg)](https://www.youtube.com/watch?v=0nnb4PhPv4k)

- A digital assistant rather than just software
- Use multi-modal perception to help you operate your computer
- Step by step notification showing

TODO:
- More device information to LLM
- Better chat content
- Interactive opeations
- Shortcuts

## How to use

While an official release is not yet available due to the experimental status, you can still try out this tool by cloning the repository and then running on your system.

```powershell
git clone https://github.com/c0mm4nd/command-win
cd command-win
npm install
cp .env.example .env
code .env
npm run start
```
