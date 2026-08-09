import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function validateDecimalInput(val: string, isDecimalApplicable: boolean, decimalPlaces: number): boolean {
  if (!val) return true;
  if (!isDecimalApplicable) return /^\d+$/.test(val);
  const regex = new RegExp(`^\\d*(\\.\\d{0,${decimalPlaces}})?$`);
  return regex.test(val);
}

