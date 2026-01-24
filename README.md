# MDNotes Viewer

A modern, VSCode-inspired markdown documentation viewer built with Next.js 16, featuring a powerful WYSIWYG editor powered by **Milkdown Crepe**.

## ✨ Features

### 🎨 Professional UI
- **VSCode-like interface** with three-panel layout
- **Resizable panels** (file explorer, editor, table of contents)
- **Dark/Light theme** with smooth transitions
- **File tabs** with close functionality
- **Status indicators** (save status, timestamps)

### 📝 Milkdown Crepe Editor
All features from the [Milkdown Playground](https://milkdown.dev/playground) are enabled:

- ✅ **WYSIWYG editing** with visual toolbar
- ✅ **Slash commands** (/) for quick insertions
- ✅ **Drag-and-drop** block management
- ✅ **Syntax highlighting** with CodeMirror
- ✅ **Enhanced tables** with drag-and-drop rows/columns
- ✅ **Image upload** with resizing and captions
- ✅ **Link tooltips** with preview and copy
- ✅ **Todo lists** with checkboxes
- ✅ **LaTeX equations** (inline and block)
- ✅ **Auto-save** (2-second debounce)
- ✅ **Placeholder text**
- ✅ **Enhanced cursor** feedback

See [CREPE_FEATURES.md](./CREPE_FEATURES.md) for detailed documentation.

### 📂 File Management
- **Tree-based file explorer** with `react-complex-tree`
- **Context menu** operations (rename, delete, create)
- **Inline editing** for file/folder names
- **Multiple file support** with tabs
- **Auto-save** on content changes

### 📚 Markdown Support
- **GitHub Flavored Markdown** (GFM)
- **Code blocks** with syntax highlighting
- **Tables** with full editing capabilities
- **Lists** (bullet, ordered, todo)
- **Images** with drag-and-drop
- **Links** with tooltips
- **Math equations** with KaTeX

### 📑 Table of Contents
- **Auto-generated** from document headings
- **Active section** highlighting on scroll
- **Smooth scrolling** to sections
- **Collapsible** sidebar

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20+)
- Yarn package manager

### Installation

```bash
# Install dependencies
yarn install

# Start development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Project Structure

```
mdnotes-viewer/
├── app/                    # Next.js app router
│   ├── api/               # API routes (file operations)
│   ├── globals.css        # Global styles and Crepe customization
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── features/              # Feature-based modules
│   ├── file-explorer/     # File tree navigation
│   ├── markdown-editor/   # Milkdown Crepe editor
│   └── markdown-preview/  # Markdown rendering & TOC
├── shared/                # Shared components
│   ├── components/        # Reusable UI components
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── core/                  # Core configuration
│   ├── config/           # Feature flags
│   └── store/            # Global state (Zustand)
└── content/              # Markdown files
```

## 📖 Usage

### Keyboard Shortcuts

**Editor:**
- `Cmd/Ctrl + B` - Bold
- `Cmd/Ctrl + I` - Italic
- `Cmd/Ctrl + K` - Insert link
- `Cmd/Ctrl + S` - Save file
- `/` - Open slash command menu

**Navigation:**
- Toggle panels with toolbar buttons
- Switch between views (Editor/Preview/Code)
- Click TOC items for quick navigation

### Slash Commands

Press `/` in the editor to open the command menu:
- `/heading` - Insert heading (H1-H6)
- `/code` - Insert code block
- `/table` - Insert table
- `/image` - Insert image
- `/list` - Insert list
- `/todo` - Insert todo list
- And more...

### Creating Content

1. **Create a file** - Right-click in file explorer → New File
2. **Write content** - Use the Crepe editor with full WYSIWYG support
3. **Auto-save** - Changes are saved automatically after 2 seconds
4. **Preview** - Switch to preview mode to see rendered markdown

## 🛠️ Technology Stack

- **Framework**: Next.js 16.1.4 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5
- **Package Manager**: Yarn (fast development)
- **Styling**: Tailwind CSS 4
- **Editor**: Milkdown Crepe 7.18.0
- **State**: Zustand 5.0.10
- **UI Components**: Radix UI + Custom
- **File Tree**: react-complex-tree 2.6.1
- **Panels**: react-resizable-panels 2.0.0

## 📋 Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development plan.

**Recently Completed:**
- ✅ Milkdown Crepe editor with all playground features
- ✅ Three-panel VSCode-like layout
- ✅ File explorer with CRUD operations
- ✅ Auto-save functionality
- ✅ Theme system (light/dark)
- ✅ Table of contents with scroll sync

**Next Steps:**
- [ ] Mermaid diagram support (experimental)
- [ ] Full-text search
- [ ] Split view mode
- [ ] Collaborative editing
- [ ] Export functionality

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is MIT licensed.

## 🙏 Acknowledgments

- [Milkdown](https://milkdown.dev/) - Amazing WYSIWYG markdown editor
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Zustand](https://github.com/pmndrs/zustand) - State management

---

**Last Updated**: January 25, 2026
**Version**: 1.1.0

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
