import { Command } from '@tauri-apps/plugin-shell'
import { writeTextFile, remove } from '@tauri-apps/plugin-fs'
import { confirm } from '@tauri-apps/plugin-dialog'
import { tempDir } from '@tauri-apps/api/path'

export class CodeExecutionTool {
    private static readonly MAX_CODE_LENGTH = 12000
    private static readonly PREVIEW_LENGTH = 1200
    private static readonly FORBIDDEN_PATTERNS: Record<'python' | 'javascript', Array<{ label: string; pattern: RegExp }>> = {
        python: [
            { label: 'OS process access (os/subprocess)', pattern: /\b(import\s+os|from\s+os\s+import|import\s+subprocess|from\s+subprocess\s+import|os\.(system|popen|exec|spawn)|subprocess\.)\b/i },
            { label: 'File system access', pattern: /\b(open\s*\(|pathlib\.|os\.(remove|unlink|rename|mkdir|rmdir|listdir|walk|scandir)|shutil\.)/i },
            { label: 'Network access', pattern: /\b(import\s+socket|from\s+socket\s+import|import\s+requests|from\s+requests\s+import|urllib\.|http\.client|ftplib|paramiko)\b/i }
        ],
        javascript: [
            { label: 'Process execution (child_process)', pattern: /\b(require\s*\(\s*['"]child_process['"]\s*\)|from\s+['"]child_process['"]|child_process\.)/i },
            { label: 'File system access', pattern: /\b(require\s*\(\s*['"]fs['"]\s*\)|from\s+['"]fs['"]|fs\.(readFile|writeFile|appendFile|unlink|rm|rmdir|mkdir|createReadStream|createWriteStream)|\bDeno\.(readFile|writeFile|remove|mkdir))\b/i },
            { label: 'Network access', pattern: /\b(fetch\s*\(|XMLHttpRequest|WebSocket|require\s*\(\s*['"]https?['"]\s*\)|from\s+['"]https?['"])\b/i }
        ]
    }

    private static normalizeLanguage(language: unknown): 'python' | 'javascript' | null {
        if (language === 'python' || language === 'javascript') return language
        return null
    }

    private static buildCodePreview(code: string): string {
        if (code.length <= this.PREVIEW_LENGTH) return code
        const remaining = code.length - this.PREVIEW_LENGTH
        return `${code.slice(0, this.PREVIEW_LENGTH)}\n\n...[truncated ${remaining} characters]`
    }

    private static detectForbiddenOperations(language: 'python' | 'javascript', code: string): string[] {
        return this.FORBIDDEN_PATTERNS[language]
            .filter(({ pattern }) => pattern.test(code))
            .map(({ label }) => label)
    }

    static async execute(language: 'python' | 'javascript', code: string): Promise<string> {
        let filePath = ''
        try {
            const normalizedLanguage = this.normalizeLanguage(language)
            if (!normalizedLanguage) {
                return 'Error: invalid language. Allowed values are "python" and "javascript".'
            }

            if (typeof code !== 'string' || !code.trim()) {
                return 'Error: code must be a non-empty string.'
            }

            if (code.length > this.MAX_CODE_LENGTH) {
                return `Error: code length exceeds ${this.MAX_CODE_LENGTH} characters.`
            }

            const forbiddenOperations = this.detectForbiddenOperations(normalizedLanguage, code)
            if (forbiddenOperations.length > 0) {
                return `Execution blocked: high-risk operations detected (${forbiddenOperations.join(', ')}). This tool only allows computation-only scripts.`
            }

            const preview = this.buildCodePreview(code)
            const confirmed = await confirm(
                `The AI wants to execute local ${normalizedLanguage} code.\n\nSecurity notice: this runs on your machine with your user permissions.\n\nCode preview:\n${preview}\n\nDo you want to allow this run?`,
                { title: 'Confirm Code Execution', kind: 'warning' }
            )
            if (!confirmed) return "User denied code execution permission."

            const tempPath = await tempDir()
            const fileName = `companion_task_${Date.now()}.${normalizedLanguage === 'python' ? 'py' : 'js'}`
            filePath = `${tempPath.replace(/\/$/, '')}/${fileName}`

            await writeTextFile(filePath, code)

            let command: Command<string>
            if (normalizedLanguage === 'python') {
                command = Command.create('python-run', [filePath])
            } else {
                command = Command.create('node-run', [filePath])
            }

            const output = await command.execute()

            let result = ''
            if (typeof output.code === 'number' && output.code !== 0) {
                result += `EXIT_CODE: ${output.code}\n`
            }
            if (output.stdout) result += `STDOUT:\n${output.stdout}\n`
            if (output.stderr) result += `STDERR:\n${output.stderr}\n`

            return result || 'Execution completed with no output.'
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`
        } finally {
            if (filePath) {
                try {
                    await remove(filePath)
                } catch (_error) {
                    // Ignore cleanup errors
                }
            }
        }
    }
}
