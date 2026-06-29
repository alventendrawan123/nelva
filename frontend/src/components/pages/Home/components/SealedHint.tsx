import { Lock } from "lucide-react";

type SealedHintProps = {
  message: string;
};

export function SealedHint({ message }: SealedHintProps) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
      <Lock className="h-4 w-4 text-accent" />
      {message}
    </div>
  );
}
