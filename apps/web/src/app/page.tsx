export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold tracking-wide text-foreground-secondary">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Editorial Paper Design Direction
        </div>

        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Leadforge
        </h1>

        <p className="text-base leading-relaxed text-foreground-secondary sm:text-lg">
          AI Lead Intelligence & Sales Automation Platform. A unified multi-tenant CRM, explainable
          lead scoring engine, visual pipeline, and AI sales assistant.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors duration-normal hover:bg-accent-hover"
          >
            Access Workspace
          </a>
          <a
            href="/api/docs"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-medium text-foreground transition-colors duration-normal hover:bg-surface-hover"
          >
            API Documentation
          </a>
        </div>
      </div>
    </main>
  );
}
