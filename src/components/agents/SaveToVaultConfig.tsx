import { useState, useEffect } from 'react'
import { PipelineStep, useStore } from '@/store'
import { VaultService, VaultFile } from '@/services/VaultService'
import { Bot, Save, FolderOpen, FilePlus, FileText, RefreshCw, PenLine, Sparkles, Replace, FileOutput } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SaveToVaultConfigProps {
    step: PipelineStep
    updateStep: (updates: Partial<PipelineStep>) => void
    availableVariables: string[]
}

export function SaveToVaultConfig({ step, updateStep, availableVariables }: SaveToVaultConfigProps) {
    const vaultPath = useStore(state => state.vaultPath)
    const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([])
    const [isLoadingFiles, setIsLoadingFiles] = useState(false)
    const [currentDir, setCurrentDir] = useState('')

    // Load vault files when component mounts or directory changes
    useEffect(() => {
        if (vaultPath) {
            loadVaultFiles(currentDir)
        }
    }, [vaultPath, currentDir])

    const loadVaultFiles = async (subDir: string = '') => {
        setIsLoadingFiles(true)
        try {
            const files = await VaultService.listVaultFiles(subDir)
            setVaultFiles(files)
        } catch (error) {
            console.error('Failed to load vault files:', error)
            setVaultFiles([])
        } finally {
            setIsLoadingFiles(false)
        }
    }

    const handleFileSelect = (file: VaultFile) => {
        if (file.isDirectory) {
            setCurrentDir(file.path)
        } else {
            updateStep({
                vaultPath: file.path,
                fileSelection: 'existing'
            })
        }
    }

    const handleNavigateUp = () => {
        const parts = currentDir.split('/')
        parts.pop()
        setCurrentDir(parts.join('/'))
    }

    const generateAutoFilename = () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const randomId = Math.random().toString(36).substring(2, 6)
        return `output-${timestamp}-${randomId}.md`
    }

    const handleNamingChange = (naming: 'manual' | 'auto') => {
        updateStep({ fileNaming: naming })
        if (naming === 'auto') {
            updateStep({ vaultPath: generateAutoFilename() })
        }
    }

    // Default values
    const fileSelection = step.fileSelection || 'new'
    const fileNaming = step.fileNaming || 'manual'
    const writeMode = step.writeMode || 'overwrite'

    // Get selectable files (excluding hidden ones which are already handled in VaultService)
    const selectableFiles = vaultFiles

    return (
        <div className="space-y-5">
            {/* Content Source */}
            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2 flex items-center gap-2">
                    <Bot className="w-3 h-3" />
                    Content Source
                </label>
                <select
                    className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/10 transition-all border border-white/5"
                    value={step.sourceVariable || ''}
                    onChange={(e) => updateStep({ sourceVariable: e.target.value })}
                >
                    <option value="" className="bg-zinc-900">All outputs (combined)</option>
                    {availableVariables.map(v => (
                        <option key={v} value={v} className="bg-zinc-900">
                            Step Output: {v}
                        </option>
                    ))}
                </select>
                {availableVariables.length === 0 && (
                    <p className="text-[10px] text-yellow-400/60 mt-2 px-1 italic">
                        Note: No previous steps have output variables named. Will default to all collected text.
                    </p>
                )}
            </div>

            {/* File Selection Mode */}
            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-3 flex items-center gap-2">
                    <Save className="w-3 h-3" />
                    Destination File
                </label>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-4">
                    <button
                        type="button"
                        onClick={() => updateStep({ fileSelection: 'existing' })}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all border",
                            fileSelection === 'existing'
                                ? "bg-primary-accent/20 text-primary-accent border-primary-accent/30"
                                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                        )}
                    >
                        <FolderOpen className="w-4 h-4" />
                        Existing File
                    </button>
                    <button
                        type="button"
                        onClick={() => updateStep({ fileSelection: 'new' })}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all border",
                            fileSelection === 'new'
                                ? "bg-primary-accent/20 text-primary-accent border-primary-accent/30"
                                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                        )}
                    >
                        <FilePlus className="w-4 h-4" />
                        New File
                    </button>
                </div>

                {/* Existing File Browser */}
                {fileSelection === 'existing' && (
                    <div className="space-y-3">
                        {!vaultPath ? (
                            <div className="glass-card p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                                <p className="text-sm text-yellow-400 flex items-center gap-2">
                                    <span>⚠️</span>
                                    No vault connected. Go to Settings to connect a folder.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Current Path & Refresh */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <FolderOpen className="w-3 h-3" />
                                        <span className="font-mono">
                                            {currentDir || vaultPath?.split('/').pop() || 'Root'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        {currentDir && (
                                            <button
                                                type="button"
                                                onClick={handleNavigateUp}
                                                className="text-xs text-primary-accent hover:underline"
                                            >
                                                ← Back
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => loadVaultFiles(currentDir)}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                        >
                                            <RefreshCw className={cn("w-3 h-3", isLoadingFiles && "animate-spin")} />
                                        </button>
                                    </div>
                                </div>

                                {/* File List */}
                                <div className="glass-strong rounded-xl border border-white/5 max-h-48 overflow-y-auto">
                                    {isLoadingFiles ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                            Loading files...
                                        </div>
                                    ) : selectableFiles.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                            No files found
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/5">
                                            {selectableFiles.map(file => (
                                                <button
                                                    key={file.path}
                                                    type="button"
                                                    onClick={() => handleFileSelect(file)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors",
                                                        step.vaultPath === file.path && "bg-primary-accent/10"
                                                    )}
                                                >
                                                    {file.isDirectory ? (
                                                        <FolderOpen className="w-4 h-4 text-yellow-400" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-blue-400" />
                                                    )}
                                                    <span className="text-sm truncate flex-1">{file.name}</span>
                                                    {file.isDirectory && (
                                                        <span className="text-xs text-muted-foreground">→</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {step.vaultPath && (
                                    <p className="text-xs text-primary-accent flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        Selected: <span className="font-mono">{step.vaultPath}</span>
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* New File Options */}
                {fileSelection === 'new' && (
                    <div className="space-y-4">
                        {/* Naming Mode Toggle */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => handleNamingChange('manual')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all border",
                                    fileNaming === 'manual'
                                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                        : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                                )}
                            >
                                <PenLine className="w-3 h-3" />
                                Name Manually
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNamingChange('auto')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all border",
                                    fileNaming === 'auto'
                                        ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                        : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                                )}
                            >
                                <Sparkles className="w-3 h-3" />
                                Auto-Name
                            </button>
                        </div>

                        {/* Manual Input */}
                        {fileNaming === 'manual' && (
                            <input
                                type="text"
                                className="glass-strong w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/10 transition-all border border-white/5"
                                placeholder="e.g., summary.md or Reports/daily.txt"
                                value={step.vaultPath || ''}
                                onChange={(e) => updateStep({ vaultPath: e.target.value })}
                            />
                        )}

                        {/* Auto-generated Preview */}
                        {fileNaming === 'auto' && (
                            <div className="glass-strong px-4 py-3 rounded-xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Generated filename:</p>
                                    <p className="text-sm font-mono text-primary-accent">{step.vaultPath || generateAutoFilename()}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateStep({ vaultPath: generateAutoFilename() })}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Regenerate filename"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Vault Info */}
                        <p className="text-[10px] text-muted-foreground px-1">
                            Files are saved inside your connected vault:
                            <span className="text-primary-accent ml-1 font-mono">
                                {vaultPath ? (
                                    vaultPath.split('/').pop() || 'Root'
                                ) : (
                                    '⚠️ No vault connected'
                                )}
                            </span>
                        </p>
                    </div>
                )}
            </div>

            {/* Write Mode */}
            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-3 flex items-center gap-2">
                    <FileOutput className="w-3 h-3" />
                    Write Mode
                </label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => updateStep({ writeMode: 'overwrite' })}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all border",
                            writeMode === 'overwrite'
                                ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                        )}
                    >
                        <Replace className="w-4 h-4" />
                        Overwrite
                    </button>
                    <button
                        type="button"
                        onClick={() => updateStep({ writeMode: 'append' })}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all border",
                            writeMode === 'append'
                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                        )}
                    >
                        <FilePlus className="w-4 h-4" />
                        Append
                    </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 px-1">
                    {writeMode === 'overwrite'
                        ? "Replace existing file contents entirely"
                        : "Add new content to the end of the file"
                    }
                </p>
            </div>
        </div>
    )
}
