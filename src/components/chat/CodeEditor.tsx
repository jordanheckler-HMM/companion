import { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { X, Save, Upload, FileCode, FileText, Sparkles, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { EditorAIPanel } from './EditorAIPanel'
import { AIService } from '@/services/aiService'
import { useStore } from '@/store'

import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

interface AIMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
}

interface CodeEditorProps {
    initialContent: string
    fileName?: string
    filePath?: string
    language?: string
    onSave: () => void
    onExit: () => void
    onUpload: (content: string, fileName: string) => void
}

export function CodeEditor({
    initialContent,
    fileName = 'untitled.txt',
    filePath: initialFilePath,
    language: initialLanguage,
    onSave,
    onExit,
    onUpload
}: CodeEditorProps) {
    const [content, setContent] = useState(initialContent)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [language, setLanguage] = useState(initialLanguage || detectLanguage(fileName))
    const [editableFileName, setEditableFileName] = useState(fileName)
    const [filePath, setFilePath] = useState<string | undefined>(initialFilePath)

    // AI Panel state
    const [aiPanelOpen, setAiPanelOpen] = useState(false)
    const [aiPanelWidth, setAiPanelWidth] = useState(400)
    const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
    const [aiLoading, setAiLoading] = useState(false)
    const [selectedCode, setSelectedCode] = useState<string>('')
    const [isResizing, setIsResizing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const editorRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+S or Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
            // Esc to exit
            if (e.key === 'Escape') {
                e.preventDefault()
                handleExit()
            }
            // Ctrl+K to toggle AI panel
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setAiPanelOpen(!aiPanelOpen)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [content, hasUnsavedChanges, aiPanelOpen, filePath, editableFileName])

    // Resizing logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return

            const containerWidth = containerRef.current.offsetWidth
            const newWidth = containerWidth - e.clientX

            // Constrain width
            if (newWidth > 250 && newWidth < containerWidth * 0.7) {
                setAiPanelWidth(newWidth)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor

        // Track selection changes
        editor.onDidChangeCursorSelection(() => {
            const selection = editor.getSelection()
            const selectedText = editor.getModel()?.getValueInRange(selection) || ''
            setSelectedCode(selectedText)
        })
    }

    const handleEditorChange = (value: string | undefined) => {
        const newContent = value || ''
        setContent(newContent)
        setHasUnsavedChanges(newContent !== initialContent)
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            let targetPath = filePath

            // If no path, show save dialog
            if (!targetPath) {
                const selectedPath = await save({
                    defaultPath: editableFileName,
                    filters: [{
                        name: 'Document',
                        extensions: [language === 'plaintext' ? 'txt' : (language || 'txt')]
                    }]
                })

                if (!selectedPath) {
                    setIsSaving(false)
                    return // User cancelled
                }

                targetPath = selectedPath
                setFilePath(targetPath)
                // Update editable filename from path
                const nameFromPath = targetPath.split(/[/\\]/).pop()
                if (nameFromPath) setEditableFileName(nameFromPath)
            }

            // Write to disk
            await writeTextFile(targetPath, content)

            // Also call original onSave for session sync
            onSave()
            setHasUnsavedChanges(false)
        } catch (error) {
            console.error('Failed to save file:', error)
            alert('Failed to save file to disk')
        } finally {
            setIsSaving(false)
        }
    }

    const handleUpload = () => {
        onUpload(content, editableFileName)
    }

    const handleExit = () => {
        if (hasUnsavedChanges) {
            const confirm = window.confirm('You have unsaved changes. Are you sure you want to exit?')
            if (!confirm) return
        }
        onExit()
    }

    // AI Functions
    const askAI = async (prompt: string) => {
        if (aiLoading) return

        const userMessage: AIMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: prompt
        }

        setAiMessages(prev => [...prev, userMessage])
        setAiLoading(true)

        // Create a placeholder for assistant message
        const assistantMessageId = crypto.randomUUID()
        const assistantMessage: AIMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: ''
        }
        setAiMessages(prev => [...prev, assistantMessage])

        try {
            const { settings } = useStore.getState()
            const aiService = new AIService(settings.aiSettings)

            // Build conversation history from local messages
            // We prepend current document context as a system message
            const codeContext = selectedCode || content
            const documentContext = `Current Document (${editableFileName}):
\`\`\`${language}
${codeContext}
\`\`\``

            const systemPrompt = `You are an expert programming assistant. 
${documentContext}

Help the user edit this document. Provide concise, actionable advice. 
When suggesting code changes, always format them in code blocks using \`\`\`${language} ... \`\`\`. 
If refactoring or modifying code, provide the complete modified code snippet.`

            const history = [
                { role: 'system' as const, content: systemPrompt },
                ...aiMessages.map(m => ({ role: m.role, content: m.content })),
                { role: 'user' as const, content: prompt }
            ]

            let fullResponse = ''

            await aiService.streamMessage(
                history,
                (chunk) => {
                    fullResponse += chunk
                    setAiMessages(prev =>
                        prev.map(m => m.id === assistantMessageId ? { ...m, content: fullResponse } : m)
                    )
                }
            )

            if (!fullResponse) {
                setAiMessages(prev =>
                    prev.map(m => m.id === assistantMessageId ? { ...m, content: 'No response received' } : m)
                )
            }
        } catch (error) {
            console.error('AI error:', error)
            setAiMessages(prev =>
                prev.map(m => m.id === assistantMessageId ? {
                    ...m,
                    content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}`
                } : m)
            )
        } finally {
            setAiLoading(false)
        }
    }

    const handleQuickAction = async (action: 'explain' | 'refactor' | 'debug' | 'comment') => {
        const prompts = {
            explain: selectedCode
                ? 'Explain what this code does in simple terms.'
                : 'Explain what this entire file does in simple terms.',
            refactor: 'Suggest how to refactor this code for better readability, maintainability, and performance. Provide the improved code.',
            debug: 'Analyze this code for potential bugs, errors, or issues. List any problems and suggest fixes.',
            comment: 'Add detailed inline comments to explain this code. Return the fully commented code.'
        }

        await askAI(prompts[action])

        // Auto-open AI panel if closed
        if (!aiPanelOpen) {
            setAiPanelOpen(true)
        }
    }

    const handleApplyCode = (code: string) => {
        if (selectedCode && editorRef.current) {
            // Replace selection
            const selection = editorRef.current.getSelection()
            editorRef.current.executeEdits('ai-suggestion', [{
                range: selection,
                text: code
            }])
        } else {
            // Replace entire content
            setContent(code)
        }

        setHasUnsavedChanges(true)
    }

    // Determine editor options based on language (Code vs Document)
    const isDocument = language === 'plaintext' || language === 'markdown'
    const editorOptions = {
        minimap: { enabled: !aiPanelOpen },
        fontSize: 15,
        lineNumbers: 'on' as const,
        renderWhitespace: 'selection' as const,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on' as const,
        lineHeight: 1.5,
        padding: { top: 20, bottom: 20 },
    }

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-[100] bg-[#0A0A0A] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
            {/* Header */}
            <div className="glass-strong border-b border-white/20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isDocument ? (
                        <FileText className="h-5 w-5 text-accent" />
                    ) : (
                        <FileCode className="h-5 w-5 text-accent" />
                    )}
                    <input
                        type="text"
                        value={editableFileName}
                        onChange={(e) => setEditableFileName(e.target.value)}
                        className="bg-transparent border-none outline-none text-lg font-medium focus:ring-1 focus:ring-white/20 rounded px-2 py-1"
                    />
                    {hasUnsavedChanges && (
                        <span className="text-xs text-yellow-400">• Unsaved</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Language Selector */}
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="glass-hover appearance-none bg-transparent border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-white/40 cursor-pointer"
                    >
                        <option value="plaintext">Plain Text</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="json">JSON</option>
                        <option value="markdown">Markdown</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="yaml">YAML</option>
                        <option value="xml">XML</option>
                        <option value="sql">SQL</option>
                        <option value="shell">Shell</option>
                        <option value="dockerfile">Dockerfile</option>
                    </select>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSave}
                        className="glass-hover"
                        title="Save (Ctrl+S)"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUpload}
                        className="glass-hover"
                        title="Upload as attachment"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAiPanelOpen(!aiPanelOpen)}
                        className="glass-hover"
                        title="Toggle AI Assistant (Ctrl+K)"
                        style={{
                            backgroundColor: aiPanelOpen ? 'rgb(var(--accent-rgb))' : undefined,
                            color: aiPanelOpen ? 'white' : undefined
                        }}
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI
                        {aiPanelOpen ? (
                            <ChevronRight className="h-3 w-3 ml-1" />
                        ) : (
                            <ChevronLeft className="h-3 w-3 ml-1" />
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExit}
                        className="glass-hover"
                        title="Exit (Esc)"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Editor + AI Panel */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Monaco Editor */}
                <div className="flex-1 h-full min-w-0">
                    <Editor
                        height="100%"
                        language={language}
                        value={content}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        theme="vs-dark"
                        options={editorOptions}
                    />
                </div>

                {/* AI Panel */}
                {aiPanelOpen && (
                    <>
                        {/* Drag Handle */}
                        <div
                            className="w-1.5 cursor-col-resize hover:bg-accent/40 bg-white/5 transition-colors z-10"
                            onMouseDown={() => setIsResizing(true)}
                        />
                        <div
                            className="h-full animate-in slide-in-from-right duration-300"
                            style={{ width: `${aiPanelWidth}px`, minWidth: '300px' }}
                        >
                            <EditorAIPanel
                                messages={aiMessages}
                                onSendMessage={askAI}
                                onQuickAction={handleQuickAction}
                                onApplyCode={handleApplyCode}
                                loading={aiLoading}
                                selectedCode={selectedCode}
                                fileName={editableFileName}
                                language={language}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Footer Hint */}
            <div className="glass-strong border-t border-white/20 px-6 py-2 text-xs text-muted-foreground flex justify-between items-center">
                <span className="opacity-60 text-[10px] uppercase tracking-wider font-semibold">
                    {isDocument ? 'Document Mode' : 'Editor Mode'}
                </span>
                <span className="opacity-60">
                    Ctrl+S to save • Ctrl+K for AI • Esc to exit • Upload to attach
                </span>
            </div>
        </div>
    )
}

// Helper function to detect language from file extension
function detectLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        py: 'python',
        json: 'json',
        md: 'markdown',
        html: 'html',
        css: 'css',
        yml: 'yaml',
        yaml: 'yaml',
        xml: 'xml',
        sql: 'sql',
        sh: 'shell',
        bash: 'shell',
        dockerfile: 'dockerfile',
        txt: 'plaintext',
    }
    return languageMap[ext || ''] || 'plaintext'
}
