import { KnowledgeChunk } from '../store'

/**
 * IndexedDB wrapper for knowledge base storage.
 * Embeddings are too large for localStorage (~6KB per chunk).
 * IndexedDB has no practical size limit.
 */
export class KnowledgeBaseDB {
    private dbName = 'companion-knowledge-base'
    private storeName = 'chunks'
    private version = 1
    private db: IDBDatabase | null = null

    /**
     * Open or create the IndexedDB database
     */
    private async open(): Promise<IDBDatabase> {
        if (this.db) return this.db

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version)

            request.onerror = () => {
                console.error('[KnowledgeBaseDB] Failed to open database:', request.error)
                reject(request.error)
            }

            request.onsuccess = () => {
                this.db = request.result
                resolve(request.result)
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
                    store.createIndex('fileId', 'fileId', { unique: false })
                }
            }
        })
    }

    /**
     * Get all chunks from the database
     */
    async getChunks(): Promise<KnowledgeChunk[]> {
        const db = await this.open()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readonly')
            const store = transaction.objectStore(this.storeName)
            const request = store.getAll()

            request.onsuccess = () => {
                resolve(request.result || [])
            }

            request.onerror = () => {
                console.error('[KnowledgeBaseDB] Failed to get chunks:', request.error)
                reject(request.error)
            }
        })
    }

    /**
     * Set all chunks (replaces existing data)
     */
    async setChunks(chunks: KnowledgeChunk[]): Promise<void> {
        const db = await this.open()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite')
            const store = transaction.objectStore(this.storeName)

            // Clear existing data first
            const clearRequest = store.clear()

            clearRequest.onsuccess = () => {
                // Add all new chunks
                let completed = 0
                if (chunks.length === 0) {
                    resolve()
                    return
                }

                for (const chunk of chunks) {
                    const addRequest = store.add(chunk)
                    addRequest.onsuccess = () => {
                        completed++
                        if (completed === chunks.length) {
                            resolve()
                        }
                    }
                    addRequest.onerror = () => {
                        console.error('[KnowledgeBaseDB] Failed to add chunk:', addRequest.error)
                    }
                }
            }

            clearRequest.onerror = () => {
                reject(clearRequest.error)
            }

            transaction.onerror = () => {
                reject(transaction.error)
            }
        })
    }

    /**
     * Add chunks to the database (appends to existing)
     */
    async addChunks(chunks: KnowledgeChunk[]): Promise<void> {
        if (chunks.length === 0) return

        const db = await this.open()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite')
            const store = transaction.objectStore(this.storeName)

            let completed = 0
            let errors = 0

            for (const chunk of chunks) {
                const request = store.put(chunk) // Use put to handle duplicates

                request.onsuccess = () => {
                    completed++
                    if (completed + errors === chunks.length) {
                        if (errors > 0) {
                            console.warn(`[KnowledgeBaseDB] Added ${completed} chunks, ${errors} failed`)
                        }
                        resolve()
                    }
                }

                request.onerror = () => {
                    errors++
                    console.error('[KnowledgeBaseDB] Failed to add chunk:', request.error)
                    if (completed + errors === chunks.length) {
                        resolve()
                    }
                }
            }

            transaction.onerror = () => {
                reject(transaction.error)
            }
        })
    }

    /**
     * Remove chunks by file ID
     */
    async removeChunksByFileId(fileId: string): Promise<void> {
        const db = await this.open()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite')
            const store = transaction.objectStore(this.storeName)
            const index = store.index('fileId')
            const request = index.getAllKeys(fileId)

            request.onsuccess = () => {
                const keys = request.result
                let completed = 0

                if (keys.length === 0) {
                    resolve()
                    return
                }

                for (const key of keys) {
                    const deleteRequest = store.delete(key)
                    deleteRequest.onsuccess = () => {
                        completed++
                        if (completed === keys.length) {
                            resolve()
                        }
                    }
                }
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * Clear all chunks
     */
    async clear(): Promise<void> {
        const db = await this.open()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite')
            const store = transaction.objectStore(this.storeName)
            const request = store.clear()

            request.onsuccess = () => {
                console.log('[KnowledgeBaseDB] Cleared all chunks')
                resolve()
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * Get the count of stored chunks
     */
    async getCount(): Promise<number> {
        const db = await this.open()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readonly')
            const store = transaction.objectStore(this.storeName)
            const request = store.count()

            request.onsuccess = () => {
                resolve(request.result)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    /**
     * Migrate data from localStorage to IndexedDB
     * Call this once on app startup
     */
    async migrateFromLocalStorage(localStorageChunks: KnowledgeChunk[]): Promise<void> {
        if (!localStorageChunks || localStorageChunks.length === 0) {
            return
        }

        const existingCount = await this.getCount()

        // Only migrate if IndexedDB is empty (first-time migration)
        if (existingCount === 0) {
            console.log(`[KnowledgeBaseDB] Migrating ${localStorageChunks.length} chunks from localStorage to IndexedDB`)
            await this.setChunks(localStorageChunks)
            console.log('[KnowledgeBaseDB] Migration complete')
        }
    }
}

// Singleton instance
export const knowledgeBaseDB = new KnowledgeBaseDB()
