import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Printer, Check, ZoomIn } from "lucide-react";

const STORAGE_KEY = "print_settings";

export interface PrintSettings {
  printerType: "a4" | "a5" | "thermal";
  layoutStyle: "1" | "2" | "3";
  showLogo: boolean;
  showCompanyName: boolean;
  showAddress: boolean;
  showGstin: boolean;
  showPartyGstin: boolean;
  showHsnCode: boolean;
  showBankDetails: boolean;
  showSignatureLine: boolean;
  showFooter: boolean;
  invoiceCopies: "1" | "2" | "3";
  copyLabels: string;
  billTitle: string;
  termsAndConditions: string;
  printAcknowledgment: boolean;
}

const DEFAULT: PrintSettings = {
  printerType: "a4",
  layoutStyle: "1",
  showLogo: true,
  showCompanyName: true,
  showAddress: true,
  showGstin: true,
  showPartyGstin: true,
  showHsnCode: true,
  showBankDetails: true,
  showSignatureLine: true,
  showFooter: true,
  invoiceCopies: "1",
  copyLabels: "Original, Duplicate, Triplicate",
  billTitle: "TAX INVOICE",
  termsAndConditions: "",
  printAcknowledgment: false,
};

export function loadPrintSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
  } catch { return DEFAULT; }
}

/* ─── SVG Previews ─────────────────────────────────────────────────────── */

function A4L1() {
  return (
    <svg viewBox="0 0 120 170" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="170" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      <rect x="8" y="8" width="18" height="13" rx="2" fill="#e0e7ff"/>
      <rect x="30" y="9" width="35" height="3.5" rx="1" fill="#1e293b"/>
      <rect x="30" y="15" width="24" height="2" rx="1" fill="#9ca3af"/>
      <rect x="30" y="19" width="18" height="2" rx="1" fill="#9ca3af"/>
      <rect x="80" y="8" width="32" height="7" rx="1.5" fill="#4f46e5"/>
      <rect x="86" y="17.5" width="24" height="2.5" rx="1" fill="#9ca3af"/>
      <rect x="90" y="21.5" width="18" height="2" rx="1" fill="#9ca3af"/>
      <line x1="8" y1="28" x2="112" y2="28" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="8" y="31" width="12" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="8" y="35" width="36" height="3" rx="1" fill="#374151"/>
      <rect x="8" y="40" width="24" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="46" x2="112" y2="46" stroke="#e5e7eb" strokeWidth="0.8"/>
      {/* Table - bordered style */}
      <rect x="8" y="48" width="104" height="6" rx="0" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5"/>
      <rect x="9" y="49.5" width="12" height="2.5" rx="0.5" fill="#6b7280"/>
      <rect x="26" y="49.5" width="22" height="2.5" rx="0.5" fill="#6b7280"/>
      <rect x="62" y="49.5" width="10" height="2.5" rx="0.5" fill="#6b7280"/>
      <rect x="78" y="49.5" width="12" height="2.5" rx="0.5" fill="#6b7280"/>
      <rect x="98" y="49.5" width="12" height="2.5" rx="0.5" fill="#6b7280"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="8" y={54+i*8} width="104" height="8" fill="white" stroke="#d1d5db" strokeWidth="0.5"/>
          <rect x="10" y={57+i*8} width="8" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="24" y={57+i*8} width="28" height="2" rx="0.5" fill="#374151"/>
          <rect x="64" y={57+i*8} width="10" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="80" y={57+i*8} width="12" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="98" y={57+i*8} width="12" height="2" rx="0.5" fill="#374151"/>
        </g>
      ))}
      <rect x="70" y="90" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="70" y="94" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="70" y1="99" x2="112" y2="99" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="70" y="101" width="42" height="4" rx="1" fill="#4f46e5" opacity="0.8"/>
      <line x1="8" y1="110" x2="112" y2="110" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="8" y="113" width="28" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="8" y="117" width="44" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="148" x2="44" y2="148" stroke="#9ca3af" strokeWidth="0.8"/>
      <line x1="76" y1="148" x2="112" y2="148" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="12" y="151" width="24" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="78" y="151" width="30" height="1.5" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

