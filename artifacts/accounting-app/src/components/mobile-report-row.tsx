import React from "react";
import { formatCurrency } from "@/lib/format";

export interface MobileReportRowProps {
  primaryTitle?: React.ReactNode;
  subtitle?: React.ReactNode;
  middlePrimary?: React.ReactNode;
  middleSecondary?: React.ReactNode;
  amount?: number | string | null | undefined;
  amountLabel?: string;
  amountColorClass?: string;
  secondaryAmount?: number | string | null | undefined;
  secondaryLabel?: string;
  secondaryColorClass?: string;
  onClick?: () => void;
  customRight?: React.ReactNode;
}

export function MobileReportRow({
  primaryTitle,
  subtitle,
  middlePrimary,
  middleSecondary,
  amount,
  amountLabel = "Total",
  amountColorClass,
  secondaryAmount,
  secondaryLabel = "Balance",
  secondaryColorClass,
  onClick,
  customRight,
}: MobileReportRowProps) {
  const numAmount = typeof amount === "number" ? amount : amount ? Number(amount) : null;
  const numSecondary = typeof secondaryAmount === "number" ? secondaryAmount : secondaryAmount ? Number(secondaryAmount) : null;

  return (
    <div
      onClick={onClick}
      className={`py-3 px-3.5 border-b border-border/50 flex items-start justify-between gap-2.5 transition-colors ${
        onClick ? "cursor-pointer hover:bg-muted/30 active:bg-muted/60" : ""
      }`}
    >
      {/* Col 1: Left (Party / Title & Date) */}
      <div className="flex-1 min-w-0 pr-1">
        {primaryTitle && (
          <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug">
            {primaryTitle}
          </div>
        )}
        {subtitle && (
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug truncate">
            {subtitle}
          </div>
        )}
      </div>

      {/* Col 2: Middle (Type : Ref Number) */}
      {(middlePrimary || middleSecondary) && (
        <div className="shrink-0 px-1 text-center self-start pt-0.5">
          {middlePrimary && (
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap leading-tight">
              {middlePrimary}
            </div>
          )}
          {middleSecondary && (
            <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap leading-tight">
              {middleSecondary}
            </div>
          )}
        </div>
      )}

      {/* Col 3: Right (Total : ₹ ... & Balance : ₹ ...) */}
      <div className="text-right shrink-0 min-w-[95px] self-start">
        {customRight ? (
          customRight
        ) : (
          <>
            {numAmount !== null && !isNaN(numAmount) ? (
              <div className={`text-[13px] font-bold whitespace-nowrap leading-tight ${amountColorClass || "text-slate-900 dark:text-slate-50"}`}>
                {amountLabel ? <span className="font-normal text-muted-foreground text-xs mr-1">{amountLabel} :</span> : null}
                {formatCurrency(numAmount)}
              </div>
            ) : null}

            {numSecondary !== null && !isNaN(numSecondary) ? (
              <div className={`text-[11px] mt-1 whitespace-nowrap leading-tight ${secondaryColorClass || "text-muted-foreground"}`}>
                {secondaryLabel ? <span className="text-muted-foreground text-[10px] mr-1">{secondaryLabel}:</span> : null}
                {formatCurrency(Math.abs(numSecondary))} {numSecondary < 0 ? "Cr" : numSecondary > 0 ? "Dr" : ""}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
