# shadcn/ui Integration Guide

## Overview

MDNotes Viewer now uses **shadcn/ui** components for a consistent, accessible, and maintainable UI. shadcn/ui is not a traditional component library - it provides copy-paste components built on Radix UI primitives with Tailwind CSS styling.

## Architecture

### Component Library Stack
1. **Radix UI** - Unstyled, accessible component primitives
2. **Tailwind CSS** - Utility-first styling
3. **class-variance-authority (CVA)** - Component variant management
4. **shadcn/ui pattern** - Customizable components you own

### Installed shadowcn/ui Components

Located in `shared/components/ui/`:

- ✅ **Button** - Actions and clickable elements
- ✅ **Separator** - Visual dividers
- ✅ **Dialog** - Modal dialogs and confirmations
- ✅ **Input** - Text input fields
- ✅ **Label** - Form labels
- ✅ **DropdownMenu** - Dropdown menus and actions

## Configuration

### components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/shared/components",
    "utils": "@/shared/utils",
    "ui": "@/shared/components/ui"
  }
}
```

### Installed Radix UI Packages

```json
{
  "@radix-ui/react-separator": "^1.1.8",
  "@radix-ui/react-dialog": "^1.x.x",
  "@radix-ui/react-label": "^2.x.x",
  "@radix-ui/react-dropdown-menu": "^2.x.x",
  "@radix-ui/react-slot": "^1.x.x"
}
```

## Adding New Components

### Method 1: Using shadcn CLI (Recommended)

```bash
# Install shadcn CLI globally (if not installed)
npx shadcn@latest init

# Add a new component
npx shadcn@latest add <component-name>

# Examples:
npx shadcn@latest add select
npx shadcn@latest add checkbox
npx shadcn@latest add tooltip
```

### Method 2: Manual Installation

1. Check component dependencies at https://ui.shadcn.com/docs/components/
2. Install required Radix UI packages:
   ```bash
   yarn add @radix-ui/react-<component>
   ```
3. Copy component code from shadcn/ui docs
4. Place in `shared/components/ui/<component>.tsx`
5. Update imports to use project aliases

## Component Usage

### Button

```tsx
import { Button } from "@/shared/components/ui/button";

// Basic usage
<Button>Click me</Button>

// With variants
<Button variant="destructive">Delete</Button>
<Button variant="ghost" size="icon">
  <Icon />
</Button>

// As child (asChild pattern)
<Button asChild>
  <a href="/path">Link styled as button</a>
</Button>
```

### Dialog

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

function MyDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        <div>Content goes here</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Input

```tsx
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

function MyForm() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        placeholder="Enter your email"
      />
    </div>
  );
}
```

### DropdownMenu

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Button } from "@/shared/components/ui/button";

function MyDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleEdit}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Customization

### Modifying Existing Components

shadcn/ui components are meant to be customized. Since they're in your codebase, you can:

1. **Add variants** - Extend CVA variants in component files
2. **Modify styling** - Adjust Tailwind classes directly
3. **Add features** - Extend component functionality

Example - Adding a new Button variant:

```tsx
// shared/components/ui/button.tsx
const buttonVariants = cva(
  "...",
  {
    variants: {
      variant: {
        // ... existing variants
        custom: "bg-custom text-custom-foreground hover:bg-custom/90",
      },
    },
  }
);
```

### Creating Custom Components

For feature-specific components, compose shadcn/ui primitives:

```tsx
// features/my-feature/components/my-component.tsx
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";

export function MyFeatureComponent() {
  return (
    <Dialog>
      <DialogContent>
        <Button>Feature Action</Button>
      </DialogContent>
    </Dialog>
  );
}
```

## Migration Examples

### Before (Custom Component)

```tsx
// Custom button with manual styling
<button className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
  Click me
</button>
```

### After (shadcn/ui Component)

```tsx
import { Button } from "@/shared/components/ui/button";

<Button>Click me</Button>
```

### Before (Custom Dialog)

```tsx
// Manual modal implementation
<div className="fixed inset-0 bg-black/50">
  <div className="bg-white p-4 rounded-lg">
    <h2>Title</h2>
    <p>Content</p>
    <button onClick={onClose}>Close</button>
  </div>
</div>
```

### After (shadcn/ui Dialog)

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <p>Content</p>
  </DialogContent>
</Dialog>
```

## Benefits

### ✅ Accessibility
- Built on Radix UI primitives
- ARIA attributes handled automatically
- Keyboard navigation built-in
- Screen reader support

### ✅ Consistency
- Uniform design system
- Predictable component API
- Shared styling patterns

### ✅ Maintainability
- Less custom code to maintain
- Well-documented components
- Easy to update and extend

### ✅ Developer Experience
- TypeScript support
- Autocomplete in editors
- Clear prop interfaces
- Composable patterns

## Available Components to Add

Common shadcn/ui components you might need:

- **Select** - Dropdown select inputs
- **Checkbox** - Checkbox inputs
- **Switch** - Toggle switches
- **Tooltip** - Hover tooltips
- **Popover** - Floating popovers
- **Command** - Command palette/search
- **Context Menu** - Right-click menus
- **Tabs** - Tabbed interfaces
- **Accordion** - Collapsible sections
- **Alert Dialog** - Confirmation dialogs
- **Toast** - Notification toasts (currently using Sonner)
- **Sheet** - Slide-out panels

Full list: https://ui.shadcn.com/docs/components

## Best Practices

1. **Use shadcn/ui components first** - Check if a shadcn/ui component exists before creating custom UI
2. **Compose, don't modify** - Create feature components by composing shadcn/ui primitives
3. **Keep customizations minimal** - Only customize when necessary for brand/design requirements
4. **Document deviations** - If you create custom components, document why
5. **Update regularly** - Keep Radix UI packages updated for bug fixes and new features

## Troubleshooting

### Component not importing

```bash
# Ensure package is installed
yarn add @radix-ui/react-<component>

# Check component.json aliases are correct
```

### Styling conflicts

- Ensure Tailwind CSS is configured correctly
- Check CSS variable definitions in `app/globals.css`
- Verify no conflicting global styles

### TypeScript errors

- Ensure `@types/react` is up to date
- Check component props match shadcn/ui documentation
- Verify Radix UI package versions are compatible

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [CVA Documentation](https://cva.style/)

---

**Last Updated**: February 7, 2026  
**Version**: 1.0.0
