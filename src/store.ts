import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Message types
export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  status?: 'thinking' | 'done' | 'error'
  modelId?: string
  modelLabel?: string
}

// File types
export interface FileItem {
  id: string
  filename: string
  size: string
  type: string
  lastModified: string
  content?: string
  path?: string
}

export interface KnowledgeChunk {
  id: string
  fileId: string
  content: string
  embedding?: number[]
}

// Pending context from integrations (staged before sending)
export interface PendingContext {
  id: string
  type: 'github_repo' | 'notion_page' | 'calendar_event' | 'ai_prompt'
  title: string
  description?: string
  prompt?: string  // For ai_prompt type, the actual query to send
  metadata?: Record<string, any>
}

// AI Settings types
export interface AISettings {
  providerType?: 'local' | 'cloud' // Deprecated, kept for migration
  intelligenceMode: 'local' | 'cloud'
  preferredModelId?: string
  // Local (Ollama) settings
  ollamaUrl: string
  ollamaModel: string // Deprecated, kept for migration
  // Cloud API settings
  cloudProvider: 'openai' | 'anthropic' | 'google'
  apiKey: string // Deprecated, kept for migration
  openaiApiKey?: string
  anthropicApiKey?: string
  googleApiKey?: string // Separate key for Google if needed, or share apiKey
  cloudModel: string // Deprecated, kept for migration
  // Tool settings
  toolsEnabled?: {
    web_search: boolean
    url_reader: boolean
    file_system: boolean
    execute_code: boolean
    google_calendar: boolean
    notion: boolean
    github: boolean
  }
  // Integration Keys
  googleCalendarApiKey?: string
  notionApiKey?: string
  githubApiKey?: string
}

// Settings types
export interface Settings {
  theme: 'dark' | 'light' | 'glass-crystal' | 'glass-frost' | 'glass-obsidian' | 'glass-custom'
  accentColor: 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan'
  assistantName: string
  systemPrompt: string
  glassIntensity: number
  accentTintStrength: number
  glassBlur: number
  aiSettings: AISettings
}

// Agent Automation Types
export interface AgentBlueprint {
  id: string
  name: string
  description?: string
  icon: string // Lucide icon name
  color?: string // Hex or tailwind color
  systemPrompt: string
  preferredModelId?: string // if different from global
  enabledTools: string[] // specific subset of tools
  createdAt: string
}

export interface PipelineStep {
  id: string
  type: 'agent_action' | 'save_to_vault' | 'wait' | 'condition' | 'integration_action'
  agentId?: string        // Which agent runs this step
  prompt?: string         // What to ask the agent
  outputVariable?: string // Name to reference this step's output

  // Save to Vault config
  vaultPath?: string
  sourceVariable?: string
  writeMode?: 'overwrite' | 'append'
  fileSelection?: 'existing' | 'new'
  fileNaming?: 'manual' | 'auto'

  // Wait config
  waitDuration?: number   // milliseconds

  // Integration Action config
  integrationId?: string      // e.g., 'notion', 'github'
  integrationAction?: string  // e.g., 'create_page', 'create_issue'
  integrationArgs?: Record<string, string> // e.g., { title: "{{result}}", parent_id: "..." }

  config?: Record<string, any>
}

export interface Trigger {
  type: 'schedule' | 'manual' | 'event'
  scheduleConfig?: {
    frequency: 'daily' | 'weekly' | 'hourly' | 'custom'
    time?: string         // "08:00" (24-hour format)
    dayOfWeek?: number    // 0-6 (Sunday to Saturday)
    cronExpression?: string
  }
}

export interface Automation {
  id: string
  name: string
  description?: string
  trigger: Trigger
  pipeline: PipelineStep[]
  isActive: boolean
  lastRunAt?: string
  createdAt: string
}

export interface AgentLog {
  id: string
  automationId: string
  agentName: string
  timestamp: string
  status: 'success' | 'error' | 'running'
  message: string
}

// Store state interface
interface AppState {
  // View management
  currentView: string
  setCurrentView: (view: string) => void

