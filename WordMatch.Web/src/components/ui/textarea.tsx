import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "type-body flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-card px-2.5 py-2 text-foreground transition-[background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