function A4L2() {
  return (
    <svg viewBox="0 0 120 170" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="170" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      {/* Full-width indigo header */}
      <rect x="0" y="0" width="120" height="35" fill="#4f46e5" rx="2"/>
      <rect x="8" y="6" width="16" height="12" rx="2" fill="rgba(255,255,255,0.2)"/>
      <rect x="28" y="7" width="36" height="3.5" rx="1" fill="white"/>
      <rect x="28" y="13" width="24" height="2" rx="1" fill="rgba(255,255,255,0.65)"/>
      <rect x="28" y="17" width="18" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
      <rect x="76" y="6" width="36" height="7" rx="1.5" fill="rgba(255,255,255,0.25)"/>
      <rect x="82" y="16" width="26" height="2.5" rx="1" fill="rgba(255,255,255,0.65)"/>
      <rect x="86" y="20.5" width="20" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
      {/* Bill to */}
      <rect x="8" y="39" width="12" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="8" y="43" width="38" height="3" rx="1" fill="#374151"/>
      <rect x="8" y="48" width="26" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="37" x2="112" y2="37" stroke="#4f46e5" strokeWidth="1.5"/>
      {/* Table - borderless with alternating rows */}
      <rect x="8" y="55" width="104" height="6" fill="none"/>
      <rect x="9" y="56" width="12" height="2.5" rx="0.5" fill="#4f46e5"/>
      <rect x="26" y="56" width="22" height="2.5" rx="0.5" fill="#4f46e5"/>
      <rect x="62" y="56" width="10" height="2.5" rx="0.5" fill="#4f46e5"/>
      <rect x="78" y="56" width="12" height="2.5" rx="0.5" fill="#4f46e5"/>
      <rect x="98" y="56" width="12" height="2.5" rx="0.5" fill="#4f46e5"/>
      <line x1="8" y1="62" x2="112" y2="62" stroke="#4f46e5" strokeWidth="1"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          {i%2===1 && <rect x="8" y={63+i*8} width="104" height="8" fill="#f5f3ff"/>}
          <rect x="10" y={66+i*8} width="8" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="24" y={66+i*8} width="28" height="2" rx="0.5" fill="#374151"/>
          <rect x="64" y={66+i*8} width="10" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="80" y={66+i*8} width="12" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="98" y={66+i*8} width="12" height="2" rx="0.5" fill="#374151"/>
        </g>
      ))}
      <rect x="70" y="97" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="70" y="101" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="70" y1="105.5" x2="112" y2="105.5" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="70" y="108" width="42" height="4" rx="1" fill="#4f46e5"/>
      <line x1="8" y1="118" x2="112" y2="118" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="8" y="121" width="28" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="8" y="125" width="44" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="150" x2="44" y2="150" stroke="#9ca3af" strokeWidth="0.8"/>
      <line x1="76" y1="150" x2="112" y2="150" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="14" y="153" width="20" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="78" y="153" width="28" height="1.5" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

