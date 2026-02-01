import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { FileGrid } from '@/components/files/FileCard'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { GitHubDashboard } from '@/components/dashboard/GitHubDashboard'
import { CalendarDashboard } from '@/components/dashboard/CalendarDashboard'
import { NotionDashboard } from '@/components/dashboard/NotionDashboard'
import { SupabaseDashboard } from '@/components/dashboard/SupabaseDashboard'
import { AgentLab } from '@/components/agents/AgentLab'
import { AgentStoreView } from '@/components/agents/AgentStoreView'
import { TeamWorkspace } from '@/components/teams/TeamWorkspace'
import { SupabaseService } from '@/services/SupabaseService'


import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { RAGService } from '@/services/ragService'
import { ModelRegistry } from '@/services/ModelRegistry'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastManager } from '@/components/ToastManager'
import { automationService } from '@/services/AutomationService'

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`

import { MiniChat } from '@/components/chat/MiniChat'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ExecutionStatus } from '@/components/agents/ExecutionStatus'

function App() {
  const {
    currentView, setCurrentView, files, addFile, removeFile, addKnowledgeChunks,
    settings, updateSettings, addMessage, updateMessage,
    addConnectedApp, removeConnectedApp,
    setAvailableModels, setOllamaInstallStatus, hasHydrated
  } = useStore()

  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [windowLabel, setWindowLabel] = useState<string | null>(null)

  useEffect(() => {
    // Determine which window we are in
    const identifyWindow = async () => {
      try {
        const win = getCurrentWindow()
        setWindowLabel(win.label)
      } catch (e) {
        setWindowLabel('main')
      }
    }
    identifyWindow()
  }, [])

  // Theme management
  useEffect(() => {
    const root = window.document.documentElement
    const theme = settings.theme

    const applyTheme = (themeName: string) => {
      // Clear all theme classes
      root.classList.remove('dark', 'light', 'glass-crystal', 'glass-frost', 'glass-obsidian', 'glass-theme', 'glass-custom')

      if (themeName.startsWith('glass-')) {
        root.classList.add('glass-theme', 'dark', themeName)
      } else {
        root.classList.add(themeName)
      }
    }

    applyTheme(theme)
  }, [settings.theme])

  // Dynamic Glass variables
  useEffect(() => {
    const root = window.document.documentElement
    root.style.setProperty('--glass-opacity', (settings.glassIntensity / 100).toString())
    root.style.setProperty('--glass-tint-weight', (settings.accentTintStrength / 100).toString())
    root.style.setProperty('--glass-blur', `${settings.glassBlur / 2.5}px`)
  }, [settings.glassIntensity, settings.accentTintStrength, settings.glassBlur])

  // Accent color management
  useEffect(() => {
    const root = window.document.documentElement
    const colors: Record<string, string> = {
      blue: '59 130 246',
      purple: '168 85 247',
      green: '34 197 94',
      orange: '249 115 22',
      pink: '236 72 153',
      cyan: '45 212 191',
    }
    const colorValue = colors[settings.accentColor] || colors.cyan
    root.style.setProperty('--accent-rgb', colorValue)
  }, [settings.accentColor])

  // Restore scheduled automations after hydration
  useEffect(() => {
    if (hasHydrated) {
      automationService.restoreScheduledAutomations()
    }
  }, [hasHydrated])

  // AI & Model Initialization
  useEffect(() => {
    const initializeModels = async () => {
      console.log('[App] Initializing models...')
      const registry = ModelRegistry.getInstance()

      // Always try to sync via HTTP first - this works even if CLI check fails
      await registry.syncOllamaModels(settings.aiSettings.ollamaUrl)

      const allModels = registry.getAllModels()
      const localModels = allModels.filter(m => m.type === 'local')
      const hasLocalModels = localModels.length > 0

      // Update Ollama status based on whether we found local models
      setOllamaInstallStatus(hasLocalModels ? 'installed' : 'not_installed')
      setAvailableModels(allModels)

      // Auto-sync preferredModelId with the default model based on intelligence mode
      const currentPreferred = settings.aiSettings.preferredModelId
      const preferredExists = allModels.some(m => m.id === currentPreferred)

      if (!preferredExists || !currentPreferred) {
        // Set a sensible default based on intelligence mode
        if (settings.aiSettings.intelligenceMode === 'local' && hasLocalModels) {
          // Use the ollamaModel setting if it exists, otherwise first local model
          const defaultLocal = settings.aiSettings.ollamaModel && localModels.some(m => m.id === settings.aiSettings.ollamaModel)
            ? settings.aiSettings.ollamaModel
            : localModels[0].id
          updateSettings({ aiSettings: { ...settings.aiSettings, preferredModelId: defaultLocal } })
        } else if (settings.aiSettings.intelligenceMode === 'cloud') {
          const cloudModels = allModels.filter(m => m.type === 'cloud')
          if (cloudModels.length > 0) {
            // Use the cloudModel setting if it exists, otherwise first cloud model
            const defaultCloud = settings.aiSettings.cloudModel && cloudModels.some(m => m.id === settings.aiSettings.cloudModel)
              ? settings.aiSettings.cloudModel
              : cloudModels[0].id
            updateSettings({ aiSettings: { ...settings.aiSettings, preferredModelId: defaultCloud } })
          }
        }
      }

      console.log('[App] Models initialized:', allModels.length, 'total,', localModels.length, 'local')
    }

    initializeModels()
    initializeModels()

    // Initialize Supabase
    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env
    if (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) {
      SupabaseService.initialize(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    }
  }, [settings.aiSettings.ollamaUrl])


  const handleFileAction = (fileId: string, action: string) => {
    if (action === 'delete') {
      removeFile(fileId)
    }
    console.log(`File ${fileId}: ${action}`)
  }

  if (windowLabel === 'panel') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-transparent font-sans">
        <MiniChat />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-all duration-500 font-sans">

      <Sidebar currentView={currentView} onViewChange={setCurrentView} />

      <main className="flex-1 overflow-hidden">
        <ErrorBoundary>
          {currentView === 'home' && <ChatWindow />}
          {currentView === 'agents' && <AgentLab />}
          {currentView === 'store' && <AgentStoreView />}
          {currentView === 'teams' && <TeamWorkspace />}
          {currentView === 'supabase' && <SupabaseDashboard />}
          {currentView === 'files' && (

            // ... existing files content ...
            <div className="h-full overflow-y-auto">
              <div className="glass-light border-b border-white/10 px-6 py-4 sticky top-0 z-10">
                <h2 className="text-lg font-semibold">Files</h2>
                <p className="text-sm text-muted-foreground">Manage your documents and knowledge base</p>
              </div>
              <FileGrid
                files={files}
                onFileAction={handleFileAction}
                onUpload={async (file) => {
                  try {
                    // 1. Read file content
                    const content = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onerror = reject

                      if (file.type === 'application/pdf') {
                        reader.onload = async (e) => {
                          try {
                            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer)
                            const pdf = await pdfjsLib.getDocument(typedarray).promise
                            let fullText = ''
                            for (let i = 1; i <= pdf.numPages; i++) {
                              const page = await pdf.getPage(i)
                              const textContent = await page.getTextContent()
                              fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n'
                            }
                            resolve(fullText)
                          } catch (err) { reject(err) }
                        }
                        reader.readAsArrayBuffer(file)
                      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                        reader.onload = async (e) => {
                          try {
                            const arrayBuffer = e.target?.result as ArrayBuffer
                            const result = await mammoth.extractRawText({ arrayBuffer })
                            resolve(result.value)
                          } catch (err) { reject(err) }
                        }
                        reader.readAsArrayBuffer(file)
                      } else {
                        reader.onload = (e) => resolve(e.target?.result as string || '')
                        reader.readAsText(file)
                      }
                    })

                    // 2. Add to library
                    const fileId = addFile({
                      filename: file.name,
                      size: `${(file.size / 1024).toFixed(1)} KB`,
                      type: file.type || 'unknown',
                      lastModified: new Date().toLocaleDateString(),
                      content
                    } as any)

                    // 3. Process into Knowledge Base (RAG)
                    const ragService = new RAGService(settings.aiSettings)
                    const chunks = ragService.chunkText(content, fileId)

                    const statusId = addMessage({
                      role: 'assistant',
                      content: `Indexing **${file.name}** into knowledge base...`
                    })

                    const enrichedChunks = await ragService.generateEmbeddings(chunks)
                    addKnowledgeChunks(enrichedChunks)

                    updateMessage(statusId, `Completed indexing **${file.name}**. It is now part of my permanent knowledge.`)
                  } catch (error) {
                    console.error('File knowledge upload error:', error)
                  }
                }}
              />
            </div>
          )}

          {currentView === 'github' && <GitHubDashboard />}
          {currentView === 'calendar' && <CalendarDashboard />}
          {currentView === 'notion' && <NotionDashboard />}

          {currentView === 'integrations' && (
            <div className="h-full overflow-y-auto relative">
              <div className="glass-light border-b border-white/10 px-6 py-4">
                <h2 className="text-lg font-semibold">Integrations</h2>
                <p className="text-sm text-muted-foreground">Connect your apps</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Google Calendar */}
                  <div className="glass-card rounded-xl p-6 text-center flex flex-col items-center">
                    <div className="text-4xl mb-3">📅</div>
                    <h3 className="font-semibold mb-2">Google Calendar</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sync your calendar events
                    </p>
                    {settings.aiSettings.googleCalendarApiKey ? (
                      <button
                        onClick={() => {
                          updateSettings({ aiSettings: { ...settings.aiSettings, googleCalendarApiKey: undefined } })
                          removeConnectedApp('Google Calendar')
                        }}
                        className="glass-strong bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => { setActiveModal('google_calendar'); setApiKeyInput('') }}
                        className="glass-strong hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Connect
                      </button>
                    )}
                  </div>

                  {/* Notion */}
                  <div className="glass-card rounded-xl p-6 text-center flex flex-col items-center">
                    <div className="text-4xl mb-3">📝</div>
                    <h3 className="font-semibold mb-2">Notion</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Access your workspace
                    </p>
                    {settings.aiSettings.notionApiKey ? (
                      <button
                        onClick={() => {
                          updateSettings({ aiSettings: { ...settings.aiSettings, notionApiKey: undefined } })
                          removeConnectedApp('Notion')
                        }}
                        className="glass-strong bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => { setActiveModal('notion'); setApiKeyInput('') }}
                        className="glass-strong hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Connect
                      </button>
                    )}
                  </div>

                  {/* GitHub */}
                  <div className="glass-card rounded-xl p-6 text-center flex flex-col items-center">
                    <div className="text-4xl mb-3">💻</div>
                    <h3 className="font-semibold mb-2">GitHub</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage repositories
                    </p>
                    {settings.aiSettings.githubApiKey ? (
                      <button
                        onClick={() => {
                          updateSettings({ aiSettings: { ...settings.aiSettings, githubApiKey: undefined } })
                          removeConnectedApp('GitHub')
                        }}
                        className="glass-strong bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => { setActiveModal('github'); setApiKeyInput('') }}
                        className="glass-strong hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Connect
                      </button>
                    )}
                  </div>

                  {/* Supabase */}
                  <div className="glass-card rounded-xl p-6 text-center flex flex-col items-center">
                    <div className="text-4xl mb-3">⚡</div>
                    <h3 className="font-semibold mb-2">Supabase</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your database
                    </p>
                    {settings.aiSettings.toolsEnabled?.supabase?.enabled && settings.aiSettings.toolsEnabled?.supabase?.supabaseUrl ? (
                      <button
                        onClick={() => {
                          const currentTools = settings.aiSettings.toolsEnabled || {
                            web_search: true,
                            url_reader: true,
                            file_system: true,
                            execute_code: true,
                            google_calendar: false,
                            notion: false,
                            github: false
                          }
                          updateSettings({
                            aiSettings: {
                              ...settings.aiSettings,
                              toolsEnabled: {
                                ...currentTools,
                                supabase: {
                                  enabled: false,
                                  supabaseUrl: '',
                                  supabaseKey: ''
                                }
                              }
                            }
                          })
                          removeConnectedApp('Supabase')
                        }}
                        className="glass-strong bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentView('supabase')}
                        className="glass-strong hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium w-full mt-auto"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* API Key Modal */}
              {activeModal && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-lg font-bold mb-2">Enter API Key</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {activeModal === 'google_calendar' && 'Enter your Google Cloud API Key with Calendar API enabled.'}
                      {activeModal === 'notion' && 'Enter your Notion Integration Token.'}
                      {activeModal === 'github' && 'Enter your GitHub Personal Access Token.'}
                    </p>

                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoFocus
                    />

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setActiveModal(null)}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!apiKeyInput.trim()}
                        onClick={() => {
                          const updates: any = { ...settings.aiSettings }
                          let appName = ''

                          if (activeModal === 'google_calendar') {
                            updates.googleCalendarApiKey = apiKeyInput
                            appName = 'Google Calendar'
                          } else if (activeModal === 'notion') {
                            updates.notionApiKey = apiKeyInput
                            appName = 'Notion'
                          } else if (activeModal === 'github') {
                            updates.githubApiKey = apiKeyInput
                            appName = 'GitHub'
                          }

                          updateSettings({ aiSettings: updates })
                          addConnectedApp(appName)
                          setActiveModal(null)
                        }}
                        className="glass-strong bg-primary/20 hover:bg-primary/30 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Save & Connect
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentView === 'settings' && <SettingsPanel />}
        </ErrorBoundary>
      </main>
      <ToastManager />
      <ExecutionStatus />
    </div>
  )
}

export default App
