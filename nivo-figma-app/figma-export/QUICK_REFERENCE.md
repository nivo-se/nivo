# Quick Reference Card

**Nivo Group Investment Platform - Design System Cheat Sheet**

---

## 🎨 Colors

```css
/* Primary */
Primary: #3b82f6 (blue-500)

/* Backgrounds */
Page Background: #f9fafb (gray-50)
Card Surface: #ffffff (white)

/* Borders */
Border: #e5e7eb (gray-200)
Border Hover: #d1d5db (gray-300)

/* Text */
Primary Text: #111827 (gray-900)
Secondary Text: #6b7280 (gray-600)
Muted Text: #9ca3af (gray-400)
Label Text: #374151 (gray-700)

/* Status Colors */
Success: #10b981 (green-500)
Warning: #f59e0b (yellow-500)
Error: #ef4444 (red-500)
Info: #3b82f6 (blue-500)
```

---

## 📐 Layout

```tsx
/* Page Container (all pages) */
<div className="h-full overflow-auto bg-gray-50">
  <div className="max-w-5xl mx-auto px-8 py-8">
    {/* Content */}
  </div>
</div>

/* Card */
<div className="bg-white border border-gray-200 rounded-lg p-6">
  {/* Card content */}
</div>

/* Section Spacing */
mb-8   // Between major sections
gap-6  // Between cards
gap-3  // Between list items
```

---

## 🔤 Typography

```tsx
/* Page Title (h1) */
<h1 className="text-2xl font-semibold text-gray-900 mb-2">
  Title
</h1>

/* Page Subtitle */
<p className="text-sm text-gray-600">Subtitle</p>

/* Section Heading (h2) */
<h2 className="text-base font-medium text-gray-900 mb-4">
  Section
</h2>

/* Subsection Heading (h3) */
<h3 className="text-sm font-medium text-gray-600 mb-3">
  Subsection
</h3>

/* Body Text */
<p className="text-sm text-gray-700">Body text</p>

/* Caption/Meta */
<span className="text-xs text-gray-500">Metadata</span>

/* Stat Number */
<p className="text-2xl font-semibold text-gray-900">123</p>
```

---

## 🔘 Buttons

```tsx
/* Primary Button (default) */
<Button className="h-9 text-sm">
  Action
</Button>

/* Outline Button */
<Button variant="outline" className="h-8 text-sm">
  Secondary
</Button>

/* Ghost Button */
<Button variant="ghost" className="h-8 text-sm">
  Tertiary
</Button>

/* Destructive */
<Button variant="destructive" className="h-9 text-sm">
  Delete
</Button>

/* Sizes */
h-8   // Small (32px)
h-9   // Default (36px)
h-10  // Large (40px)
```

---

## 🎴 Cards

```tsx
/* Basic Card */
<Card>
  <CardContent className="p-6">
    Content
  </CardContent>
</Card>

/* Card with Header */
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>

/* Hoverable Card */
<Card className="hover:border-gray-300 transition-colors">
  Content
</Card>
```

---

## 📝 Forms

```tsx
/* Text Input */
<Input
  type="text"
  placeholder="Enter text..."
  className="h-9"
/>

/* Select Dropdown */
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-48 h-9">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>

/* Textarea */
<Textarea
  placeholder="Enter note..."
  rows={3}
  className="resize-none"
/>
```

---

## 🏷️ Badges

```tsx
/* Status Badge */
<Badge className="bg-blue-100 text-blue-800">
  New
</Badge>

/* Color Options */
bg-blue-100 text-blue-800      // Blue (new, info)
bg-green-100 text-green-800    // Green (success, interested)
bg-yellow-100 text-yellow-800  // Yellow (warning, contacted)
bg-red-100 text-red-800        // Red (error, passed)
bg-gray-100 text-gray-800      // Gray (neutral, not interested)
bg-purple-100 text-purple-800  // Purple (researching)
bg-orange-100 text-orange-800  // Orange (in discussion)
```

---

## 📊 Tables

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data 1</TableCell>
      <TableCell>Data 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## 🗂️ Tabs

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

## 🪟 Modals

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <div>{/* Content */}</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 🔗 Navigation

```tsx
/* Sidebar Link (active state) */
<Link
  to="/route"
  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-blue-50 text-blue-600"
>
  <Icon className="w-5 h-5" />
  <span>Label</span>
</Link>

/* Breadcrumb / Back Button */
<Link to="/back" className="text-sm text-gray-600 hover:text-gray-900">
  ← Back to Page
</Link>

/* External Link */
<a
  href="https://..."
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
>
  Link <ExternalLink className="w-3 h-3" />
</a>
```

---

## 🎯 Common Patterns

### Page Header
```tsx
<div className="mb-8">
  <h1 className="text-2xl font-semibold text-gray-900 mb-2">
    Page Title
  </h1>
  <p className="text-sm text-gray-600">
    Subtitle or description
  </p>
</div>
```

### Section with Header
```tsx
<div className="mb-8">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-base font-medium text-gray-900">
      Section Title
    </h2>
    <Link to="/all" className="text-sm text-gray-600 hover:text-gray-900">
      View All
    </Link>
  </div>
  {/* Section content */}
</div>
```

### Stat Card
```tsx
<div className="bg-white border border-gray-200 rounded-lg p-6">
  <p className="text-sm text-gray-600 mb-2">Label</p>
  <p className="text-2xl font-semibold text-gray-900">123</p>
</div>
```

### List Item Card
```tsx
<div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <h4 className="text-sm font-medium text-gray-900 mb-2">
        Title
      </h4>
      <p className="text-sm text-gray-600">
        Metadata
      </p>
    </div>
    <Button size="sm" variant="outline" className="text-sm h-8">
      Action
    </Button>
  </div>
</div>
```

### Empty State
```tsx
<Card>
  <CardContent className="p-8 text-center">
    <p className="text-sm text-gray-500 mb-4">
      No items yet
    </p>
    <Button className="h-9">
      Create First Item
    </Button>
  </CardContent>
</Card>
```

---

## 📱 Responsive Grid

```tsx
/* 3 columns → 2 → 1 */
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Items */}
</div>

/* Stats Grid */
<div className="grid grid-cols-3 gap-6">
  {/* 3 stats always */}
</div>

/* Two Column Layout */
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* 2 columns on desktop */}
</div>
```

---

## 🎨 Icons

```tsx
import { IconName } from 'lucide-react';

/* Icon Sizes */
className="w-4 h-4"   // 16px (small)
className="w-5 h-5"   // 20px (default)
className="w-6 h-6"   // 24px (large)
className="w-12 h-12" // 48px (hero)

/* Icon Colors */
className="text-gray-600"   // Default
className="text-blue-600"   // Primary
className="text-green-600"  // Success
className="text-red-600"    // Error
```

---

## 🌈 Status Colors

```tsx
/* Prospect Status Colors */
const statusConfig = {
  new: 'bg-blue-100 text-blue-800',
  researching: 'bg-purple-100 text-purple-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  in_discussion: 'bg-orange-100 text-orange-800',
  interested: 'bg-green-100 text-green-800',
  not_interested: 'bg-gray-100 text-gray-800',
  passed: 'bg-red-100 text-red-800',
  deal_in_progress: 'bg-emerald-100 text-emerald-800',
};
```

---

## ⚡ Quick Copy-Paste

### Full Page Structure
```tsx
export default function PageName() {
  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Page Title
          </h1>
          <p className="text-sm text-gray-600">
            Subtitle
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Sections */}
        </div>
      </div>
    </div>
  );
}
```

---

**Quick Reference Version 1.1 | February 17, 2026**