function A4L3() {
  return (
    <svg viewBox="0 0 120 170" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="170" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      {/* Minimal - no boxes, just lines */}
      <rect x="8" y="9" width="16" height="12" rx="2" fill="#f3f4f6"/>
      <rect x="28" y="10" width="38" height="3.5" rx="1" fill="#111"/>
      <rect x="28" y="16" width="26" height="2" rx="1" fill="#9ca3af"/>
      <rect x="28" y="20" width="20" height="2" rx="1" fill="#9ca3af"/>
      <rect x="78" y="9" width="34" height="8" rx="1" fill="none"/>
      <rect x="78" y="10" width="34" height="5" rx="0.5" fill="#111" opacity="0.08"/>
      <rect x="80" y="11" width="30" height="3" rx="0.5" fill="#374151"/>
      <rect x="82" y="16.5" width="24" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="86" y="20.5" width="18" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="27" x2="112" y2="27" stroke="#000" strokeWidth="1.5"/>
      <rect x="8" y="30" width="12" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="8" y="34" width="38" height="3.5" rx="1" fill="#111"/>
      <rect x="8" y="39.5" width="26" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="45" x2="112" y2="45" stroke="#d1d5db" strokeWidth="0.8"/>
      {/* Minimal table - only horizontal lines */}
      <rect x="9" y="49.5" width="10" height="2.5" rx="0.5" fill="#374151"/>
      <rect x="24" y="49.5" width="24" height="2.5" rx="0.5" fill="#374151"/>
      <rect x="62" y="49.5" width="10" height="2.5" rx="0.5" fill="#374151"/>
      <rect x="78" y="49.5" width="12" height="2.5" rx="0.5" fill="#374151"/>
      <rect x="98" y="49.5" width="12" height="2.5" rx="0.5" fill="#374151"/>
      <line x1="8" y1="53" x2="112" y2="53" stroke="#000" strokeWidth="1"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="10" y={56+i*8} width="8" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="24" y={56+i*8} width="28" height="2" rx="0.5" fill="#374151"/>
          <rect x="64" y={56+i*8} width="10" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="80" y={56+i*8} width="12" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="98" y={56+i*8} width="12" height="2" rx="0.5" fill="#374151"/>
          <line x1="8" y1={62+i*8} x2="112" y2={62+i*8} stroke="#f3f4f6" strokeWidth="0.5"/>
        </g>
      ))}
      <line x1="8" y1="90" x2="112" y2="90" stroke="#d1d5db" strokeWidth="0.8"/>
      <rect x="70" y="93" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="70" y="97" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="70" y1="101.5" x2="112" y2="101.5" stroke="#000" strokeWidth="1"/>
      <rect x="70" y="104" width="42" height="3.5" rx="0.5" fill="#111"/>
      <line x1="8" y1="114" x2="112" y2="114" stroke="#d1d5db" strokeWidth="0.8"/>
      <rect x="8" y="117" width="28" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="8" y="121" width="44" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="8" y1="148" x2="44" y2="148" stroke="#9ca3af" strokeWidth="0.8"/>
      <line x1="76" y1="148" x2="112" y2="148" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="14" y="151" width="20" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="78" y="151" width="28" height="1.5" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

