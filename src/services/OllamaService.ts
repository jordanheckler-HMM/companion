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
            const command = Command.create('ollama-version')
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
        // ... (Keep existing platform logic if needed for UI info, but we won't execute it)
        return {
            type: 'download',
            value: 'https://ollama.com/download'
        }
    }

    /**
     * Run installation script (DISABLED for security)
     */
    public static async install(onStatus: (status: string) => void): Promise<boolean> {
        onStatus('Automatic installation has been disabled for security.')
        onStatus('Please download Ollama manually from ollama.com')

        // Open browser (if we had the open tool imported, but letting UI handle it is safer)
        return false
    }

    /**
     * Download a model via Ollama CLI
     */
    public static async downloadModel(
        name: string,
        onProgress?: (progress: number) => void
    ): Promise<boolean> {
        try {
            const command = Command.create('ollama-pull', [name])

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
            const command = Command.create('ollama-rm', [name])
            const output = await command.execute()
            return output.code === 0
        } catch (e) {
            return false
        }
    }
}
