# Refactoring Checklist & Best Practices

## ✅ Completed Refactoring Tasks

### Custom Component Replacements
- [x] **Context Menu** - Replaced custom positioned menu with shadcn ContextMenu wrapper
- [x] **Inline Input** - Simplified with standard Tailwind utility classes
- [x] **File Tabs Scrollbar** - Moved to centralized CSS class in globals.css
- [x] **Landing Page Cards** - Created and implemented shadcn Card component
- [x] **Verified** - No direct Radix UI imports in application code

### Code Reduction Achievements
- [x] Removed 44% of lines from context-menu.tsx (86 → 48 lines)
- [x] Eliminated inline `<style>` tags from components
- [x] Centralized scrollbar styling in single location
- [x] Created reusable Card component for consistent UI

## 📋 Development Guidelines Going Forward

### UI Component Usage Rules

#### ✅ DO:
```tsx
// Use shadcn/ui components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

// Use Tailwind for styling
<div className="flex items-center gap-2 p-4">Content</div>

// Use CSS variables via Tailwind
className="bg-background text-foreground border border-border"

// Compose components for complex layouts
<Card>
  <CardContent className="pt-6">
    Content here
  </CardContent>
</Card>
```

#### ❌ DON'T:
```tsx
// Don't import directly from @radix-ui
import { Button as RadixButton } from "@radix-ui/react-button";

// Don't create custom styled divs for card-like UI
<div className="border p-6 rounded-lg">Card content</div>

// Don't use inline styles for static styling
<div style={{ padding: "24px", borderRadius: "8px" }}>

// Don't create custom wrapper components unnecessarily
const CustomButton = styled.button`
  background: blue;
  ...
`;
```

### Component Patterns to Follow

#### Context Menu Pattern (Recommended for right-click menus)
```tsx
import { FileContextMenu } from "./context-menu";

<FileContextMenu
  onRename={handleRename}
  onDelete={handleDelete}
  isFolder={node.type === 'folder'}
>
  <div className="flex items-center">Item</div>
</FileContextMenu>
```

#### Dialog Pattern (Use for modals/confirmations)
```tsx
import { Dialog, DialogContent, DialogTrigger } from "@/shared/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    Dialog content
  </DialogContent>
</Dialog>
```

#### Card Pattern (Use for grouped content)
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>
```

### CSS Guidelines

#### Use Tailwind Classes First
```tsx
// Good - Use Tailwind
<div className="flex items-center gap-4 p-4 rounded-lg border bg-card">

// Avoid - Unnecessary custom CSS unless truly needed
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem',
}}>
```

#### Dynamic Styles (Acceptable uses of inline styles)
```tsx
// Good - Dynamic values based on props/state
<div style={{ paddingLeft: `${level * 12 + 8}px` }}>

// Keep calculations in data attributes for complex logic
<div data-level={level} className="nested-item">
```

#### Cross-browser Support
```tsx
// Use CSS variables via globals.css for theme values
.dark {
  --background: 210 9% 11%;
  --foreground: 220 14% 91%;
}

// Scrollbar styling goes in globals.css
.tabs-scrollbar::-webkit-scrollbar { ... }
```

### Available shadcn/ui Components

Currently available in `shared/components/ui/`:
- ✅ Button - Primary interactive element
- ✅ Card - Container for grouped content
- ✅ ContextMenu - Right-click menu
- ✅ Dialog - Modal dialogs
- ✅ DropdownMenu - Dropdown menus
- ✅ Input - Form input
- ✅ Label - Form labels
- ✅ Separator - Visual divider
- ✅ Tabs - Tabbed interface
- ✅ Tooltip - Hover tooltips

### Future Component Additions

When needed, add these shadcn components:
- [ ] Alert - Alert messages
- [ ] Badge - Status badges
- [ ] Scroll Area - Custom scrollbars
- [ ] Select - Dropdown select
- [ ] Checkbox - Checkboxes
- [ ] RadioGroup - Radio buttons
- [ ] Textarea - Multi-line input

## 🎯 Key Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Custom components | 2 (context-menu, inline-input) | 0 | -100% |
| Inline style tags | 2 | 0 | -100% |
| Lines in context-menu | 86 | 48 | -44% |
| Direct Radix imports | Yes | No | ✅ |
| Reusable UI components | 8 | 9 | +1 |

## 🚀 Performance Impact

- **Bundle size:** Slight reduction (removed custom CSS)
- **Runtime:** No change (shadcn uses same Radix primitives)
- **Developer experience:** Improved (consistent patterns)
- **Maintenance:** Easier (single source of truth)

## 📚 Resources

- shadcn/ui Documentation: https://ui.shadcn.com
- Radix UI Primitives: https://www.radix-ui.com
- Tailwind CSS: https://tailwindcss.com
- Project Config: `components.json`

## 🔍 Code Review Checklist

When reviewing PRs, ensure:
- [ ] Components use shadcn/ui from `@/shared/components/ui`
- [ ] No direct `@radix-ui` imports outside of ui/ folder
- [ ] Styling uses Tailwind + CSS variables, not inline styles
- [ ] No custom styled components created without justification
- [ ] Card component used for card-like layouts
- [ ] Proper composition of available components
- [ ] CSS changes in globals.css, not scoped to components

## Questions?

For questions about this refactoring:
1. Check REFACTORING_SUMMARY.md for detailed changes
2. Review existing component patterns in shared/components/ui/
3. Refer to shadcn/ui documentation for component APIs
4. Check landing-page.tsx for Card usage example
