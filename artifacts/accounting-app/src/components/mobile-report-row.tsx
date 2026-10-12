import React from "react";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export interface MobileReportRowProps {
  primaryTitle: React.ReactNode;
  subtitle?: React.ReactNode;
  badgeLabel?: string;
  badgeColorClass?: string;
  middlePrimary?: React.ReactNode;
  middleSecondary?: React.ReactNode;
  amount?: number | string | null | undefined;
  amountLabel?: string;
  amountColorClass?: string;
  secondaryAmount?: number | string | null | undefined;
  secondaryLabel?: string;
  secondaryColorClass?: string;
  onClick?: () => void;
  statusBadge?: React.ReactNode;
  customRight?: React.ReactNode;
}

export function MobileReportRow({
  primaryTitle,
  subtitle,
  badgeLabel,
  badgeColorClass,
  middlePrimary,
  middleSecondary,
  amount,
  amountLabel = "Total",
  amountColorClass,
  secondaryAmount,
  secondaryLabel = "Balance",
  secondaryColorClass,
  onClick,
  statusBadge,
  customRight,
}: MobileReportRowProps) {
  const numAmount = typeof amount === "number" ? amount : amount ? Number(amount) : null;
  const numSecondary = typeof secondaryAmount === "number" ? secondaryAmount : secondaryAmount ? Number(secondaryAmount) : null;

  return (
    <div
      onClick={onClick}
      className={`p-3 border-b border-border/60 flex items-start justify-between gap-2 transition-colors ${
        onClick ? "cursor-pointer hover:bg-muted/40 active:bg-muted/70" : ""
      }`}
    >
      {/* Col 1: Left - Title (Party / Item / Description) + Subtitle (Date / Meta) */}
      <div className="flex-1 min-w-0 pr-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="font-semibold text-sm text-foreground truncate max-w-[190px] xs:max-w-[240px] leading-tight">
            {primaryTitle || "—"}
          </div>
          {badgeLabel && (
            <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 leading-none font-normal shrink-0 ${badgeColorClass || ""}`}>
              {badgeLabel}
            </Badge>
          )}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-1 leading-tight flex items-center gap-1">
            {subtitle}
          </div>
        )}
      </div>

      {/* Col 2: Middle - Type & Ref / Move Info */}
      {(middlePrimary || middleSecondary) && (
        <div className="text-center shrink-0 px-1 self-center">
          {middlePrimary && (
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-tight">
              {middlePrimary}
            </div>
          )}
          {middleSecondary && (
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
              {middleSecondary}
            </div>
          )}
        </div>
      )}

      {/* Col 3: Right - Amounts (Total & Running Balance / Details) */}
      <div className="text-right shrink-0 min-w-[90px]">
        {customRight ? (
          customRight
        ) : (
          <>
            {numAmount !== null && !isNaN(numAmount) ? (
              <p className={`font-bold text-sm whitespace-nowrap leading-tight ${amountColorClass || "text-foreground"}`}>
                {amountLabel ? <span className="font-normal text-muted-foreground text-xs mr-1">{amountLabel} :</span> : null}
                {formatCurrency(numAmount)}
              </p>
            ) : null}

            {numSecondary !== null && !isNaN(numSecondary) ? (
              <p className={`text-xs mt-1 whitespace-nowrap leading-tight ${secondaryColorClass || "text-muted-foreground"}`}>
                {secondaryLabel ? <span className="text-muted-foreground text-[11px] mr-1">{secondaryLabel}:</span> : null}
                {formatCurrency(Math.abs(numSecondary))} {numSecondary < 0 ? "Cr" : numSecondary > 0 ? "Dr" : ""}
              </p>
            ) : null}

            {statusBadge && <div className="mt-1 flex justify-end">{statusBadge}</div>}
          </>
        )}
      </div>
    </div>
  );
}
