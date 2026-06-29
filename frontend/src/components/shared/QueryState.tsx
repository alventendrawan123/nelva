import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type QueryStateProps = {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  isError,
  isEmpty = false,
  errorMessage = "Something went wrong.",
  emptyMessage = "Nothing here yet.",
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse p-10 text-center text-sm text-muted">
        Loading...
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-sm text-danger">
        {errorMessage} Make sure the Nelva backend is running on port 8090.
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        {emptyMessage}
      </Card>
    );
  }

  return <>{children}</>;
}