function A5L1() {
  return (
    <svg viewBox="0 0 100 142" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="142" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      <rect x="6" y="7" width="14" height="10" rx="1.5" fill="#e0e7ff"/>
      <rect x="24" y="8" width="28" height="3" rx="1" fill="#1e293b"/>
      <rect x="24" y="13" width="18" height="2" rx="1" fill="#9ca3af"/>
      <rect x="68" y="7" width="26" height="5.5" rx="1" fill="#4f46e5"/>
      <rect x="72" y="15" width="20" height="2" rx="1" fill="#9ca3af"/>
      <line x1="6" y1="23" x2="94" y2="23" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="6" y="26" width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="6" y="29.5" width="30" height="2.5" rx="0.8" fill="#374151"/>
      <rect x="6" y="33.5" width="20" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="6" y1="38" x2="94" y2="38" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="6" y="40" width="88" height="5" rx="0" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5"/>
      <rect x="8" y="41.5" width="14" height="2" rx="0.5" fill="#6b7280"/>
      <rect x="38" y="41.5" width="10" height="2" rx="0.5" fill="#6b7280"/>
      <rect x="60" y="41.5" width="10" height="2" rx="0.5" fill="#6b7280"/>
      <rect x="78" y="41.5" width="12" height="2" rx="0.5" fill="#6b7280"/>
      {[0,1,2].map(i => (
        <g key={i}>
          <rect x="6" y={45+i*7} width="88" height="7" fill="white" stroke="#d1d5db" strokeWidth="0.5"/>
          <rect x="8" y={47.5+i*7} width="18" height="1.8" rx="0.5" fill="#374151"/>
          <rect x="38" y={47.5+i*7} width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
          <rect x="60" y={47.5+i*7} width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
          <rect x="78" y={47.5+i*7} width="12" height="1.8" rx="0.5" fill="#374151"/>
        </g>
      ))}
      <rect x="58" y="68" width="36" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="58" y="72" width="36" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="58" y1="76" x2="94" y2="76" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="58" y="78.5" width="36" height="3" rx="0.5" fill="#4f46e5"/>
      <line x1="6" y1="86" x2="94" y2="86" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="6" y="89" width="28" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="6" y="93" width="40" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="6" y1="114" x2="32" y2="114" stroke="#9ca3af" strokeWidth="0.8"/>
      <line x1="68" y1="114" x2="94" y2="114" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="10" y="117" width="16" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="64" y="117" width="24" height="1.5" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

function A5L2() {
  return (
    <svg viewBox="0 0 100 142" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="142" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      <rect x="6" y="6" width="14" height="10" rx="1.5" fill="#e0e7ff"/>
      <rect x="24" y="7" width="28" height="3" rx="1" fill="#1e293b"/>
      <rect x="24" y="12" width="18" height="2" rx="1" fill="#9ca3af"/>
      <rect x="68" y="6" width="26" height="5.5" rx="1" fill="#374151"/>
      <rect x="72" y="14" width="20" height="2" rx="1" fill="#9ca3af"/>
      <line x1="6" y1="22" x2="94" y2="22" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="6" y="24" width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="6" y="27.5" width="30" height="2.5" rx="0.8" fill="#374151"/>
      <line x1="6" y1="34" x2="94" y2="34" stroke="#e5e7eb" strokeWidth="0.8"/>
      {/* Dark table header */}
      <rect x="6" y="36" width="88" height="5" rx="0" fill="#374151"/>
      <rect x="8" y="37.5" width="14" height="2" rx="0.5" fill="white" opacity="0.85"/>
      <rect x="38" y="37.5" width="10" height="2" rx="0.5" fill="white" opacity="0.85"/>
      <rect x="60" y="37.5" width="10" height="2" rx="0.5" fill="white" opacity="0.85"/>
      <rect x="78" y="37.5" width="12" height="2" rx="0.5" fill="white" opacity="0.85"/>
      {[0,1,2].map(i => (
        <g key={i}>
          <rect x="6" y={41+i*7} width="88" height="7" fill={i%2===1 ? "#f9fafb" : "white"}/>
          <line x1="6" y1={48+i*7} x2="94" y2={48+i*7} stroke="#f3f4f6" strokeWidth="0.5"/>
          <rect x="8" y={43.5+i*7} width="18" height="1.8" rx="0.5" fill="#374151"/>
          <rect x="38" y={43.5+i*7} width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
          <rect x="60" y={43.5+i*7} width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
          <rect x="78" y={43.5+i*7} width="12" height="1.8" rx="0.5" fill="#374151"/>
        </g>
      ))}
      <rect x="58" y="63" width="36" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="58" y="67" width="36" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="58" y1="71" x2="94" y2="71" stroke="#374151" strokeWidth="1"/>
      <rect x="58" y="74" width="36" height="3" rx="0.5" fill="#374151"/>
      <line x1="6" y1="82" x2="94" y2="82" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="6" y="85" width="28" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="6" y="89" width="38" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="6" y1="108" x2="30" y2="108" stroke="#9ca3af" strokeWidth="0.8"/>
      <line x1="68" y1="108" x2="94" y2="108" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="10" y="111" width="14" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="64" y="111" width="22" height="1.5" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

function A5L3() {
  return (
    <svg viewBox="0 0 100 142" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="142" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      {/* Dark slate banner header */}
      <rect x="0" y="0" width="100" height="28" fill="#1e293b" rx="2"/>
      <rect x="6" y="6" width="12" height="9" rx="1.5" fill="rgba(255,255,255,0.15)"/>
      <rect x="22" y="7" width="30" height="3" rx="1" fill="white"/>
      <rect x="22" y="12" width="20" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
      <rect x="68" y="6" width="26" height="5" rx="1" fill="rgba(255,255,255,0.2)"/>
      <rect x="70" y="13" width="22" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
      <rect x="72" y="17" width="18" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>
      <rect x="6" y="31" width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="6" y="34.5" width="30" height="2.5" rx="0.8" fill="#374151"/>
      <line x1="6" y1="41" x2="94" y2="41" stroke="#1e293b" strokeWidth="1.5"/>
      <rect x="8" y="44.5" width="14" height="2" rx="0.5" fill="#1e293b"/>
      <rect x="38" y="44.5" width="10" height="2" rx="0.5" fill="#1e293b"/>
      <rect x="60" y="44.5" width="10" height="2" rx="0.5" fill="#1e293b"/>
      <rect x="78" y="44.5" width="12" height="2" rx="0.5" fill="#1e293b"/>
      <line x1="6" y1="48" x2="94" y2="48" stroke="#e5e7eb" strokeWidth="0.8"/>
      {[0,1,2].map(i => (
        <g key={i}>
          <rect x="8" y={51.5+i*7} width="18" height="1.8" rx="0.5" fill="#374151"/>
          <rect x="38" y={51.5+i*7} width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
          <rect x="60" y={51.5+i*7} width="10" height="1.8" rx="0.5" fill="#9ca3af"/>
          <rect x="78" y={51.5+i*7} width="12" height="1.8" rx="0.5" fill="#374151"/>
          <line x1="6" y1={56+i*7} x2="94" y2={56+i*7} stroke="#f1f5f9" strokeWidth="0.5"/>
        </g>
      ))}
      <rect x="58" y="72" width="36" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="58" y="76" width="36" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="58" y1="80" x2="94" y2="80" stroke="#1e293b" strokeWidth="1"/>
      <rect x="58" y="83" width="36" height="3" rx="0.5" fill="#1e293b"/>
      <line x1="6" y1="91" x2="94" y2="91" stroke="#e5e7eb" strokeWidth="0.8"/>
      <rect x="6" y="94" width="28" height="1.8" rx="0.5" fill="#9ca3af"/>
      <rect x="6" y="98" width="38" height="1.8" rx="0.5" fill="#9ca3af"/>
      <line x1="6" y1="116" x2="30" y2="116" stroke="#9ca3af" strokeWidth="0.8"/>
      <line x1="68" y1="116" x2="94" y2="116" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="10" y="119" width="14" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="64" y="119" width="22" height="1.5" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

function ThL1() {
  return (
    <svg viewBox="0 0 70 210" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="70" height="210" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      <rect x="22" y="7" width="26" height="9" rx="1.5" fill="#e0e7ff"/>
      <rect x="10" y="18" width="50" height="3.5" rx="1" fill="#1e293b"/>
      <rect x="12" y="23.5" width="46" height="2" rx="0.8" fill="#9ca3af"/>
      <rect x="14" y="27" width="42" height="2" rx="0.8" fill="#9ca3af"/>
      <rect x="14" y="31" width="38" height="2" rx="0.8" fill="#9ca3af"/>
      <line x1="4" y1="37" x2="66" y2="37" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="16" y="40" width="38" height="4.5" rx="1" fill="#374151"/>
      <rect x="20" y="46.5" width="30" height="2.5" rx="0.8" fill="#6b7280"/>
      <rect x="22" y="50.5" width="26" height="2" rx="0.8" fill="#9ca3af"/>
      <line x1="4" y1="56" x2="66" y2="56" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="58.5" width="12" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="4" y="62.5" width="36" height="2.5" rx="0.8" fill="#374151"/>
      <line x1="4" y1="68" x2="66" y2="68" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <line x1="4" y1="71" x2="66" y2="71" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="73.5" width="22" height="2" rx="0.5" fill="#6b7280"/>
      <rect x="46" y="73.5" width="16" height="2" rx="0.5" fill="#6b7280"/>
      <line x1="4" y1="78" x2="66" y2="78" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="4" y={80.5+i*14} width="34" height="2.5" rx="0.5" fill="#374151"/>
          <rect x="4" y={84.5+i*14} width="20" height="2" rx="0.5" fill="#9ca3af"/>
          <rect x="48" y={81.5+i*14} width="14" height="3.5" rx="0.5" fill="#374151"/>
          <line x1="4" y1={94+i*14} x2="66" y2={94+i*14} stroke="#f3f4f6" strokeWidth="0.5"/>
        </g>
      ))}
      <line x1="4" y1="138" x2="66" y2="138" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="141" width="28" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="44" y="141" width="18" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="4" y="145.5" width="20" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="44" y="145.5" width="18" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="4" y1="150.5" x2="66" y2="150.5" stroke="#000" strokeWidth="1"/>
      <rect x="4" y="153" width="26" height="3.5" rx="0.5" fill="#374151"/>
      <rect x="40" y="153" width="22" height="3.5" rx="0.5" fill="#374151"/>
      <line x1="4" y1="160" x2="66" y2="160" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="163" width="32" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="4" y="167.5" width="46" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="14" y1="182" x2="56" y2="182" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="18" y="185" width="28" height="1.5" rx="0.5" fill="#d1d5db"/>
      <line x1="4" y1="196" x2="66" y2="196" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="22" y="199" width="26" height="2" rx="0.5" fill="#e5e7eb"/>
    </svg>
  );
}

function ThL2() {
  return (
    <svg viewBox="0 0 70 210" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="70" height="210" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      <rect x="22" y="7" width="26" height="9" rx="1.5" fill="#e0e7ff"/>
      <rect x="10" y="18" width="50" height="3.5" rx="1" fill="#1e293b"/>
      <rect x="14" y="24" width="42" height="2" rx="0.8" fill="#9ca3af"/>
      <line x1="4" y1="29" x2="66" y2="29" stroke="#000" strokeWidth="0.8"/>
      <rect x="16" y="32" width="38" height="4" rx="1" fill="#374151"/>
      <rect x="20" y="38" width="30" height="2.5" rx="0.8" fill="#6b7280"/>
      <rect x="22" y="42" width="26" height="2" rx="0.8" fill="#9ca3af"/>
      <line x1="4" y1="47" x2="66" y2="47" stroke="#000" strokeWidth="0.8"/>
      <rect x="4" y="50" width="12" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="4" y="54" width="36" height="2.5" rx="0.8" fill="#374151"/>
      <line x1="4" y1="60" x2="66" y2="60" stroke="#000" strokeWidth="0.8"/>
      <line x1="4" y1="63" x2="66" y2="63" stroke="#000" strokeWidth="0.8"/>
      <rect x="4" y="65" width="20" height="2" rx="0.5" fill="#6b7280"/>
      <rect x="46" y="65" width="16" height="2" rx="0.5" fill="#6b7280"/>
      <line x1="4" y1="70" x2="66" y2="70" stroke="#000" strokeWidth="0.8"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="4" y={72.5+i*12} width="30" height="2.5" rx="0.5" fill="#374151"/>
          <rect x="48" y={73.5+i*12} width="14" height="3.5" rx="0.5" fill="#374151"/>
          <line x1="4" y1={84+i*12} x2="66" y2={84+i*12} stroke="#f3f4f6" strokeWidth="0.5"/>
        </g>
      ))}
      <line x1="4" y1="122" x2="66" y2="122" stroke="#000" strokeWidth="0.8"/>
      <rect x="4" y="125" width="28" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="44" y="125" width="18" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="4" y="129.5" width="20" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="44" y="129.5" width="18" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="4" y1="134" x2="66" y2="134" stroke="#000" strokeWidth="1"/>
      <rect x="4" y="137" width="24" height="3.5" rx="0.5" fill="#374151"/>
      <rect x="40" y="137" width="22" height="3.5" rx="0.5" fill="#374151"/>
      <line x1="4" y1="145" x2="66" y2="145" stroke="#000" strokeWidth="0.8"/>
      <rect x="14" y="158" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="14" y1="172" x2="56" y2="172" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="18" y="175" width="28" height="1.5" rx="0.5" fill="#d1d5db"/>
      <line x1="4" y1="185" x2="66" y2="185" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="22" y="188" width="26" height="2" rx="0.5" fill="#e5e7eb"/>
    </svg>
  );
}

