# Quick Reference: shadcn/ui Component Usage

## 🎯 Available Components

### Layout & Structure
```tsx
// Card - Use for grouped content sections
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Interaction
```tsx
// Button - Use for all clickable actions
import { Button } from "@/shared/components/ui/button";

<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Forms & Input
```tsx
// Input - Use for text entry
import { Input } from "@/shared/components/ui/input";
<Input placeholder="Enter text" />

// Label - Use with form inputs
import { Label } from "@/shared/components/ui/label";
<Label htmlFor="input">Label</Label>
```

### Dialogs & Menus
```tsx
// Dialog - Use for modals
import { Dialog, DialogContent, DialogTrigger } from "@/shared/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>Modal content</DialogContent>
</Dialog>

// DropdownMenu - Use for dropdown options
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/shared/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Option 1</DropdownMenuItem>
    <DropdownMenuItem>Option 2</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// ContextMenu - Use for right-click menus
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem 
} from "@/shared/components/ui/context-menu";

<ContextMenu>
  {children}
  <ContextMenuContent>
    <ContextMenuItem>Action</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### Organization
```tsx
// Tabs - Use for tabbed navigation
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>

// Separator - Use for visual dividers
import { Separator } from "@/shared/components/ui/separator";
<Separator />
<Separator orientation="vertical" />
```

### Help & Hints
```tsx
// Tooltip - Use for hover hints
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/shared/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button>Hover</Button></TooltipTrigger>
    <TooltipContent>Helpful text</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 🎨 Tailwind Classes Cheat Sheet

### Common Patterns
```tsx
// Flex layouts
className="flex items-center gap-2"
className="flex flex-col gap-4"
className="flex justify-between"

// Spacing
className="p-4"        // padding
className="px-4 py-2"  // horizontal & vertical
className="gap-2"      // gap between flex items

// Sizing
className="w-full h-full"
className="w-12 h-12"  // 3rem x 3rem
className="max-w-lg"

// Typography
className="text-sm text-muted-foreground"
className="font-semibold text-lg"
className="text-center"

// Colors (use CSS variables)
className="bg-background text-foreground"
className="bg-card border border-border"
className="text-destructive"
className="hover:bg-accent"

// Borders & Radius
className="border rounded-lg"
className="border-t border-b"
className="rounded-full"

// Positioning (use inline styles only for dynamic values)
className="absolute top-0 left-0"  // For static positioning
style={{ paddingLeft: `${level * 12}px` }}  // For dynamic values
```

---

## 🔄 CSS Variables Available

```css
/* Colors - Use in className with hsl() or as variables */
--background
--foreground
--card
--card-foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--border
--input
--ring

/* Theme-specific */
--sidebar-background
--sidebar-foreground
--sidebar-border
--sidebar-hover

/* Editor-specific */
--editor-background
--editor-gutter
--editor-selection
```

#### Usage
```tsx
// In Tailwind classes (automatically converted)
className="bg-background text-foreground border-border"

// In inline styles (when needed)
<div style={{ color: `hsl(var(--primary))` }}>

// In CSS (globals.css)
.my-class {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

---

## 🚫 Anti-Patterns to Avoid

```tsx
// ❌ DON'T - Direct Radix imports
import { Button as RadixButton } from "@radix-ui/react-primitive";

// ✅ DO - Use shadcn wrapper
import { Button } from "@/shared/components/ui/button";

// ❌ DON'T - Custom styled divs for cards
<div className="border p-6 rounded-lg">Card</div>

// ✅ DO - Use Card component
<Card><CardContent>Card</CardContent></Card>

// ❌ DON'T - Hardcoded colors for static styling
<div style={{ background: "#3498db", padding: "24px" }}>

// ✅ DO - Use Tailwind classes and CSS variables
<div className="bg-primary p-6">

// ❌ DON'T - Create custom components
const CustomButton = styled.button`...`;

// ✅ DO - Use shadcn components
<Button variant="custom-variant">
```

---

## 📦 Component Import Paths

Always use these paths:

```tsx
// UI Components
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { DropdownMenu } from "@/shared/components/ui/dropdown-menu";
import { ContextMenu } from "@/shared/components/ui/context-menu";
import { Tabs, TabsList } from "@/shared/components/ui/tabs";
import { Tooltip } from "@/shared/components/ui/tooltip";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";

// Never use
import { Button } from "@/components/button";  // ❌ Wrong path
import { Button as Button } from "shadcn";     // ❌ Wrong source
```

---

## 🎯 Common Component Patterns

### Loading State
```tsx
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

### Icon Button
```tsx
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
</Button>
```

### Disabled State
```tsx
<Button disabled variant="outline">
  Disabled Button
</Button>
```

### Link-like Button
```tsx
<Button variant="link" asChild>
  <Link to="/path">Navigate</Link>
</Button>
```

### Form with Validation
```tsx
<div className="space-y-4">
  <div>
    <Label htmlFor="email">Email</Label>
    <Input id="email" placeholder="Enter email" />
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
  <Button>Submit</Button>
</div>
```

---

## 🔧 Customization

### Override Component Styling
```tsx
// Pass className to override defaults
<Button className="w-full">Wide Button</Button>
<Card className="shadow-none">No shadow card</Card>

// Combine with size/variant props
<Button size="lg" className="rounded-full">Large Pill Button</Button>
```

### Theme Switching
```tsx
// Already configured in theme-provider.tsx
// Just use the CSS variables in Tailwind
<div className="bg-background text-foreground">
  Content automatically switches with theme
</div>
```

---

## 📖 Additional Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Documentation](https://www.radix-ui.com)
- [Tailwind CSS Classes](https://tailwindcss.com/docs)
- Project config: `components.json`
- Style variables: `src/styles/globals.css`

---

## ✅ Verification Checklist for New Components

When adding new features, verify:
- [ ] Using shadcn component (not custom)
- [ ] Tailwind classes for styling (not inline styles)
- [ ] CSS variables for colors (not hardcoded)
- [ ] Proper component composition
- [ ] No direct Radix imports
- [ ] Accessible (proper ARIA labels, keyboard support)
- [ ] Works in light and dark themes
- [ ] Mobile responsive

---

**Last Updated:** February 2026
**Status:** Guidelines for post-refactoring development