  // Messages
  messages: Message[]
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string, status?: 'thinking' | 'done' | 'error', modelId?: string, modelLabel?: string) => void
  clearMessages: () => void

  // Files
  files: FileItem[]
  addFile: (file: Omit<FileItem, 'id'>) => string
  removeFile: (id: string) => void
  updateFile: (id: string, updates: Partial<FileItem>) => void

  // Settings
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Connected apps
  connectedApps: string[]
  addConnectedApp: (app: string) => void
  removeConnectedApp: (app: string) => void

  // Knowledge Base (RAG)
  knowledgeBase: KnowledgeChunk[]
  addKnowledgeChunks: (chunks: KnowledgeChunk[]) => void
  clearKnowledgeBase: () => void
  knowledgeBaseStorageWarning: string | null
  setKnowledgeBaseStorageWarning: (warning: string | null) => void

  // Pending Context (staged integration items for next message)
  pendingContext: PendingContext[]
  addPendingContext: (context: Omit<PendingContext, 'id'>) => void
  removePendingContext: (id: string) => void
  clearPendingContext: () => void

  // Model Management
  availableModels: any[] // Should be ModelDefinition[] but avoiding circular dependency for now
  setAvailableModels: (models: any[]) => void
  ollamaInstallStatus: 'not_checked' | 'installed' | 'not_installed' | 'installing'
  setOllamaInstallStatus: (status: 'not_checked' | 'installed' | 'not_installed' | 'installing') => void

  // Hydration
  hasHydrated: boolean
  setHasHydrated: (state: boolean) => void

  // Agent Automations State
  agents: AgentBlueprint[]
  addAgent: (agent: Omit<AgentBlueprint, 'id' | 'createdAt'>) => void
  updateAgent: (id: string, updates: Partial<AgentBlueprint>) => void
  removeAgent: (id: string) => void

  automations: Automation[]
  addAutomation: (automation: Omit<Automation, 'id'>) => void
  updateAutomation: (id: string, updates: Partial<Automation>) => void
  removeAutomation: (id: string) => void

  agentLogs: AgentLog[]
  addAgentLog: (log: Omit<AgentLog, 'id' | 'timestamp'>) => void
  clearAgentLogs: () => void

  vaultPath: string | null
  setVaultPath: (path: string | null) => void

  // Automation Execution State
  runningAutomationIds: string[]
  setRunningAutomationIds: (ids: string[]) => void
  automationProgress: Record<string, { current: number, total: number }>
  updateAutomationProgress: (id: string, progress: { current: number, total: number }) => void
}

// Create custom storage adapter
import { createJSONStorage, StateStorage } from 'zustand/middleware'
import { LazyStore } from '@tauri-apps/plugin-store'

const tauriStore = new LazyStore('settings.json')
let saveTimeout: NodeJS.Timeout | null = null

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 1. Try LocalStorage first (Fastest & Most Reliable for frequent updates)
    const localValue = localStorage.getItem(name)
    if (localValue) return localValue

    // 2. Fallback to Tauri store (Backup for cache clearing)
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        const tauriValue = await tauriStore.get<string>(name)
        if (tauriValue) return tauriValue
      }
    } catch (e) {
      console.warn('Tauri store get failed', e)
    }

    return null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // 1. Always save to localStorage immediately (Sync & Reliable)
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      console.error('LocalStorage write failed', e)
    }

    // 2. Debounce safe to Tauri store (Avoids file lock contention on keystrokes)
    if (saveTimeout) clearTimeout(saveTimeout)

    saveTimeout = setTimeout(async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
          await tauriStore.set(name, value)
          await tauriStore.save()
        }
      } catch (e) {
        console.error('Tauri store write failed', e)
      }
    }, 1000)
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      localStorage.removeItem(name)
    } catch (e) { }

    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        await tauriStore.delete(name)
        await tauriStore.save()
      }
    } catch (e) { }
  }
}

