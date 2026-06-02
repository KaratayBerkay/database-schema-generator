import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `classNames` is an alias of `cn` so the codebase has a single, tailwind-merge
// aware class-merging implementation. Prefer `cn` in new code.
export const classNames = cn;