function ThL3() {
  return (
    <svg viewBox="0 0 70 210" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="70" height="210" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2"/>
      {/* Minimal - just company name centered, no logo */}
      <rect x="8" y="10" width="54" height="5" rx="1.5" fill="#1e293b"/>
      <rect x="16" y="17" width="38" height="2.5" rx="1" fill="#9ca3af"/>
      <line x1="4" y1="23" x2="66" y2="23" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="14" y="26" width="42" height="4" rx="1" fill="#374151"/>
      <rect x="18" y="32.5" width="34" height="2.5" rx="0.8" fill="#6b7280"/>
      <rect x="20" y="36.5" width="30" height="2" rx="0.8" fill="#9ca3af"/>
      <line x1="4" y1="42" x2="66" y2="42" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="45" width="12" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="4" y="49" width="34" height="2.5" rx="0.8" fill="#374151"/>
      <line x1="4" y1="54" x2="66" y2="54" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="57" width="20" height="2" rx="0.5" fill="#6b7280"/>
      <rect x="46" y="57" width="16" height="2" rx="0.5" fill="#6b7280"/>
      <line x1="4" y1="62" x2="66" y2="62" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="4" y={64.5+i*11} width="26" height="2.5" rx="0.5" fill="#374151"/>
          <rect x="48" y={65.5+i*11} width="14" height="2.5" rx="0.5" fill="#374151"/>
          <line x1="4" y1={74+i*11} x2="66" y2={74+i*11} stroke="#f3f4f6" strokeWidth="0.4"/>
        </g>
      ))}
      <line x1="4" y1="112" x2="66" y2="112" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="4" y="115" width="22" height="2" rx="0.5" fill="#9ca3af"/>
      <rect x="44" y="115" width="18" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="4" y1="120" x2="66" y2="120" stroke="#000" strokeWidth="1.5"/>
      <rect x="4" y="123.5" width="22" height="4" rx="0.5" fill="#1e293b"/>
      <rect x="40" y="123.5" width="22" height="4" rx="0.5" fill="#1e293b"/>
      <line x1="4" y1="131" x2="66" y2="131" stroke="#000" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="14" y="141" width="42" height="2" rx="0.5" fill="#9ca3af"/>
      <line x1="16" y1="154" x2="54" y2="154" stroke="#9ca3af" strokeWidth="0.8"/>
      <rect x="20" y="157" width="30" height="1.5" rx="0.5" fill="#d1d5db"/>
      <line x1="4" y1="168" x2="66" y2="168" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2"/>
      <rect x="22" y="171" width="26" height="2" rx="0.5" fill="#e5e7eb"/>
    </svg>
  );
}

