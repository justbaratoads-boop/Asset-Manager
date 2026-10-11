import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function validateDecimalInput(
  val: string,
  isDecimalApplicable: boolean | string | undefined | null,
  decimalPlaces: number | string | undefined | null
): boolean {
  if (!val) return true;
  const isDec = isDecimalApplicable !== undefined && isDecimalApplicable !== null
    ? (isDecimalApplicable === true || isDecimalApplicable === "true" || isDecimalApplicable === 1)
    : true;
  if (!isDec) return /^\d+$/.test(val);
  const places = Math.max(0, Number(decimalPlaces) || 0);
  if (places === 0) return /^\d+$/.test(val);
  const regex = new RegExp(`^\\d*(\\.\\d{0,${places}})?$`);
  return regex.test(val);
}

