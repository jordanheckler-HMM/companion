import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useStore } from '../store'

// To be populated from environment variables or settings
let supabase: SupabaseClient | null = null

export const SupabaseService = {
    /**
     * Initialize Supabase client
     * Should be called on app startup if keys are present
     */
    initialize: (url: string, key: string) => {
        if (!url || !key) return null

        try {
            supabase = createClient(url, key)

            // key listener for auth changes
            supabase.auth.onAuthStateChange((event, session) => {
                useStore.getState().setSupabaseSession(session)

                if (event === 'SIGNED_OUT') {
                    useStore.getState().setSupabaseSession(null)
                }
            })

            return supabase
        } catch (error) {
            console.error('Failed to initialize Supabase:', error)
            return null
        }
    },

    getClient: () => supabase,

    /**
     * Auth Methods
     */
    signUp: async (email: string, password: string) => {
        if (!supabase) throw new Error('Supabase not initialized')
        return await supabase.auth.signUp({ email, password })
    },

    signIn: async (email: string, password: string) => {
        if (!supabase) throw new Error('Supabase not initialized')
        return await supabase.auth.signInWithPassword({ email, password })
    },

    signOut: async () => {
        if (!supabase) throw new Error('Supabase not initialized')
        return await supabase.auth.signOut()
    },

    /**
     * Agent Store Methods
     */
    getAgents: async (sortBy: 'downloads' | 'recent' = 'downloads', limit = 20) => {
        if (!supabase) return { data: [], error: { message: 'Not connected' } }

        let query = supabase
            .from('agent_store')
            .select('*')
            .eq('is_public', true)
            .limit(limit)

        if (sortBy === 'downloads') {
            query = query.order('downloads', { ascending: false })
        } else {
            query = query.order('created_at', { ascending: false })
        }

        return await query
    },

    getAgentById: async (id: string) => {
        if (!supabase) return { data: null, error: { message: 'Not connected' } }
        return await supabase.from('agent_store').select('*').eq('id', id).single()
    },

    publishAgent: async (agentData: any) => {
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user
        if (!user) throw new Error('Must be signed in to publish')

        return await supabase.from('agent_store').insert({
            ...agentData,
            author_id: user.id,
            downloads: 0,
            is_public: true
        })
    },

    /**
     * Utility to check if configured
     */
    isConfigured: () => {
        return !!supabase
    }
}