/* ─── Layout metadata ───────────────────────────────────────────────────── */

type PaperType = "a4" | "a5" | "thermal";

const PAPER_TYPES: { value: PaperType; label: string; size: string; desc: string }[] = [
  { value: "a4", label: "A4", size: "210 × 297 mm", desc: "Standard laser/inkjet printer" },
  { value: "a5", label: "A5", size: "148 × 210 mm", desc: "Compact half-page format" },
  { value: "thermal", label: "Thermal", size: "80 mm roll", desc: "POS / thermal receipt printer" },
];

const LAYOUTS: Record<PaperType, { style: "1"|"2"|"3"; name: string; desc: string; Preview: React.ComponentType }[]> = {
  a4: [
    { style: "1", name: "Classic",  desc: "Bordered table, gray header, all fields",         Preview: A4L1 },
    { style: "2", name: "Modern",   desc: "Indigo header band, clean alternating rows",       Preview: A4L2 },
    { style: "3", name: "Minimal",  desc: "Serif font, no borders — just horizontal rules",  Preview: A4L3 },
  ],
  a5: [
    { style: "1", name: "Standard", desc: "Bordered table, indigo title, compact A5",        Preview: A5L1 },
    { style: "2", name: "Bold",     desc: "Dark table header, crisp alternating rows",        Preview: A5L2 },
    { style: "3", name: "Slate",    desc: "Dark slate banner header, clean table lines",      Preview: A5L3 },
  ],
  thermal: [
    { style: "1", name: "Full",     desc: "All details, GSTIN, dashed separators, bank",     Preview: ThL1 },
    { style: "2", name: "Standard", desc: "Standard receipt, solid separators",               Preview: ThL2 },
    { style: "3", name: "Simple",   desc: "Minimal — name, items & total only",               Preview: ThL3 },
  ],
};

