import { useState } from "react";
import { Share2, MessageCircle, Mail, Copy, Check } from "lucide-react";
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

import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title?: string;
  summaryText?: string;
  url?: string;
  customText?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showText?: boolean;
  label?: string;
}

export function ShareButton({
  title = "Report",
  summaryText,
  url,
  customText,
  className = "",
  size = "sm",
  variant = "outline",
  showText = true,
  label = "Share",
}: ShareButtonProps) {
  const { data: companySettings } = useGetCompanySettings();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const businessName = (companySettings as any)?.companyName || (companySettings as any)?.name || "Business";
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const fullText = customText || `*${title}*\n${businessName}${summaryText ? `\n${summaryText}` : ""}\n\nLink: ${shareUrl}`;

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(fullText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`${title} - ${businessName}`);
    const body = encodeURIComponent(fullText);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText || shareUrl);
      setCopied(true);
      toast({ title: customText ? "Details copied to clipboard!" : "Link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${title} - ${businessName}`,
          text: customText || summaryText || title,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn("gap-1.5", className)}>
          <Share2 className="h-3.5 w-3.5" />
          {showText && <span>{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground font-semibold">
          {title?.toLowerCase().includes("invoice") ? "Share Invoice" : "Share"}
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
          <span>{copied ? "Copied!" : "Copy Link"}</span>
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
