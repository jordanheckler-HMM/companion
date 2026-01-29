import { Command } from '@tauri-apps/plugin-shell'

export interface OllamaModelInfo {
    name: string
    size: number
    digest: string
    modified_at: string
}

export class OllamaService {
    /**
     * Check if Ollama is installed by trying to run 'ollama --version'
     */
    public static async isInstalled(): Promise<boolean> {
        try {
            const command = Command.create('ollama', ['--version'])
            const output = await command.execute()
            return output.code === 0
        } catch (e) {
            return false
        }
    }

    /**
     * Get platform-specific installation command/url
     */
    public static getInstallationInfo(): { type: 'script' | 'download', value: string } {
        const platform = window.navigator.platform.toLowerCase()

        if (platform.includes('mac')) {
            return {
                type: 'script',
                value: 'curl -fsSL https://ollama.com/install.sh | sh'
            }
        } else if (platform.includes('win')) {
            return {
                type: 'download',
                value: 'https://ollama.com/download/OllamaSetup.exe'
            }
        } else {
            // Linux
            return {
                type: 'script',
                value: 'curl -fsSL https://ollama.com/install.sh | sh'
            }
        }
    }

    /**
     * Run installation script (macOS/Linux only for scripts)
     */
    public static async install(onStatus: (status: string) => void): Promise<boolean> {
        const info = this.getInstallationInfo()

        if (info.type === 'download') {
            onStatus('Opening download page...')
            // const { open } = await import('@tauri-apps/plugin-shell')
            // Special case for windows - open browser
            // In a real production app we might download it, but for simplicity:
            // await open(info.value)
            return false // Let UI handle manual download
        }

        try {
            onStatus('Beginning installation...')
            const command = Command.create('sh', ['-c', info.value])

            command.stdout.on('data', (line) => {
                if (line.includes('Installing')) onStatus('Installing Ollama...')
                if (line.includes('Downloading')) onStatus('Downloading components...')
            })

            const output = await command.execute()
            onStatus(output.code === 0 ? 'Installation complete!' : 'Installation failed.')
            return output.code === 0
        } catch (e) {
            console.error('Installation failed:', e)
            onStatus('Installation failed: ' + (e as Error).message)
            return false
        }
    }

    /**
     * Download a model via Ollama CLI
     */
    public static async downloadModel(
        name: string,
        onProgress?: (progress: number) => void
    ): Promise<boolean> {
        try {
            const command = Command.create('ollama', ['pull', name])

            command.stdout.on('data', (line) => {
                // Simple progress parsing if Ollama outputs it in a predictable way
                if (line.includes('%')) {
                    const match = line.match(/(\d+)%/)
                    if (match && onProgress) onProgress(parseInt(match[1]))
                }
            })

            const output = await command.execute()
            return output.code === 0
        } catch (e) {
            console.error(`Failed to download model ${name}:`, e)
            return false
        }
    }

    /**
     * Delete a model
     */
    public static async deleteModel(name: string): Promise<boolean> {
        try {
            const command = Command.create('ollama', ['rm', name])
            const output = await command.execute()
            return output.code === 0
        } catch (e) {
            return false
        }
    }
}
