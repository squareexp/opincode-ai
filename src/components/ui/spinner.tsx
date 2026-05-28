import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.ComponentProps<"div"> {
  variant?: 1 | 2 | 3 | 4;
}

function Spinner({ className, variant = 1, ...props }: SpinnerProps) {
  const loaderClass = `loader${variant}`;
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center justify-center shrink-0 mr-3 ml-1.5", className)}
      {...props}
    >
      <div className={loaderClass} />
    </div>
  );
}

export { Spinner };
