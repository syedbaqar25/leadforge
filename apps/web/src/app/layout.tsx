import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Leadforge — AI Lead Intelligence & Sales Automation Platform',
  description:
    'A multi-tenant CRM, AI sales assistant, and workflow automation engine for high-performing sales teams.',
  // Explicitly no default icon until user supplies brand asset per PART 16.2
  icons: {
    icon: [],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Anti-default favicon: empty icon prevents browser requesting default favicon */}
        <link rel="icon" href="data:," />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-accent/20 selection:text-accent">
        {children}
      </body>
    </html>
  );
}
