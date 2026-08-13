import type { ReactNode } from "react";

export function PracticeHeaderRow({
  children,
  rightContent,
}: {
  children: ReactNode;
  rightContent?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center">
      <span aria-hidden="true" />
      {children}
      <div className="flex justify-end">{rightContent}</div>
    </div>
  );
}