/* ─── Main component ────────────────────────────────────────────────────── */

export default function PrintSettings() {
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<{ name: string; desc: string; Preview: React.ComponentType } | null>(null);

  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast({ title: "Print settings saved" });
  };

  const openPreview = (item: { name: string; desc: string; Preview: React.ComponentType }) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const layouts = LAYOUTS[settings.printerType];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Print Settings</h1>

      {/* Paper Type */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" />Paper / Printer Type</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {PAPER_TYPES.map(pt => {
              const selected = settings.printerType === pt.value;
              return (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => { set("printerType", pt.value); set("layoutStyle", "1"); }}
                  className={`relative flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all focus:outline-none
                    ${selected ? "border-primary bg-primary/5" : "border-input bg-background hover:border-muted-foreground/40"}`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <p className={`text-sm font-bold ${selected ? "text-primary" : ""}`}>{pt.label}</p>
                  <p className="text-xs text-muted-foreground">{pt.size}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{pt.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Layout Style for selected paper type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Layout Style
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — 3 options for {settings.printerType.toUpperCase()}. Click the preview image to see a full-size sample.
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {layouts.map(({ style, name, desc, Preview }) => {
              const selected = settings.layoutStyle === style;
              return (
                <div key={style} className="flex flex-col gap-2">
                  {/* Thumbnail - clicking opens the preview modal */}
                  <button
                    type="button"
                    onClick={() => openPreview({ name, desc, Preview })}
                    className={`relative group rounded-lg border-2 overflow-hidden bg-gray-50 transition-all focus:outline-none
                      ${selected ? "border-primary shadow-md" : "border-input hover:border-muted-foreground/50"}`}
                    style={{
                      aspectRatio: settings.printerType === "thermal" ? "1/2.8" : settings.printerType === "a5" ? "5/7" : "3/4",
                    }}
                  >
                    <Preview />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5">
                        <ZoomIn className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    {selected && (
                      <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>

                  {/* Select button + label */}
                  <div className="space-y-0.5">
                    <p className={`text-sm font-semibold ${selected ? "text-primary" : ""}`}>{name}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="w-full h-7 text-xs"
                    onClick={() => set("layoutStyle", style)}
                  >
                    {selected ? "Selected" : "Use this"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Options */}
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice Options</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Invoice Copies</Label>
            <Select value={settings.invoiceCopies} onValueChange={v => set("invoiceCopies", v as any)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Copy (Original)</SelectItem>
                <SelectItem value="2">2 Copies (Original + Duplicate)</SelectItem>
                <SelectItem value="3">3 Copies (Original + Duplicate + Triplicate)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {Number(settings.invoiceCopies) > 1 && (
            <div className="space-y-1">
              <Label>Copy Labels (comma-separated)</Label>
              <Input value={settings.copyLabels} onChange={e => set("copyLabels", e.target.value)} placeholder="Original, Duplicate, Triplicate" />
            </div>
          )}
          <div className="space-y-1">
            <Label>Bill / Invoice Title</Label>
            <Input value={settings.billTitle} onChange={e => set("billTitle", e.target.value)} placeholder="TAX INVOICE" />
          </div>
        </CardContent>
      </Card>

      {/* Fields to Print */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fields to Print</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "showLogo", label: "Company Logo" },
              { key: "showCompanyName", label: "Company Name" },
              { key: "showAddress", label: "Company Address" },
              { key: "showGstin", label: "Company GSTIN" },
              { key: "showPartyGstin", label: "Customer GSTIN" },
              { key: "showHsnCode", label: "HSN Code Column" },
              { key: "showBankDetails", label: "Bank Details" },
              { key: "showSignatureLine", label: "Authorised Signature" },
              { key: "showFooter", label: "Footer / Terms" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-normal">{label}</Label>
                <Switch
                  checked={settings[key as keyof PrintSettings] as boolean}
                  onCheckedChange={v => set(key as keyof PrintSettings, v as any)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Acknowledgment */}
      <Card>
        <CardHeader><CardTitle className="text-base">Acknowledgment Receipt</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Print Acknowledgment</p>
              <p className="text-xs text-muted-foreground">When enabled, a "Print Acknowledgment" button appears on every sale invoice.</p>
            </div>
            <Switch checked={settings.printAcknowledgment} onCheckedChange={v => set("printAcknowledgment", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Terms & Conditions</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={settings.termsAndConditions}
            onChange={e => set("termsAndConditions", e.target.value)}
            placeholder="e.g. Goods once sold will not be taken back. Subject to local jurisdiction."
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">Printed at the bottom of every invoice</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave}>Save Print Settings</Button>
        <Button variant="outline" onClick={() => { setSettings(DEFAULT); localStorage.removeItem(STORAGE_KEY); toast({ title: "Reset to defaults" }); }}>
          Reset to Defaults
        </Button>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewItem?.name} — Sample Layout</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1 mb-3">{previewItem?.desc}</p>
          {previewItem && (
            <div className={`mx-auto bg-white border rounded-lg overflow-hidden shadow-sm
              ${settings.printerType === "thermal" ? "w-40" : settings.printerType === "a5" ? "w-64" : "w-80"}`}
              style={{
                aspectRatio: settings.printerType === "thermal" ? "1/2.8" : settings.printerType === "a5" ? "5/7" : "3/4",
              }}
            >
              <previewItem.Preview />
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Button onClick={() => { if (previewItem) { const l = layouts.find(x => x.name === previewItem.name); if (l) set("layoutStyle", l.style); } setPreviewOpen(false); }}>
              Use This Layout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
