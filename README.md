# BaseFlow

A **visual programming language based on flowcharts**, implemented as a Progressive Web App.

## Description

BaseFlow is a visual programming environment that lets you create programs by drawing flowcharts on an interactive canvas — no textual code required. The application is entirely client-side and runs directly in the browser, even offline thanks to its Service Worker.

Users can insert nodes of various types (Input, Output, Assignment, Condition, Loop), connect them with arrows, and build program logic visually. The flowchart can be executed step-by-step or all at once via an interactive console, or exported to Python code to ease the transition toward textual programming.

Open-source project by **Matteo Artifoni** and **Ismail Barakat**.

## Try it / Download

**[Try BaseFlow online](https://ismailbarakat.dev/baseflow/)** — no install needed, runs directly in the browser.

Prefer a native app? Desktop (Electron) and Android (Capacitor) builds are available from the [v0.2.0 release](https://github.com/proismamaster/BaseFlow/releases/tag/v0.2.0):

| Platform | Download |
|---|---|
| Windows | [BaseFlow-0.2.0-setup-x64.exe](https://github.com/proismamaster/BaseFlow/releases/download/v0.2.0/BaseFlow-0.2.0-setup-x64.exe) |
| macOS | [BaseFlow-0.2.0-x64.dmg](https://github.com/proismamaster/BaseFlow/releases/download/v0.2.0/BaseFlow-0.2.0-x64.dmg) |
| Linux | [BaseFlow-0.2.0-x86_64.AppImage](https://github.com/proismamaster/BaseFlow/releases/download/v0.2.0/BaseFlow-0.2.0-x86_64.AppImage) |
| Android | [BaseFlow-0.2.0-android-debug.apk](https://github.com/proismamaster/BaseFlow/releases/download/v0.2.0/BaseFlow-0.2.0-android-debug.apk) (debug build) |

None of the desktop/mobile builds are code-signed yet, so Windows SmartScreen, macOS Gatekeeper and Android will warn about an unrecognized app on first launch — see [BUILD.md](BUILD.md) for details.

## Goals

- Provide a **visual programming environment** accessible to beginners
- Support **fundamental programming concepts**: variables, I/O, conditionals, loops
- Enable **direct execution** of flowcharts in the browser
- Facilitate the learning of **textual programming** via Python export
- Be an **installable, offline-capable Progressive Web App**
- Serve as an **open-source educational tool**

## Key Features

### Interactive Canvas
- **HTML5 Canvas** with adaptive resizing based on content
- Predefined **Start** (green) and **End** (red) nodes
- **Automatic arrow connections** between nodes
- **Node insertion** by clicking on existing arrows, with automatic position calculation

### Node Types
- **Input** and **Output/Print**: user interaction
- **Assign**: variable declaration and modification
- **If**: conditional branching with true/false paths
- **While, For, Do-While**: iterative structures

### Variable Management
- **Sidebar** for declaring variables with name, type (Integer, Float, String), and initial value
- **Real-time validation** with inline error messages
- Save and load alongside the flowchart

### Execution
- **Interactive console** with Execute, Step, Reset, Clear buttons
- **User input prompts** during execution for Input nodes
- **Error messages** for undeclared variables, invalid syntax

### Python Export
- **Automatic translation** of the flowchart into Python code
- Support for input/output, assignments, if/else conditions
- Option to copy to clipboard or download as `.py` file

### PWA & Persistence
- **Service Worker** for offline functionality
- **Manifest** for standalone app installation
- **Save** to JSON file and **load** from file
- Unsaved changes warning to prevent data loss

### Guided Tutorial
- **Shepherd.js** for interactive tours of the interface, node editing, and console

## Technologies

| Category | Technology |
|---|---|
| **Languages** | HTML5, CSS3, JavaScript (ES6+) |
| **Canvas** | Canvas 2D API for node and arrow rendering |
| **Library** | Shepherd.js 14.5 (guided tutorial) |
| **File APIs** | FileReader (loading), File System Access API (saving) |
| **PWA** | Service Worker, Web App Manifest |
| **Other** | Fetch API (GitHub contributors), Blob/URL.createObjectURL (download), Clipboard API |

## Project Structure

```
BaseFlow/
├── index.html                   # Main interface
├── style.css                    # Complete stylesheet
├── script.js                    # Canvas, nodes, arrows, UI logic
├── sw.js                        # PWA Service Worker
├── manifest.json                # PWA manifest
├── package.json                 # Shepherd.js dependency
├── img/
│   ├── icon.png                 # PWA icon (512x512)
│   └── logoBaseFlow.png         # Toolbar logo
└── js/
    ├── execute.js               # Flowchart execution engine
    ├── pythonTranslation.js     # Flowchart → Python translator
    ├── saveOpen.js              # File save/load
    └── tutorial.js              # Shepherd.js tutorials
```

## Future Improvements

- **Full loop integration**: complete While, For, and Do-While support in the visual interface
- **Drag & Drop** to reposition nodes on the canvas
- **Undo/Redo** for action history
- **Multi-language export**: JavaScript, C++, Java
- **Visual debugger**: step-through with current node highlighting on the canvas
- **Cloud backend** for saving and sharing flowcharts
- **Real-time collaboration** (multi-user)
- **Dark mode** and customizable themes
- **Internationalization** (i18n)
- **Autocompletion** and suggestions in the node editor
- **Automated tests** for validation
