import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs'
import { confirm } from '@tauri-apps/plugin-dialog'

export class FileSystemTool {
    static async execute(operation: 'read' | 'write' | 'list', path: string, content?: string): Promise<string> {
        try {
            switch (operation) {
                case 'read':
                    {
                        const data = await readTextFile(path)
                        return data
                    }
                case 'write':
                    {
                        const confirmed = await confirm(
                            `The AI wants to write to the file at:\n${path}\n\nDo you want to allow this?`,
                            { title: 'Confirm File Write', kind: 'warning' }
                        )
                        if (!confirmed) return "User denied file write permission."
                        await writeTextFile(path, content || '')
                        return `Successfully wrote to ${path}`
                    }
                case 'list':
                    {
                        const entries = await readDir(path)
                        return entries.map(e => `${e.isDirectory ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n')
                    }
                default:
                    return `Unsupported operation: ${operation}`
            }
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}
