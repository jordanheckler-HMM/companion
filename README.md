# Companion

Companion is a desktop AI assistant built with Tauri, React, and TypeScript.

## Installation

This section is for people installing the app from a prebuilt release (no coding setup required).

### 1. Download the app

1. Open the Releases page: [GitHub Releases](https://github.com/jordanheckler-HMM/companion/releases)
2. Open the latest release.
3. Under **Assets**, download the file for your operating system.

### 2. Install on macOS

Requirements: macOS 10.13 or newer.

1. Download the macOS installer asset (usually a `.dmg`).
2. Open the downloaded file.
3. Drag **Companion** into the **Applications** folder.
4. Open **Applications** and launch **Companion**.

If macOS says the app cannot be opened because it is from an unidentified developer:

1. In **Applications**, right-click **Companion** and click **Open**.
2. Click **Open** again in the prompt.
3. If needed, go to **System Settings -> Privacy & Security** and click **Open Anyway**.

### 3. Install on Windows

1. Download the Windows installer asset (usually `.msi` or `.exe`).
2. Double-click the installer.
3. Follow the installation steps.
4. Launch **Companion** from the Start menu.

If Windows SmartScreen warns you:

1. Click **More info**.
2. Click **Run anyway**.

## First Launch Setup

1. Open **Settings** in Companion.
2. Choose an AI mode:
   - **Local mode**: Uses Ollama running on your machine.
   - **Cloud mode**: Uses OpenAI, Anthropic, or Google APIs.
3. If using cloud mode, paste your API key in Settings.
4. If using local mode, install Ollama from [ollama.com](https://ollama.com/) and keep it running.

## Updating

1. Download the newest release from [GitHub Releases](https://github.com/jordanheckler-HMM/companion/releases).
2. Install it the same way as above.
3. Your existing settings should remain in place.

## Developer Setup

If you want to run from source:

1. Install Node.js 18+.
2. Install Rust.
3. Clone this repository.
4. Run:

```bash
npm install
npm run tauri dev
```

## Tech Stack

- Tauri v2
- React 18
- TypeScript
- Zustand

## License

MIT
