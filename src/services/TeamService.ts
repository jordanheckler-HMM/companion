import { SupabaseService } from './SupabaseService'

export interface Team {
    id: string
    name: string
    owner_id: string
    created_at: string
}

export interface TeamMember {
    team_id: string
    user_id: string
    role: 'admin' | 'member'
    joined_at: string
    profile?: {
        username: string
        avatar_url: string | null
        email: string
    }
}

export interface TeamThread {
    id: string
    team_id: string
    name: string
    created_by: string
    created_at: string
}

export interface TeamMessage {
    id: string
    thread_id: string
    sender_id: string | null
    sender_type: 'human' | 'agent' | 'model'
    sender_name: string
    content: string
    metadata: Record<string, any>
    created_at: string
}

export interface Profile {
    id: string
    username: string
    avatar_url: string | null
    email: string
}

export const TeamService = {
    // ============ TEAMS ============

    /**
     * Create a new team (current user becomes owner/admin)
     */
    createTeam: async (name: string): Promise<Team | null> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user
        if (!user) throw new Error('Must be signed in to create a team')

        const { data, error } = await supabase
            .from('teams')
            .insert({ name, owner_id: user.id })
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Get all teams the current user belongs to
     */
    getMyTeams: async (): Promise<Team[]> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return []

        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching teams:', error)
            return []
        }
        return data || []
    },

    /**
     * Update a team's name (owner only)
     */
    updateTeam: async (teamId: string, name: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('teams')
            .update({ name })
            .eq('id', teamId)

        if (error) throw error
    },

    /**
     * Delete a team (owner only)
     */
    deleteTeam: async (teamId: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId)

        if (error) throw error
    },

    /**
     * Leave a team (for non-owners)
     */
    leaveTeam: async (teamId: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user
        if (!user) throw new Error('Must be signed in')

        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', user.id)

        if (error) throw error
    },

    /**
     * Get current user ID
     */
    getCurrentUserId: async (): Promise<string | null> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return null

        const user = (await supabase.auth.getUser()).data.user
        return user?.id || null
    },

    /**
     * Get team members with their profiles
     */
    getTeamMembers: async (teamId: string): Promise<TeamMember[]> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return []

        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                profile:profiles(username, avatar_url, email)
            `)
            .eq('team_id', teamId)

        if (error) {
            console.error('Error fetching team members:', error)
            return []
        }
        return data || []
    },

    /**
     * Invite a user to a team by email
     */
    inviteMember: async (teamId: string, email: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        // First find the user by email in profiles
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single()

        if (profileError || !profile) {
            throw new Error('User not found. They must sign up first.')
        }

        // Add them to the team
        const { error } = await supabase
            .from('team_members')
            .insert({ team_id: teamId, user_id: profile.id, role: 'member' })

        if (error) {
            if (error.code === '23505') {
                throw new Error('User is already a member of this team')
            }
            throw error
        }
    },

    /**
     * Remove a member from a team
     */
    removeMember: async (teamId: string, userId: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', userId)

        if (error) throw error
    },

    /**
     * Update a member's role (owner only)
     */
    updateMemberRole: async (teamId: string, userId: string, role: 'admin' | 'member'): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('team_members')
            .update({ role })
            .eq('team_id', teamId)
            .eq('user_id', userId)

        if (error) throw error
    },

    // ============ THREADS ============

    /**
     * Create a new thread in a team
     */
    createThread: async (teamId: string, name: string): Promise<TeamThread | null> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user
        if (!user) throw new Error('Must be signed in')

        const { data, error } = await supabase
            .from('team_threads')
            .insert({ team_id: teamId, name, created_by: user.id })
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Get all threads in a team
     */
    getThreads: async (teamId: string): Promise<TeamThread[]> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return []

        const { data, error } = await supabase
            .from('team_threads')
            .select('*')
            .eq('team_id', teamId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching threads:', error)
            return []
        }
        return data || []
    },

    /**
     * Update a thread's name
     */
    updateThread: async (threadId: string, name: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('team_threads')
            .update({ name })
            .eq('id', threadId)

        if (error) throw error
    },

    /**
     * Delete a thread
     */
    deleteThread: async (threadId: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('team_threads')
            .delete()
            .eq('id', threadId)

        if (error) throw error
    },

    // ============ MESSAGES ============

    /**
     * Send a message to a thread
     */
    sendMessage: async (
        threadId: string,
        content: string,
        senderType: 'human' | 'agent' | 'model',
        senderName?: string,
        metadata?: Record<string, any>
    ): Promise<TeamMessage | null> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user
        const senderId = senderType === 'human' ? user?.id : null

        // Get sender name from profile if human
        let name = senderName
        if (senderType === 'human' && user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single()
            name = profile?.username || user.email?.split('@')[0] || 'Unknown'
        }

        const { data, error } = await supabase
            .from('team_messages')
            .insert({
                thread_id: threadId,
                sender_id: senderId,
                sender_type: senderType,
                sender_name: name,
                content,
                metadata: metadata || {}
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Get messages in a thread
     */
    getMessages: async (threadId: string, limit = 50): Promise<TeamMessage[]> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return []

        const { data, error } = await supabase
            .from('team_messages')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true })
            .limit(limit)

        if (error) {
            console.error('Error fetching messages:', error)
            return []
        }
        return data || []
    },

    /**
     * Subscribe to real-time messages in a thread
     */
    subscribeToThread: (threadId: string, onMessage: (message: TeamMessage) => void) => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return null

        const channel = supabase
            .channel(`thread:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'team_messages',
                    filter: `thread_id=eq.${threadId}`
                },
                (payload) => {
                    onMessage(payload.new as TeamMessage)
                }
            )
            .subscribe()

        return channel
    },

    // ============ TEAM KNOWLEDGE (VAULT) ============

    /**
     * Add content to team vault
     */
    indexToTeamVault: async (
        teamId: string,
        content: string,
        source: string,
        embedding?: number[]
    ): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user

        const { error } = await supabase
            .from('team_knowledge')
            .insert({
                team_id: teamId,
                content,
                source,
                embedding,
                created_by: user?.id
            })

        if (error) throw error
    },

    /**
     * Search team vault using vector similarity
     */
    searchTeamVault: async (teamId: string, queryEmbedding: number[], limit = 5): Promise<any[]> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return []

        // Use Supabase's built-in vector similarity function
        const { data, error } = await supabase.rpc('match_team_knowledge', {
            query_embedding: queryEmbedding,
            team_id_filter: teamId,
            match_threshold: 0.7,
            match_count: limit
        })

        if (error) {
            console.error('Team vault search error:', error)
            return []
        }

        return data || []
    },

    /**
     * Get team vault sources (for display)
     */
    getTeamVaultSources: async (teamId: string): Promise<string[]> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return []

        const { data, error } = await supabase
            .from('team_knowledge')
            .select('source')
            .eq('team_id', teamId)

        if (error) {
            console.error('Error fetching vault sources:', error)
            return []
        }

        // Return unique sources
        const sources = [...new Set((data || []).map(d => d.source).filter(Boolean))]
        return sources as string[]
    },

    /**
     * Delete a source from the team vault
     */
    deleteTeamVaultSource: async (teamId: string, sourceName: string): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const { error } = await supabase
            .from('team_knowledge')
            .delete()
            .eq('team_id', teamId)
            .eq('source', sourceName)

        if (error) throw error
    },

    // ============ PROFILES ============

    /**
     * Get or create current user's profile
     */
    getMyProfile: async (): Promise<Profile | null> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) return null

        const user = (await supabase.auth.getUser()).data.user
        if (!user) return null

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error)
        }

        return data
    },

    /**
     * Update current user's profile
     */
    updateProfile: async (updates: { username?: string; avatar_url?: string }): Promise<void> => {
        const supabase = SupabaseService.getClient()
        if (!supabase) throw new Error('Supabase not initialized')

        const user = (await supabase.auth.getUser()).data.user
        if (!user) throw new Error('Must be signed in')

        const { error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, ...updates })

        if (error) throw error
    }
}
