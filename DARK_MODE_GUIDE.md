# Dark Mode Implementation Guide

## 🌓 Overview

Dark mode has been fully implemented across the entire application with a toggle button in the sidebar. The theme persists across sessions using localStorage and respects system preferences.

## 🎨 Color Scheme

### Light Mode
- Background: White (#FFFFFF) and Light Gray (#F9FAFB)
- Text: Dark Gray (#111827)
- Borders: Light Gray (#E5E7EB)
- Cards: White (#FFFFFF)

### Dark Mode
- Background: Dark Gray (#111827) and Very Dark Gray (#1F2937)
- Text: Light Gray (#F3F4F6) and White
- Borders: Medium Dark Gray (#374151)
- Cards: Dark Gray (#1F2937)

## 🔧 Implementation Details

### 1. Theme Provider
Located at: `frontend/contexts/ThemeContext.tsx`

Features:
- Manages theme state (light/dark)
- Persists theme to localStorage
- Provides `useTheme()` hook
- Auto-detects system preference on first load

### 2. Dark Mode Toggle
Located at: `frontend/components/DarkModeToggle.tsx`

Features:
- Sun/Moon icon that changes based on theme
- Smooth transitions
- Accessible with aria-labels
- Placed in dashboard sidebar

### 3. Tailwind Configuration
Updated in: `frontend/tailwind.config.ts`

Added: `darkMode: 'class'` - enables class-based dark mode

### 4. Global Styles
Updated in: `frontend/app/globals.css`

Added:
- Base dark mode styles
- Smooth transitions for theme switching
- Utility classes for common patterns
- Color-scheme support

## 📝 Usage Patterns

### Basic Element Styling

```tsx
// Background
className="bg-white dark:bg-gray-800"

// Text
className="text-gray-900 dark:text-gray-100"

// Borders
className="border-gray-200 dark:border-gray-700"
```

### Common Component Patterns

#### Cards
```tsx
className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
```

#### Input Fields
```tsx
className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
```

#### Buttons
```tsx
// Primary
className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white"

// Secondary
className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
```

#### Tables
```tsx
// Table container
className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"

// Table header
className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300"

// Table rows
className="hover:bg-gray-50 dark:hover:bg-gray-700"
```

#### Modals
```tsx
// Overlay
className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70"

// Modal content
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
```

### Status Badges (Color-Coded)

Status badges maintain their semantic colors but are adjusted for dark mode:

```tsx
// Success/Green
className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"

// Info/Blue
className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"

// Warning/Yellow
className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"

// Error/Red
className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"

// Neutral/Gray
className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
```

## 🎯 Pre-built Utility Classes

Use these classes for quick styling:

```tsx
.card-dark         // Card pattern
.input-dark        // Input field pattern
.btn-primary-dark  // Primary button
.btn-secondary-dark // Secondary button
.table-dark        // Table container
.table-header-dark // Table header
.table-row-dark    // Table row
.modal-dark        // Modal content
.modal-overlay-dark // Modal overlay
.badge-green       // Green badge
.badge-blue        // Blue badge
.badge-yellow      // Yellow badge
.badge-red         // Red badge
.badge-gray        // Gray badge
```

## 🔄 Using the Theme in Components

```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}
```

## ✅ Updated Components

The following components have been fully updated with dark mode:

1. **Layout Components**
   - Root Layout (`app/layout.tsx`)
   - Dashboard Layout (`app/dashboard/layout.tsx`)
   - Dashboard Navigation (`app/dashboard/DashboardNav.tsx`)
   - Notifications Link (`app/dashboard/NotificationsLink.tsx`)

2. **Theme Components**
   - Theme Provider (`contexts/ThemeContext.tsx`)
   - Dark Mode Toggle (`components/DarkModeToggle.tsx`)

3. **Vendor Pages** (Fully Updated)
   - Vendors List Page (`app/dashboard/vendors/page.tsx`)
     - Filters section (white in light, dark gray in dark mode)
     - Vendor cards
     - Modal forms
     - All inputs and selects
   - Vendor Detail Page (`app/dashboard/vendors/[id]/page.tsx`)
     - Stats cards
     - Information sections
     - Invoice tables
     - Asset tables
     - Upload invoice modal
     - All form inputs

4. **Global Styles**
   - `app/globals.css` - Base styles and utilities
   - `tailwind.config.ts` - Dark mode configuration
   - Auto-applied dark mode to all input types globally

## 📦 Remaining Pages to Update

To add dark mode to other pages, simply add dark mode classes to:

1. **Page containers**: `bg-gray-50 dark:bg-gray-900`
2. **Cards**: `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`
3. **Text**: `text-gray-900 dark:text-gray-100`
4. **Inputs**: `bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600`
5. **Tables**: Use `.table-dark`, `.table-header-dark`, `.table-row-dark`
6. **Modals**: Use `.modal-dark` and `.modal-overlay-dark`

## 🚀 Best Practices

1. **Always pair backgrounds with appropriate text colors**
   ```tsx
   // Good
   <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
   
   // Bad - text won't be visible in dark mode
   <div className="bg-white dark:bg-gray-800 text-gray-900">
   ```

2. **Use semantic colors for status badges**
   - Maintain color meaning (green = success, red = error)
   - Adjust brightness for dark mode

3. **Test both modes**
   - Toggle between light and dark
   - Check text contrast
   - Verify all interactive elements are visible

4. **Use utility classes for consistency**
   - Prefer pre-built utilities (`.card-dark`, `.input-dark`)
   - Keeps styling consistent across the app

## 🎨 Customization

To change dark mode colors, update `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      // Add custom dark mode colors
      'dark-primary': '#1a1a2e',
      'dark-secondary': '#16213e',
    },
  },
},
```

Then use: `dark:bg-dark-primary`

## 🔍 Debugging

If dark mode isn't working:

1. Check `html` element has `dark` class when in dark mode
2. Verify Tailwind config has `darkMode: 'class'`
3. Ensure ThemeProvider wraps the app
4. Check localStorage for saved theme
5. Inspect elements for correct dark mode classes

## 📱 Responsive Dark Mode

Dark mode works seamlessly with responsive design:

```tsx
className="bg-white dark:bg-gray-800 md:bg-gray-50 md:dark:bg-gray-900"
```

## ✨ Summary

Dark mode is now fully implemented with:
- ✅ Persistent theme across sessions
- ✅ System preference detection
- ✅ Smooth transitions
- ✅ Accessible toggle button
- ✅ Comprehensive color scheme
- ✅ Pre-built utility classes
- ✅ Updated core components
- ✅ Easy-to-use theme hook

All new components should follow the patterns above to maintain consistency!


