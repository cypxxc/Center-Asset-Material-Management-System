export default function DBPanelLoading() {
  return (
    <div className="h-full bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden animate-pulse">
      {/* Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 rounded bg-blue-500/40 shrink-0" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-52 rounded bg-slate-800" />
            <div className="h-4 w-24 rounded bg-blue-900/40" />
          </div>
        </div>

        {/* Tab Controls Skeleton */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-28 rounded-lg bg-slate-800/60" />
          ))}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 border-r border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3 shrink-0">
          <div className="h-3 w-28 rounded bg-slate-800 uppercase tracking-widest" />
          <div className="space-y-1.5 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-full rounded-lg bg-slate-800/40 flex items-center justify-between px-3"
              >
                <div className="h-3.5 w-20 rounded bg-slate-700/60" />
                <div className="h-4 w-8 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        </aside>

        {/* Tab Panel Content Area */}
        <main className="flex-1 min-w-0 flex flex-col bg-slate-950/20 p-5 space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="h-9 w-full rounded-lg bg-slate-800/50" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-28 rounded-lg bg-slate-800/60" />
              <div className="h-9 w-24 rounded-lg bg-slate-800/60" />
              <div className="h-9 w-20 rounded-lg bg-slate-800/60" />
            </div>
          </div>

          {/* Database Table Skeleton */}
          <div className="flex-1 border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden flex flex-col">
            {/* Table Header Row */}
            <div className="h-10 border-b border-slate-800 bg-slate-900/80 px-4 grid grid-cols-6 gap-4 items-center">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-3.5 rounded bg-slate-800" />
              ))}
            </div>

            {/* Table Body Rows */}
            <div className="divide-y divide-slate-800/50 flex-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 px-4 grid grid-cols-6 gap-4 items-center">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} className="h-3 rounded bg-slate-800/50" />
                  ))}
                </div>
              ))}
            </div>

            {/* Table Footer */}
            <div className="h-12 border-t border-slate-800 bg-slate-900/40 px-4 flex items-center justify-between">
              <div className="h-3.5 w-32 rounded bg-slate-800/50" />
              <div className="flex gap-2">
                <div className="h-8 w-16 rounded bg-slate-800/50" />
                <div className="h-8 w-16 rounded bg-slate-800/50" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
