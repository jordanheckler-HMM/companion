/**
 * EcosystemService: Manages the shared ~/.hymetalab/ directory
 * for cross-app configuration, data storage, and model registry.
 */

import { homeDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

// Types
export interface GlobalConfig {
  version: string
  user: {
    name: string
  }
  preferences: {
    theme: 'dark' | 'light' | 'system'
    ai_mode: 'local' | 'cloud'
  }
}

export interface ModelRole {
  role: 'chat' | 'embed' | 'vision' | 'code' | 'reasoning'
  primary: boolean
}

export interface ModelEntry {
  id: string
  displayName: string
  provider: 'ollama' | 'openai' | 'anthropic' | 'google'
  type: 'local' | 'cloud'
  roles: ModelRole[]
  capabilities: {
    tools: boolean
    vision: boolean
    streaming: boolean
    maxTokens: number
  }
  status?: 'available' | 'downloading' | 'not_installed'
}

export interface ModelRegistry {
  version: string
  lastUpdated: string
  models: ModelEntry[]
}

const ECOSYSTEM_DIR = '.hymetalab'
const CONFIG_DIR = 'config'
const MODELS_DIR = 'models'
const DATA_DIR = 'data'
const SHARED_DIR = 'shared'
const LOGS_DIR = 'logs'

const GLOBAL_CONFIG_FILE = 'global.json'
const REGISTRY_FILE = 'registry.json'

// App-specific data directories
const APP_DATA_DIRS = ['companion', 'dugout', 'hmm']
const SHARED_MODULES = ['cci-bus']

export class EcosystemService {
  private static instance: EcosystemService
  private basePath: string | null = null
  private initialized = false

  private constructor() {}

  public static getInstance(): EcosystemService {
    if (!EcosystemService.instance) {
      EcosystemService.instance = new EcosystemService()
    }
    return EcosystemService.instance
  }

  /**
   * Get the base path for the ecosystem directory
   */
  public async getBasePath(): Promise<string> {
    if (this.basePath) return this.basePath
    const home = await homeDir()
    this.basePath = await join(home, ECOSYSTEM_DIR)
    return this.basePath
  }

  /**
   * Get the path to app-specific data directory
   */
  public async getAppDataPath(appName: 'companion' | 'dugout' | 'hmm' = 'companion'): Promise<string> {
    const base = await this.getBasePath()
    return await join(base, DATA_DIR, appName)
  }

  /**
   * Get the path to the config directory
   */
  public async getConfigPath(): Promise<string> {
    const base = await this.getBasePath()
    return await join(base, CONFIG_DIR)
  }

  /**
   * Get the path to the models directory
   */
  public async getModelsPath(): Promise<string> {
    const base = await this.getBasePath()
    return await join(base, MODELS_DIR)
  }

  /**
   * Get the path to the shared directory
   */
  public async getSharedPath(): Promise<string> {
    const base = await this.getBasePath()
    return await join(base, SHARED_DIR)
  }

  /**
   * Get the path to the logs directory
   */
  public async getLogsPath(): Promise<string> {
    const base = await this.getBasePath()
    return await join(base, LOGS_DIR)
  }

  /**
   * Check if the ecosystem directory exists
   */
  public async ecosystemExists(): Promise<boolean> {
    try {
      const base = await this.getBasePath()
      return await exists(base)
    } catch (e) {
      console.error('[EcosystemService] Error checking ecosystem existence:', e)
      return false
    }
  }

  /**
   * Initialize the ecosystem directory structure
   * Creates all required directories and default config files
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      console.log('[EcosystemService] Already initialized')
      return true
    }

    console.log('[EcosystemService] Initializing ecosystem...')

    try {
      const base = await this.getBasePath()
      const ecosystemPresent = await exists(base)

      if (!ecosystemPresent) {
        console.log('[EcosystemService] Creating ecosystem directory structure...')

        // Create base directory
        await mkdir(base, { recursive: true })

        // Create config directory and global.json
        const configPath = await this.getConfigPath()
        await mkdir(configPath, { recursive: true })
        await this.createDefaultGlobalConfig()

        // Create models directory and registry.json
        const modelsPath = await this.getModelsPath()
        await mkdir(modelsPath, { recursive: true })
        await this.createDefaultModelRegistry()

        // Create app data directories
        for (const app of APP_DATA_DIRS) {
          const appDataPath = await join(base, DATA_DIR, app)
          await mkdir(appDataPath, { recursive: true })
        }

        // Create shared module directories
        for (const module of SHARED_MODULES) {
          const sharedModulePath = await join(base, SHARED_DIR, module)
          await mkdir(sharedModulePath, { recursive: true })
        }

        // Create logs directory
        const logsPath = await this.getLogsPath()
        await mkdir(logsPath, { recursive: true })

        console.log('[EcosystemService] Ecosystem directory structure created successfully')
      } else {
        console.log('[EcosystemService] Ecosystem directory already exists')
        // Ensure all subdirectories exist (for upgrade scenarios)
        await this.ensureDirectoryStructure()
      }

      this.initialized = true
      return true
    } catch (e) {
      console.error('[EcosystemService] Failed to initialize ecosystem:', e)
      return false
    }
  }

  /**
   * Ensure all subdirectories exist (useful for upgrades)
   */
  private async ensureDirectoryStructure(): Promise<void> {
    const base = await this.getBasePath()

    // Config
    const configPath = await this.getConfigPath()
    if (!(await exists(configPath))) {
      await mkdir(configPath, { recursive: true })
    }

    // Models
    const modelsPath = await this.getModelsPath()
    if (!(await exists(modelsPath))) {
      await mkdir(modelsPath, { recursive: true })
    }

    // App data directories
    for (const app of APP_DATA_DIRS) {
      const appDataPath = await join(base, DATA_DIR, app)
      if (!(await exists(appDataPath))) {
        await mkdir(appDataPath, { recursive: true })
      }
    }

    // Shared
    for (const module of SHARED_MODULES) {
      const sharedModulePath = await join(base, SHARED_DIR, module)
      if (!(await exists(sharedModulePath))) {
        await mkdir(sharedModulePath, { recursive: true })
      }
    }

    // Logs
    const logsPath = await this.getLogsPath()
    if (!(await exists(logsPath))) {
      await mkdir(logsPath, { recursive: true })
    }
  }

  /**
   * Create the default global.json config file
   */
  private async createDefaultGlobalConfig(): Promise<void> {
    const configPath = await this.getConfigPath()
    const globalConfigPath = await join(configPath, GLOBAL_CONFIG_FILE)

    const defaultConfig: GlobalConfig = {
      version: '1.0',
      user: {
        name: ''
      },
      preferences: {
        theme: 'dark',
        ai_mode: 'local'
      }
    }

    await writeTextFile(globalConfigPath, JSON.stringify(defaultConfig, null, 2))
    console.log('[EcosystemService] Created default global.json')
  }

  /**
   * Create the default registry.json with core models
   */
  private async createDefaultModelRegistry(): Promise<void> {
    const modelsPath = await this.getModelsPath()
    const registryPath = await join(modelsPath, REGISTRY_FILE)

    const defaultRegistry: ModelRegistry = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      models: [
        {
          id: 'hymetalab/lumora-lite',
          displayName: 'Lumora Lite',
          provider: 'ollama',
          type: 'local',
          roles: [{ role: 'chat', primary: true }],
          capabilities: {
            tools: true,
            vision: false,
            streaming: true,
            maxTokens: 8192
          },
          status: 'available'
        },
        {
          id: 'nomic-embed-text',
          displayName: 'Nomic Embed Text',
          provider: 'ollama',
          type: 'local',
          roles: [{ role: 'embed', primary: true }],
          capabilities: {
            tools: false,
            vision: false,
            streaming: false,
            maxTokens: 8192
          },
          status: 'available'
        },
        {
          id: 'llava',
          displayName: 'LLaVA',
          provider: 'ollama',
          type: 'local',
          roles: [{ role: 'vision', primary: true }],
          capabilities: {
            tools: false,
            vision: true,
            streaming: true,
            maxTokens: 4096
          },
          status: 'not_installed'
        },
        {
          id: 'deepseek-coder-v2',
          displayName: 'DeepSeek Coder V2',
          provider: 'ollama',
          type: 'local',
          roles: [{ role: 'code', primary: true }],
          capabilities: {
            tools: true,
            vision: false,
            streaming: true,
            maxTokens: 16384
          },
          status: 'not_installed'
        }
      ]
    }

    await writeTextFile(registryPath, JSON.stringify(defaultRegistry, null, 2))
    console.log('[EcosystemService] Created default registry.json')
  }

  /**
   * Read the global config
   */
  public async getGlobalConfig(): Promise<GlobalConfig | null> {
    try {
      const configPath = await this.getConfigPath()
      const globalConfigPath = await join(configPath, GLOBAL_CONFIG_FILE)

      if (!(await exists(globalConfigPath))) {
        console.log('[EcosystemService] global.json does not exist')
        return null
      }

      const content = await readTextFile(globalConfigPath)
      return JSON.parse(content) as GlobalConfig
    } catch (e) {
      console.error('[EcosystemService] Failed to read global config:', e)
      return null
    }
  }

  /**
   * Update the global config
   */
  public async updateGlobalConfig(updates: Partial<GlobalConfig>): Promise<boolean> {
    try {
      const current = await this.getGlobalConfig()
      if (!current) return false

      const updated = {
        ...current,
        ...updates,
        user: { ...current.user, ...(updates.user || {}) },
        preferences: { ...current.preferences, ...(updates.preferences || {}) }
      }

      const configPath = await this.getConfigPath()
      const globalConfigPath = await join(configPath, GLOBAL_CONFIG_FILE)
      await writeTextFile(globalConfigPath, JSON.stringify(updated, null, 2))

      console.log('[EcosystemService] Updated global config')
      return true
    } catch (e) {
      console.error('[EcosystemService] Failed to update global config:', e)
      return false
    }
  }

  /**
   * Read the model registry
   */
  public async getModelRegistry(): Promise<ModelRegistry | null> {
    try {
      const modelsPath = await this.getModelsPath()
      const registryPath = await join(modelsPath, REGISTRY_FILE)

      if (!(await exists(registryPath))) {
        console.log('[EcosystemService] registry.json does not exist')
        return null
      }

      const content = await readTextFile(registryPath)
      return JSON.parse(content) as ModelRegistry
    } catch (e) {
      console.error('[EcosystemService] Failed to read model registry:', e)
      return null
    }
  }

  /**
   * Update the model registry
   */
  public async updateModelRegistry(registry: ModelRegistry): Promise<boolean> {
    try {
      const modelsPath = await this.getModelsPath()
      const registryPath = await join(modelsPath, REGISTRY_FILE)

      registry.lastUpdated = new Date().toISOString()
      await writeTextFile(registryPath, JSON.stringify(registry, null, 2))

      console.log('[EcosystemService] Updated model registry')
      return true
    } catch (e) {
      console.error('[EcosystemService] Failed to update model registry:', e)
      return false
    }
  }

  /**
   * Get models by role from the registry
   */
  public async getModelsByRole(role: ModelRole['role']): Promise<ModelEntry[]> {
    const registry = await this.getModelRegistry()
    if (!registry) return []

    return registry.models.filter(m => m.roles.some(r => r.role === role))
  }

  /**
   * Get the primary model for a specific role
   */
  public async getPrimaryModel(role: ModelRole['role']): Promise<ModelEntry | null> {
    const registry = await this.getModelRegistry()
    if (!registry) return null

    return registry.models.find(m => 
      m.roles.some(r => r.role === role && r.primary)
    ) || null
  }

  /**
   * Check if registry.json exists (for backward compatibility check)
   */
  public async registryExists(): Promise<boolean> {
    try {
      const modelsPath = await this.getModelsPath()
      const registryPath = await join(modelsPath, REGISTRY_FILE)
      return await exists(registryPath)
    } catch (e) {
      return false
    }
  }

  /**
   * Write data to app-specific storage
   */
  public async writeAppData(
    filename: string,
    data: unknown,
    app: 'companion' | 'dugout' | 'hmm' = 'companion'
  ): Promise<boolean> {
    try {
      const appDataPath = await this.getAppDataPath(app)
      const filePath = await join(appDataPath, filename)
      
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      await writeTextFile(filePath, content)
      
      return true
    } catch (e) {
      console.error(`[EcosystemService] Failed to write app data (${filename}):`, e)
      return false
    }
  }

  /**
   * Read data from app-specific storage
   */
  public async readAppData<T>(
    filename: string, 
    app: 'companion' | 'dugout' | 'hmm' = 'companion'
  ): Promise<T | null> {
    try {
      const appDataPath = await this.getAppDataPath(app)
      const filePath = await join(appDataPath, filename)

      if (!(await exists(filePath))) {
        return null
      }

      const content = await readTextFile(filePath)
      return JSON.parse(content) as T
    } catch (e) {
      console.error(`[EcosystemService] Failed to read app data (${filename}):`, e)
      return null
    }
  }

  /**
   * Log a message to the ecosystem logs
   */
  public async log(app: string, level: 'info' | 'warn' | 'error', message: string): Promise<void> {
    try {
      const logsPath = await this.getLogsPath()
      const date = new Date().toISOString().split('T')[0]
      const logFile = await join(logsPath, `${app}-${date}.log`)
      
      const timestamp = new Date().toISOString()
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
      
      // Read existing content and append
      let existing = ''
      try {
        if (await exists(logFile)) {
          existing = await readTextFile(logFile)
        }
      } catch {
        // File doesn't exist yet
      }
      
      await writeTextFile(logFile, existing + logEntry)
    } catch (e) {
      console.error('[EcosystemService] Failed to write log:', e)
    }
  }
}

// Export singleton instance
export const ecosystemService = EcosystemService.getInstance()
