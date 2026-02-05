import { Command } from '@tauri-apps/plugin-shell'
import { writeTextFile, remove } from '@tauri-apps/plugin-fs'
import { confirm } from '@tauri-apps/plugin-dialog'
import { tempDir } from '@tauri-apps/api/path'

export class CodeExecutionTool {
    static async execute(language: 'python' | 'javascript', code: string): Promise<string> {
        try {
            const confirmed = await confirm(
                `The AI wants to execute the following ${language} code:\n\n${code}\n\nDo you want to allow this?`,
                { title: 'Confirm Code Execution', kind: 'warning' }
            )
            if (!confirmed) return "User denied code execution permission."

            const tempPath = await tempDir()
            const fileName = `companion_task_${Date.now()}.${language === 'python' ? 'py' : 'js'}`
            const filePath = `${tempPath}/${fileName}`

            await writeTextFile(filePath, code)

            let command: Command<string>
            if (language === 'python') {
                command = Command.create('python-run', [filePath])
            } else {
                command = Command.create('node-run', [filePath])
            }

            const output = await command.execute()

            // Clean up
            try {
                await remove(filePath)
            } catch (_error) {
                // Ignore cleanup errors
            }

            let result = ''
            if (output.stdout) result += `STDOUT:\n${output.stdout}\n`
            if (output.stderr) result += `STDERR:\n${output.stderr}\n`

            return result || 'Execution completed with no output.'
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}
