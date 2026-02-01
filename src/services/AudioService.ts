export class AudioService {
    private mediaRecorder: MediaRecorder | null = null
    private audioChunks: Blob[] = []
    private stream: MediaStream | null = null

    /**
     * Check if microphone permission is granted
     */
    async checkMicrophonePermission(): Promise<{ granted: boolean; message?: string }> {
        try {
            // Try to get permission status if available
            if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })

                if (permissionStatus.state === 'granted') {
                    return { granted: true }
                } else if (permissionStatus.state === 'denied') {
                    return {
                        granted: false,
                        message: 'Microphone access is blocked. Please enable it in your browser settings:\n\n1. Click the lock icon in the address bar\n2. Allow microphone access\n3. Refresh the page and try again'
                    }
                }
            }

            // If permissions API not available or state is 'prompt', return true to attempt access
            return { granted: true }
        } catch (error) {
            console.warn('Could not check microphone permission:', error)
            return { granted: true } // Assume granted and let getUserMedia handle it
        }
    }

    /**
     * Start recording audio from the user's microphone
     */
    async startRecording(): Promise<void> {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                'Microphone not available in this environment. Please rebuild the app with: npm run tauri build, then run the .app from Applications folder.'
            )
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            this.audioChunks = []

            this.mediaRecorder = new MediaRecorder(this.stream)

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data)
                }
            }

            this.mediaRecorder.start()
        } catch (error: any) {
            console.error('Failed to start recording:', error)

            // Provide specific error messages based on the error type
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('Microphone permission denied. Please allow microphone access in your browser settings and try again.')
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                throw new Error('No microphone found. Please connect a microphone and try again.')
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                throw new Error('Microphone is already in use by another application. Please close other apps using the microphone.')
            } else {
                throw new Error(`Microphone error: ${error.message || 'Unable to access microphone'}`)
            }
        }
    }

    /**
     * Stop recording and return the audio blob
     */
    async stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No active recording'))
                return
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
                this.cleanup()
                resolve(audioBlob)
            }

            this.mediaRecorder.stop()
        })
    }

    /**
     * Check if currently recording
     */
    isRecording(): boolean {
        return this.mediaRecorder?.state === 'recording'
    }

    /**
     * Play audio from a buffer or URL
     */
    async playAudio(audioSource: ArrayBuffer | string): Promise<void> {
        return new Promise((resolve, reject) => {
            const audio = new Audio()

            if (typeof audioSource === 'string') {
                audio.src = audioSource
            } else {
                const blob = new Blob([audioSource], { type: 'audio/mpeg' })
                audio.src = URL.createObjectURL(blob)
            }

            audio.onended = () => {
                if (typeof audioSource !== 'string') {
                    URL.revokeObjectURL(audio.src)
                }
                resolve()
            }

            audio.onerror = () => {
                reject(new Error('Failed to play audio'))
            }

            audio.play()
        })
    }

    /**
     * Get list of available macOS voices
     */
    getAvailableVoices(): SpeechSynthesisVoice[] {
        return window.speechSynthesis.getVoices()
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.stream = null
        }
        this.mediaRecorder = null
        this.audioChunks = []
    }
}

export const audioService = new AudioService()
