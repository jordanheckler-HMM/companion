# Companion - AI Assistant Platform

A modern, customizable AI assistant desktop application built with React, TypeScript, and Vite. Features a beautiful glassmorphism design and expandable architecture for integrations.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone or download the project
cd companion

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

## 📦 What's Included

### Core Features
- ✅ **Chat Interface** - Beautiful conversation UI with markdown support
- ✅ **File Management** - View, edit, and manage files with glassmorphism cards
- ✅ **Sidebar Navigation** - Collapsible sidebar with smooth transitions
- ✅ **Settings Panel** - Customize theme, colors, and preferences
- ✅ **State Management** - Zustand with localStorage persistence
- ✅ **Glassmorphism Design** - Premium frosted glass effects throughout

### Tech Stack
- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite (lightning fast)
- **Styling:** TailwindCSS with custom utilities
- **UI Components:** shadcn/ui (you own the code)
- **State:** Zustand
- **Markdown:** react-markdown with GFM support
- **Icons:** lucide-react

## 🎨 Customization Guide

### Change Accent Colors

Edit `src/store/store.ts`:
```typescript
settings: {
  theme: 'dark',
  accentColor: 'purple', // Change to: blue, purple, green, orange, pink
  assistantName: 'Atlas', // Rename your assistant
  glassIntensity: 5,
}
```

### Adjust Glassmorphism Intensity

Edit `src/styles/globals.css`:
```css
.glass {
  @apply bg-white/10 backdrop-blur-lg; /* Increase values for stronger glass */
}
```

Or modify in Tailwind config:
```javascript
// tailwind.config.js
glass: {
  bg: 'rgba(255, 255, 255, 0.1)', // Increase for more opacity
}
```

### Add New shadcn/ui Components

```bash
# Install any component from https://ui.shadcn.com
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add select
```

Components are added to `src/components/ui/` - you can edit them directly!

### Theme Customization

Edit `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      primary: '#6366f1', // Your brand color
      // Add custom colors
    }
  }
}
```

### Create Custom Views

1. Create a new component in `src/components/`
2. Add view logic to `src/App.tsx`:

```typescript
{currentView === 'myview' && (
  <MyCustomView />
)}
```

3. Add navigation item in `Sidebar.tsx`:

```typescript
<NavItem
  icon={MyIcon}
  label="My View"
  collapsed={collapsed}
  active={currentView === 'myview'}
  onClick={() => onViewChange?.('myview')}
/>
```

## 📁 Project Structure

```
companion/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components (Button, Dialog, etc.)
│   │   ├── chat/
│   │   │   └── ChatWindow.tsx
│   │   ├── sidebar/
│   │   │   └── Sidebar.tsx
│   │   └── files/
│   │       └── FileCard.tsx
│   ├── lib/
│   │   └── utils.ts         # Utility functions (cn helper)
│   ├── store/
│   │   └── store.ts         # Zustand state management
│   ├── styles/
│   │   └── globals.css      # Global styles + glassmorphism
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🔧 Development Workflow

### Adding New Features

1. **Create Component**
```bash
# Create in appropriate folder
touch src/components/myfeature/MyComponent.tsx
```

2. **Use Zustand State**
```typescript
import { useStore } from '@/store/store'

function MyComponent() {
  const messages = useStore((state) => state.messages)
  const addMessage = useStore((state) => state.addMessage)
  
  // Use state...
}
```

3. **Apply Glassmorphism**
```tsx
<div className="glass rounded-xl p-4">
  {/* Your content */}
</div>
```

### Working with State

```typescript
// In your component
import { useStore } from '@/store/store'

function MyComponent() {
  // Read state
  const messages = useStore((state) => state.messages)
  
  // Update state
  const addMessage = useStore((state) => state.addMessage)
  
  const handleSend = () => {
    addMessage({
      content: 'Hello',
      role: 'user'
    })
  }
}
```

### Adding Integrations

Create integration cards in the Integrations view:

```tsx
<div className="glass-card rounded-xl p-6 text-center">
  <div className="text-4xl mb-3">🔌</div>
  <h3 className="font-semibold mb-2">Your App</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Description
  </p>
  <button 
    onClick={handleConnect}
    className="glass-strong px-4 py-2 rounded-lg text-sm font-medium w-full"
  >
    Connect
  </button>
</div>
```

## 🎯 Next Steps

### Phase 1: MVP (Current)
- ✅ Core UI components built
- ✅ Glassmorphism design implemented
- ✅ State management working
- ☐ Connect to AI backend API
- ☐ Implement file operations
- ☐ Build desktop wrapper (Tauri or Electron)

### Phase 2: Integrations
- ☐ OAuth flow for Google Calendar
- ☐ Notion integration
- ☐ GitHub integration
- ☐ Plugin architecture

### Phase 3: Advanced Features
- ☐ Voice input
- ☐ Code execution environment
- ☐ Team collaboration
- ☐ Custom workflows

## 🔌 Connecting to AI Backend

### Option 1: OpenAI API

Install the SDK:
```bash
npm install openai
```

Update `ChatWindow.tsx`:
```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for development
})

const handleSend = async () => {
  // ... existing code ...
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: input }]
  })
  
  const assistantMessage = response.choices[0].message.content
  // ... add to messages ...
}
```

### Option 2: Custom API

```typescript
const handleSend = async () => {
  const response = await fetch('YOUR_API_URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: input })
  })
  
  const data = await response.json()
  // Handle response...
}
```

## 🎨 Glassmorphism Classes Reference

| Class | Effect | Use Case |
|-------|--------|----------|
| `.glass` | Standard glass | General containers |
| `.glass-light` | Subtle glass | Backgrounds, sidebars |
| `.glass-strong` | Prominent glass | Buttons, active states |
| `.glass-modal` | Heavy glass | Dialogs, overlays |
| `.glass-card` | Card with hover | File cards, items |
| `.glass-message` | Message bubble | Chat messages |
| `.glass-input` | Input bar | Bottom input areas |

## 🛠️ Build for Production

### Web App
```bash
npm run build
```

Output in `dist/` folder.

### Desktop App with Tauri (Smaller bundle)

```bash
# Install Tauri CLI
npm install -D @tauri-apps/cli

# Initialize Tauri
npx tauri init

# Build desktop app
npm run tauri build
```

### Desktop App with Electron (More compatible)

```bash
# Install Electron
npm install -D electron electron-builder

# Create main.js for Electron
# Add build scripts to package.json
# Build
npm run electron:build
```

## 📚 Resources

- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [Vite Guide](https://vitejs.dev/guide/)
- [React Markdown](https://github.com/remarkjs/react-markdown)

## 🐛 Troubleshooting

### Hot reload not working
```bash
# Clear cache
rm -rf node_modules/.vite
npm run dev
```

### TypeScript errors
```bash
# Rebuild types
npx tsc --noEmit
```

### Styles not applying
```bash
# Rebuild Tailwind
npx tailwindcss -i ./src/styles/globals.css -o ./dist/output.css --watch
```

## 💡 Tips

1. **Component Organization** - Keep related components in their own folders
2. **State Management** - Use Zustand selectors for better performance
3. **Glassmorphism** - Don't overuse - use different intensities for hierarchy
4. **TypeScript** - Let types guide you - they prevent bugs
5. **Hot Reload** - Save often to see changes instantly

## 🤝 Contributing

This is your project! Customize it however you want:
- Change colors, fonts, spacing
- Add new views and features
- Integrate with your favorite APIs
- Build plugins and extensions

## 📄 License

This starter project is yours to modify and use however you want.

---

Built with ❤️ for makers who want full control over their AI assistant.
