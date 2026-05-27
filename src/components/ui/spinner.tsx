import { Refresh2 } from 'iconsax-react';
import { cn } from "@/lib/utils";


function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Refresh2 variant="Linear"
            role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
     color="currentColor"/>
  );
}

export { Spinner };