// Create the store with persistence
export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // View management
      currentView: 'home',
      setCurrentView: (view) => set({ currentView: view }),

      // Messages
      messages: [
        {
          id: crypto.randomUUID(),
          content: "Hey, how can I help you today?",
          role: 'assistant',
          timestamp: new Date(),
        },
      ],
      addMessage: (message) => {
        const id = crypto.randomUUID()
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id,
              timestamp: new Date(),
            },
          ],
        }))
        return id
      },
      updateMessage: (id, content, status, modelId, modelLabel) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, content, ...(status ? { status } : {}), ...(modelId ? { modelId } : {}), ...(modelLabel ? { modelLabel } : {}) } : m
          ),
        })),
      clearMessages: () =>
        set({
          messages: [
            {
              id: crypto.randomUUID(),
              content: "Hey, how can I help you today?",
              role: 'assistant',
              timestamp: new Date(),
            },
          ],
        }),

      // Files
      files: [],
      addFile: (file) => {
        const id = crypto.randomUUID()
        set((state) => ({
          files: [
            ...state.files,
            {
              ...file,
              id,
            },
          ],
        }))
        return id
      },
      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        })),
      updateFile: (id, updates) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        })),

      // Settings
      settings: {
        theme: 'glass-frost',
        accentColor: 'cyan',
        assistantName: 'Companion',
        systemPrompt: 'You are a helpful AI assistant. You can use your tools to help with various tasks, and suggest using the built-in editor for code or long documents.',
        glassIntensity: 20,
        accentTintStrength: 30,
        glassBlur: 60,
        aiSettings: {
          providerType: 'local',
          intelligenceMode: 'local',
          preferredModelId: 'llama2',
          ollamaUrl: 'http://localhost:11434',
          ollamaModel: 'llama2',
          cloudProvider: 'openai',
          apiKey: '',
          cloudModel: 'gpt-4',
          toolsEnabled: {
            web_search: true,
            url_reader: true,
            file_system: true,
            execute_code: true,
            google_calendar: true,
            notion: true,
            github: true,
          },
          // Integration API Keys
          googleCalendarApiKey: '',
          notionApiKey: '',
          githubApiKey: '',
          googleApiKey: '',
        },
      },
      updateSettings: (updates) =>
        set((state) => {
          // Deep merge aiSettings if they are part of the update
          if (updates.aiSettings) {
            return {
              settings: {
                ...state.settings,
                ...updates,
                aiSettings: {
                  ...state.settings.aiSettings,
                  ...updates.aiSettings,
                  // Ensure toolsEnabled is also merged deeply if provided
                  toolsEnabled: updates.aiSettings.toolsEnabled
                    ? { ...state.settings.aiSettings.toolsEnabled, ...updates.aiSettings.toolsEnabled }
                    : state.settings.aiSettings.toolsEnabled,
                }
              }
            };
          }
          return {
            settings: { ...state.settings, ...updates },
          };
        }),

      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Connected apps
      connectedApps: [],
      addConnectedApp: (app) =>
        set((state) => ({
          connectedApps: [...state.connectedApps, app],
        })),
      removeConnectedApp: (app) =>
        set((state) => ({
          connectedApps: state.connectedApps.filter((a) => a !== app),
        })),

      // Knowledge Base
      knowledgeBase: [],
      addKnowledgeChunks: (chunks) =>
        set((state) => {
          const newKb = [...state.knowledgeBase, ...chunks]

          // Safety check for LocalStorage limit (approx 5MB)
          // We assume ~8000 tokens per chunk approx 32kb? No, embeddings are float[1536] = 6kb each.
          // 1000 chunks = 6MB. 
          const estimatedSize = JSON.stringify(newKb).length
          const limit = 4.5 * 1024 * 1024 // 4.5MB soft limit

          let warning = null
          if (estimatedSize > limit) {
            console.warn('Knowledge Base size exceeds safe LocalStorage limits', estimatedSize)
            warning = 'Knowledge Base is too large for local storage. Some data may not persist.'
          }

          return {
            knowledgeBase: newKb,
            knowledgeBaseStorageWarning: warning
          }
        }),
      clearKnowledgeBase: () => set({ knowledgeBase: [], knowledgeBaseStorageWarning: null }),
      knowledgeBaseStorageWarning: null,
      setKnowledgeBaseStorageWarning: (warning) => set({ knowledgeBaseStorageWarning: warning }),

      // Pending Context (staged integration items)
      pendingContext: [],
      addPendingContext: (context) =>
        set((state) => ({
          pendingContext: [...state.pendingContext, { ...context, id: crypto.randomUUID() }],
        })),
      removePendingContext: (id) =>
        set((state) => ({
          pendingContext: state.pendingContext.filter((c) => c.id !== id),
        })),
      clearPendingContext: () => set({ pendingContext: [] }),

      // Model Management
      availableModels: [],
      setAvailableModels: (models) => set({ availableModels: models }),
      ollamaInstallStatus: 'not_checked',
      setOllamaInstallStatus: (status) => set({ ollamaInstallStatus: status }),

      // Hydration
      hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),

      // Agent Automations Implementation
      agents: [],
      addAgent: (agent) => set((state) => ({
        agents: [
          ...state.agents,
          { ...agent, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        ]
      })),
      updateAgent: (id, updates) => set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a))
      })),
      removeAgent: (id) => set((state) => {
        console.log('[Store] removeAgent called for ID:', id)
        const newAgents = state.agents.filter((a) => a.id !== id)
        console.log('[Store] Agents before:', state.agents.length, 'After:', newAgents.length)
        return {
          agents: newAgents,
          // Deactivate automations that use this agent in any step
          automations: state.automations.map(auto => {
            const usesAgent = auto.pipeline.some(step => step.agentId === id)
            return usesAgent ? { ...auto, isActive: false } : auto
          })
        }
      }),

      automations: [],
      addAutomation: (automation) => set((state) => ({
        automations: [
          ...state.automations,
          { ...automation, id: crypto.randomUUID() }
        ]
      })),
      updateAutomation: (id, updates) => set((state) => ({
        automations: state.automations.map((a) => (a.id === id ? { ...a, ...updates } : a))
      })),
      removeAutomation: (id) => set((state) => {
        console.log('[Store] removeAutomation called for ID:', id)
        return {
          automations: state.automations.filter((a) => a.id !== id),
          runningAutomationIds: state.runningAutomationIds.filter(rid => rid !== id)
        }
      }),
      setRunningAutomationIds: (ids: string[]) => set({ runningAutomationIds: ids }),
      automationProgress: {},
      updateAutomationProgress: (id: string, progress: { current: number, total: number }) => set((state) => ({
        automationProgress: {
          ...state.automationProgress,
          [id]: progress
        }
      })),

      agentLogs: [],
      addAgentLog: (log) => set((state) => ({
        agentLogs: [
          { ...log, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
          ...state.agentLogs
        ].slice(0, 50) // Keep last 50 logs
      })),
      clearAgentLogs: () => set({ agentLogs: [] }),
      vaultPath: null,
      setVaultPath: (path) => set({ vaultPath: path }),
      runningAutomationIds: [],
    }),
    {
      name: 'companion-settings', // Change key to avoid conflict with old localstorage
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        // Only persist these values
        settings: state.settings,
        sidebarCollapsed: state.sidebarCollapsed,
        connectedApps: state.connectedApps,
        files: state.files,
        messages: state.messages,
        knowledgeBase: state.knowledgeBase,
        agents: state.agents,
        automations: state.automations,
        vaultPath: state.vaultPath,
      }),
      // Deep merge to preserve nested aiSettings fields (like API keys)
      merge: (persistedState: any, currentState: AppState) => {
        const merged = { ...currentState, ...persistedState }
        // Deep merge settings.aiSettings to preserve all API keys
        if (persistedState?.settings?.aiSettings && currentState.settings?.aiSettings) {
          merged.settings = {
            ...currentState.settings,
            ...persistedState.settings,
            aiSettings: {
              ...currentState.settings.aiSettings,
              ...persistedState.settings.aiSettings,
              toolsEnabled: {
                ...currentState.settings.aiSettings.toolsEnabled,
                ...persistedState.settings.aiSettings?.toolsEnabled,
              }
            }
          }
        }
        return merged
      },
      onRehydrateStorage: (state) => {
        return (persistedState: any, error) => {
          if (error) {
            console.error('An error occurred during hydration', error)
            return
          }

          if (persistedState && persistedState.settings) {
            const settings = persistedState.settings
            const ai = settings.aiSettings
            let needsUpdate = false
            const updates: any = {}

            // Migration logic
            if (ai && ai.providerType && !ai.intelligenceMode) {
              console.log('Migrating legacy settings to new architecture...')
              updates.aiSettings = {
                ...ai,
                intelligenceMode: ai.providerType === 'local' ? 'standard' : 'premium',
                preferredModelId: ai.providerType === 'local' ? ai.ollamaModel : ai.cloudModel
              }
              needsUpdate = true
            }

            // Cleanup legacy system prompt from user settings
            if (settings.systemPrompt && settings.systemPrompt.includes('**Editor Capability:**')) {
              console.log('Cleaning up legacy system prompt from settings...')
              updates.systemPrompt = 'You are a helpful AI assistant. You can use your tools to help with various tasks, and suggest using the built-in editor for code or long documents.'
              needsUpdate = true
            }

            if (needsUpdate) {
              state.updateSettings(updates)
            }
          }

          state.setHasHydrated(true)
        }
      },
    }
  )
)

// Selector hooks for better performance
export const useMessages = () => useStore((state) => state.messages)
export const useFiles = () => useStore((state) => state.files)
export const useSettings = () => useStore((state) => state.settings)
export const useCurrentView = () => useStore((state) => state.currentView)
