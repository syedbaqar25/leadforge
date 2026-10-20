import React from 'react';
import { Providers } from '../../components/providers';
import { AppShell } from '../../components/layout/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
