# DotBot Web App

A modern Next.js application built with TypeScript, Tailwind CSS, and shadcn/ui components.

## 🚀 Features

- **Next.js 15** - Latest version with App Router
- **TypeScript** - Full type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **Lucide React** - Modern icon library

## 🛠️ Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Radix UI](https://www.radix-ui.com/) - Primitive components
- [Lucide React](https://lucide.dev/) - Icon library

## 📦 Installed Components

The following shadcn/ui components are pre-installed and ready to use:

- `Button` - Various button styles and sizes
- `Card` - Content containers
- `Input` - Form input fields
- `Label` - Form labels
- `Textarea` - Multi-line text input
- `Select` - Dropdown selections
- `Checkbox` - Checkboxes
- `RadioGroup` - Radio button groups
- `Switch` - Toggle switches
- `Badge` - Status indicators
- `Avatar` - User profile images
- `Alert` - Notification messages
- `Separator` - Visual dividers
- `Dialog` - Modal dialogs

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) to see the demo

## 🎨 Adding More Components

To add more shadcn/ui components:

```bash
pnpm dlx shadcn@latest add [component-name]
```

For example:
```bash
pnpm dlx shadcn@latest add table
pnpm dlx shadcn@latest add toast
pnpm dlx shadcn@latest add dropdown-menu
```

## 📁 Project Structure

```
src/
├── app/                # Next.js App Router
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   └── ui/             # shadcn/ui components
└── lib/
    └── utils.ts        # Utility functions
```

## 🎯 Demo Page

The homepage (`/`) showcases various shadcn/ui components including:

- Different button variants and sizes
- Form elements (inputs, selects, textareas)
- Interactive components (checkboxes, switches, radio groups)
- User profile display with avatars and badges
- Alert messages
- Modal dialogs
- Cards and layouts

## 🌙 Dark Mode

The app supports dark mode out of the box with Tailwind CSS dark mode classes.

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Contributing

Feel free to contribute by adding more components, improving the demo, or enhancing the documentation.
