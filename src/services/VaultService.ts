import { exists, mkdir, writeTextFile, readTextFile, readDir } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'
import { useStore } from '@/store'

export interface VaultFile {
    name: string
    path: string
    isDirectory: boolean
    children?: VaultFile[]
}

export class VaultService {

    private static async getVaultPath(): Promise<string | null> {
        const path = useStore.getState().vaultPath
        return path
    }

    /**
     * Prompts the user to select a folder for the Vault
     */
    static async selectVaultLocation(): Promise<string | null> {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Vault Location'
            })

            if (selected && typeof selected === 'string') {
                useStore.getState().setVaultPath(selected)
                return selected
            }
            return null
        } catch (error) {
            console.error('Failed to select vault location:', error)
            return null
        }
    }

    /**
     * Writes content to a file in the vault. 
     * Creates specific subdirectories if they don't exist.
     * @param mode - 'overwrite' replaces file contents, 'append' adds to the end
     */
    static async writeToVault(
        relativePath: string,
        content: string,
        mode: 'overwrite' | 'append' = 'overwrite'
    ): Promise<boolean> {
        console.log('[VaultService] writeToVault called', { relativePath, contentLength: content.length, mode })

        const vaultPath = await this.getVaultPath()
        console.log('[VaultService] Vault path from store:', vaultPath)

        if (!vaultPath) {
            throw new Error('Vault path not configured')
        }

        try {
            // Construct full path
            const fullPath = await join(vaultPath, relativePath)
            console.log('[VaultService] Full path:', fullPath)

            // Ensure parent directory exists
            const parts = relativePath.split('/')
            if (parts.length > 1) {
                const dirParts = parts.slice(0, parts.length - 1)
                const dirPath = await join(vaultPath, ...dirParts)
                const dirExists = await exists(dirPath)
                if (!dirExists) {
                    console.log('[VaultService] Creating directory:', dirPath)
                    await mkdir(dirPath, { recursive: true })
                }
            }

            let finalContent = content

            // If appending, read existing content first
            if (mode === 'append') {
                const fileExists = await exists(fullPath)
                if (fileExists) {
                    console.log('[VaultService] Appending to existing file...')
                    const existingContent = await readTextFile(fullPath)
                    // Add a newline separator between existing and new content
                    finalContent = existingContent + '\n\n---\n\n' + content
                } else {
                    console.log('[VaultService] File does not exist, creating new file for append')
                }
            }

            console.log('[VaultService] Writing file...')
            await writeTextFile(fullPath, finalContent)
            console.log('[VaultService] File written successfully')
            return true
        } catch (error) {
            console.error(`[VaultService] Failed to write to vault file ${relativePath}:`, error)
            throw error
        }
    }

    /**
     * Reads a file from the vault
     */
    static async readFromVault(relativePath: string): Promise<string> {
        const vaultPath = await this.getVaultPath()
        if (!vaultPath) {
            throw new Error('Vault path not configured')
        }

        try {
            const fullPath = await join(vaultPath, relativePath)
            return await readTextFile(fullPath)
        } catch (error) {
            console.error(`Failed to read vault file ${relativePath}:`, error)
            throw error
        }
    }

    /**
     * Lists files in the vault (non-recursive for now for performance)
     */
    static async listVaultFiles(subDir: string = ''): Promise<VaultFile[]> {
        const vaultPath = await this.getVaultPath()
        if (!vaultPath) {
            return []
        }

        try {
            const targetPath = subDir ? await join(vaultPath, subDir) : vaultPath
            const entries = await readDir(targetPath)

            const results: VaultFile[] = []

            for (const entry of entries) {
                // Skip hidden files
                if (entry.name.startsWith('.')) continue

                results.push({
                    name: entry.name,
                    path: subDir ? `${subDir}/${entry.name}` : entry.name,
                    isDirectory: !!entry.isDirectory
                })
            }

            return results.sort((a, b) => {
                // Directories first
                if (a.isDirectory && !b.isDirectory) return -1
                if (!a.isDirectory && b.isDirectory) return 1
                return a.name.localeCompare(b.name)
            })

        } catch (error) {
            console.error('Failed to list vault files:', error)
            return []
        }
    }
}
