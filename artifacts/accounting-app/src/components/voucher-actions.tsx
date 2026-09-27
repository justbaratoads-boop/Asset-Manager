import { useState } from "react";
import { Printer, Share2, MessageCircle, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetCompanySettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { VoucherType, printVoucher, formatVoucherShareText } from "@/lib/voucher-print";

interface VoucherButtonProps {
  type: VoucherType;
  voucher: any;
  ledgers?: any[];
  size?: "sm" | "default" | "icon" | "lg";
  variant?: "outline" | "ghost" | "default" | "secondary";
  className?: string;
  showText?: boolean;
}

export function VoucherPrintButton({
  type,
  voucher,
  ledgers = [],
  size = "sm",
  variant = "outline",
  className = "",
  showText = true,
}: VoucherButtonProps) {
  const { data: company } = useGetCompanySettings();

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!voucher) return;
    printVoucher({ type, voucher, company, ledgers });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={`gap-1.5 ${className}`}
      onClick={handlePrint}
      title="Print Voucher"
    >
      <Printer className="h-3.5 w-3.5" />
      {showText && size !== "icon" && <span>Print</span>}
    </Button>
  );
}

export function VoucherShareButton({
  type,
  voucher,
  ledgers = [],
  size = "sm",
  variant = "outline",
  className = "",
  showText = true,
}: VoucherButtonProps) {
  const { data: company } = useGetCompanySettings();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!voucher) return null;

  const { title, text } = formatVoucherShareText({ type, voucher, company, ledgers });

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    const coName = company?.name || company?.companyName || "Business";
    const subject = encodeURIComponent(`${title} - ${coName}`);
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Voucher details copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          handleCopy(e);
        }
      }
    } else {
      handleCopy(e);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={`gap-1.5 ${className}`}
          title="Share Voucher"
        >
          <Share2 className="h-3.5 w-3.5" />
          {showText && size !== "icon" && <span>Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-50">
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground font-semibold">
          Share Voucher
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleWhatsApp} className="gap-2 cursor-pointer text-xs">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          <span>WhatsApp</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="gap-2 cursor-pointer text-xs">
          <Mail className="h-4 w-4 text-blue-600" />
          <span>Email</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy} className="gap-2 cursor-pointer text-xs">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-600" />}
          <span>{copied ? "Copied!" : "Copy Details"}</span>
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <DropdownMenuItem onClick={handleNativeShare} className="gap-2 cursor-pointer text-xs">
            <Share2 className="h-4 w-4 text-primary" />
            <span>More Options...</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function VoucherActionButtons({
  type,
  voucher,
  ledgers = [],
  size = "sm",
  variant = "outline",
  showText = true,
  className = "",
}: VoucherButtonProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} onClick={e => e.stopPropagation()}>
      <VoucherPrintButton
        type={type}
        voucher={voucher}
        ledgers={ledgers}
        size={size}
        variant={variant}
        showText={showText}
      />
      <VoucherShareButton
        type={type}
        voucher={voucher}
        ledgers={ledgers}
        size={size}
        variant={variant}
        showText={showText}
      />
    </div>
  );
}
