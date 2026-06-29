import { ChevronDown, Search } from "lucide-react";

const FILTERS = ["Token", "Network", "Status"] as const;

export function PoolFilters() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            {filter}
            <ChevronDown className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          aria-label="Search pools"
          placeholder="Search pool name or symbol"
          className="w-full rounded-full border border-border bg-surface py-2 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>
    </div>
  );
}
