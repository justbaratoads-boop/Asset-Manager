import * as XLSX from "xlsx";

// Normalize column key (e.g. "Item Name*", "item_name", "ITEM NAME" -> "itemname")
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Map parsed object keys using normalized dictionary
export function mapRowFields<T extends Record<string, any>>(rawRow: Record<string, any>, keyMap: Record<string, string>): T {
  const normalizedRaw: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawRow)) {
    normalizedRaw[normalizeKey(k)] = typeof v === "string" ? v.trim() : v;
  }

  const result: Record<string, any> = {};
  for (const [targetField, aliases] of Object.entries(keyMap)) {
    const aliasList = aliases.split(",");
    for (const alias of aliasList) {
      const normAlias = normalizeKey(alias);
      if (normalizedRaw[normAlias] !== undefined && normalizedRaw[normAlias] !== "") {
        result[targetField] = normalizedRaw[normAlias];
        break;
      }
    }
  }
  return result as T;
}

// ----------------------------------------------------
// STOCK ITEMS TEMPLATE & VALIDATION
// ----------------------------------------------------

export interface ParsedStockItem {
  name: string;
  category?: string;
  hsnCode?: string;
  unit: string;
  purchaseRate: number;
  saleRate: number;
  openingStock: number;
  minStockLevel: number;
  gstApplicable: boolean;
  gstRate: number;
  taxType: string;
  barcode?: string;
  brand?: string;
  status: "valid" | "duplicate" | "error";
  errors: string[];
}

const STOCK_ITEM_KEY_MAP: Record<string, string> = {
  name: "itemname,name,productname,item",
  category: "category,categoryname,group",
  hsnCode: "hsncode,hsn,sac,hsnorsac",
  unit: "unit,uom,units",
  purchaseRate: "purchaserate,purchaseprice,costprice,buyrate,purchase",
  saleRate: "salerate,saleprice,sellingprice,mrp,sale",
  openingStock: "openingstock,physicalstock,initialstock,stock,qty,quantity",
  minStockLevel: "minstocklevel,minstock,minimumstock,reorderlevel",
  gstApplicable: "gstapplicable,taxapplicable,gstapply",
  gstRate: "gstrate,taxrate,gst%,tax%",
  taxType: "taxtype,type,pakkaorkaccha,islegal",
  barcode: "barcode,code,itemcode,sku",
  brand: "brand,make,company",
};

export function downloadStockItemTemplate() {
  const headers = [
    "Item Name*",
    "Category",
    "HSN Code",
    "Unit",
    "Purchase Rate",
    "Sale Rate",
    "Opening Stock",
    "Min Stock Level",
    "GST Applicable",
    "GST Rate (%)",
    "Tax Type",
    "Barcode",
    "Brand",
  ];

  const sampleRows = [
    {
      "Item Name*": "Cotton Casual Shirt - Blue (L)",
      Category: "Garments",
      "HSN Code": "6205",
      Unit: "pcs",
      "Purchase Rate": 450,
      "Sale Rate": 799,
      "Opening Stock": 50,
      "Min Stock Level": 10,
      "GST Applicable": "Yes",
      "GST Rate (%)": 5,
      "Tax Type": "Pakka",
      Barcode: "8901234567890",
      Brand: "Raymond",
    },
    {
      "Item Name*": "Wireless Optical Mouse",
      Category: "Electronics",
      "HSN Code": "8471",
      Unit: "pcs",
      "Purchase Rate": 320,
      "Sale Rate": 499,
      "Opening Stock": 25,
      "Min Stock Level": 5,
      "GST Applicable": "Yes",
      "GST Rate (%)": 18,
      "Tax Type": "Pakka",
      Barcode: "8909876543210",
      Brand: "Logitech",
    },
    {
      "Item Name*": "Corrugated Packaging Box 12x12",
      Category: "Packing Material",
      "HSN Code": "4819",
      Unit: "box",
      "Purchase Rate": 20,
      "Sale Rate": 35,
      "Opening Stock": 200,
      "Min Stock Level": 50,
      "GST Applicable": "No",
      "GST Rate (%)": 0,
      "Tax Type": "Pakka",
      Barcode: "",
      Brand: "",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  ws["!cols"] = [
    { wch: 32 }, // Item Name
    { wch: 18 }, // Category
    { wch: 12 }, // HSN Code
    { wch: 10 }, // Unit
    { wch: 15 }, // Purchase Rate
    { wch: 15 }, // Sale Rate
    { wch: 15 }, // Opening Stock
    { wch: 15 }, // Min Stock Level
    { wch: 15 }, // GST Applicable
    { wch: 14 }, // GST Rate
    { wch: 12 }, // Tax Type
    { wch: 18 }, // Barcode
    { wch: 15 }, // Brand
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock Items");
  XLSX.writeFile(wb, "Stock_Items_Import_Template.xlsx");
}

export function parseStockItemRows(rawRows: any[], existingNames: Set<string>): ParsedStockItem[] {
  return rawRows.map((raw) => {
    const mapped = mapRowFields<any>(raw, STOCK_ITEM_KEY_MAP);
    const errors: string[] = [];

    const name = String(mapped.name || "").trim();
    if (!name) {
      errors.push("Item name is required");
    }

    const unit = String(mapped.unit || "pcs").trim() || "pcs";
    const purchaseRate = Number(mapped.purchaseRate) || 0;
    const saleRate = Number(mapped.saleRate) || 0;
    const openingStock = Number(mapped.openingStock) || 0;
    const minStockLevel = Number(mapped.minStockLevel) || 0;

    let gstApplicable = false;
    const rawGstApp = String(mapped.gstApplicable || "").toLowerCase();
    if (rawGstApp === "yes" || rawGstApp === "true" || rawGstApp === "1") {
      gstApplicable = true;
    }

    const gstRate = Number(mapped.gstRate) || 0;
    if (gstApplicable && isNaN(gstRate)) {
      errors.push("Invalid GST Rate");
    }

    const taxType = String(mapped.taxType || "Pakka").trim();

    let status: "valid" | "duplicate" | "error" = "valid";
    if (errors.length > 0) {
      status = "error";
    } else if (name && existingNames.has(name.toLowerCase())) {
      status = "duplicate";
    }

    return {
      name,
      category: mapped.category ? String(mapped.category).trim() : undefined,
      hsnCode: mapped.hsnCode ? String(mapped.hsnCode).trim() : undefined,
      unit,
      purchaseRate,
      saleRate,
      openingStock,
      minStockLevel,
      gstApplicable,
      gstRate,
      taxType,
      barcode: mapped.barcode ? String(mapped.barcode).trim() : undefined,
      brand: mapped.brand ? String(mapped.brand).trim() : undefined,
      status,
      errors,
    };
  });
}

// ----------------------------------------------------
// LEDGERS TEMPLATE & VALIDATION
// ----------------------------------------------------

export interface ParsedLedger {
  name: string;
  group: string;
  openingBalance: number;
  balanceType: "dr" | "cr";
  gstin?: string;
  gstType: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  isParty: boolean;
  status: "valid" | "duplicate" | "error";
  errors: string[];
}

const LEDGER_KEY_MAP: Record<string, string> = {
  name: "ledgername,name,partyname,accountname,party,ledger",
  group: "group,accountgroup,undergroup,parentgroup,under",
  openingBalance: "openingbalance,balance,initialbalance,openbal",
  balanceType: "balancetype,nature,drcr,type,balancekind",
  gstin: "gstin,gstno,gstnumber,taxnumber",
  gstType: "gsttype,registrationtype,taxregtype",
  phone: "phone,mobile,contact,phonenumber,tel",
  email: "email,emailaddress,mail",
  address: "address,street,billingaddress",
  city: "city,town,district",
  state: "state,province",
  pincode: "pincode,pin,zip,postalcode",
  bankName: "bankname,bank",
  accountNumber: "accountnumber,accno,accountno,bankaccount",
  ifscCode: "ifsccode,ifsc",
};

export function downloadLedgerTemplate() {
  const headers = [
    "Ledger Name*",
    "Group*",
    "Opening Balance",
    "Balance Type (Dr/Cr)",
    "GSTIN",
    "GST Type",
    "Phone",
    "Email",
    "Address",
    "City",
    "State",
    "Pincode",
    "Bank Name",
    "Account Number",
    "IFSC Code",
  ];

  const sampleRows = [
    {
      "Ledger Name*": "Sharma Enterprises",
      "Group*": "Sundry Debtors",
      "Opening Balance": 25000,
      "Balance Type (Dr/Cr)": "Dr",
      GSTIN: "07AAAAA1234A1Z5",
      "GST Type": "Registered",
      Phone: "9876543210",
      Email: "sharma.ent@example.com",
      Address: "Shop 12, Main Market, Connaught Place",
      City: "New Delhi",
      State: "Delhi",
      Pincode: "110001",
      "Bank Name": "",
      "Account Number": "",
      "IFSC Code": "",
    },
    {
      "Ledger Name*": "Agarwal Textiles Pvt Ltd",
      "Group*": "Sundry Creditors",
      "Opening Balance": 65000,
      "Balance Type (Dr/Cr)": "Cr",
      GSTIN: "24BBBBB5678B1Z2",
      "GST Type": "Registered",
      Phone: "9123456780",
      Email: "info@agarwaltextiles.com",
      Address: "GIDC Industrial Estate, Ring Road",
      City: "Surat",
      State: "Gujarat",
      Pincode: "395002",
      "Bank Name": "",
      "Account Number": "",
      "IFSC Code": "",
    },
    {
      "Ledger Name*": "HDFC Bank Current A/c",
      "Group*": "Bank Accounts",
      "Opening Balance": 150000,
      "Balance Type (Dr/Cr)": "Dr",
      GSTIN: "",
      "GST Type": "",
      Phone: "",
      Email: "",
      Address: "",
      City: "",
      State: "",
      Pincode: "",
      "Bank Name": "HDFC Bank",
      "Account Number": "50200012345678",
      "IFSC Code": "HDFC0000123",
    },
    {
      "Ledger Name*": "Office Rent Expense",
      "Group*": "Indirect Expenses",
      "Opening Balance": 0,
      "Balance Type (Dr/Cr)": "Dr",
      GSTIN: "",
      "GST Type": "",
      Phone: "",
      Email: "",
      Address: "",
      City: "",
      State: "",
      Pincode: "",
      "Bank Name": "",
      "Account Number": "",
      "IFSC Code": "",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  ws["!cols"] = [
    { wch: 28 }, // Ledger Name
    { wch: 20 }, // Group
    { wch: 16 }, // Opening Balance
    { wch: 20 }, // Balance Type
    { wch: 18 }, // GSTIN
    { wch: 15 }, // GST Type
    { wch: 15 }, // Phone
    { wch: 25 }, // Email
    { wch: 35 }, // Address
    { wch: 15 }, // City
    { wch: 15 }, // State
    { wch: 10 }, // Pincode
    { wch: 18 }, // Bank Name
    { wch: 20 }, // Account Number
    { wch: 14 }, // IFSC Code
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ledgers");
  XLSX.writeFile(wb, "Ledgers_Import_Template.xlsx");
}

export function parseLedgerRows(rawRows: any[], existingNames: Set<string>): ParsedLedger[] {
  return rawRows.map((raw) => {
    const mapped = mapRowFields<any>(raw, LEDGER_KEY_MAP);
    const errors: string[] = [];

    const name = String(mapped.name || "").trim();
    if (!name) {
      errors.push("Ledger name is required");
    }

    const group = String(mapped.group || "").trim() || "Sundry Debtors";
    const lowerGroup = group.toLowerCase();
    const isParty = lowerGroup.includes("debtor") || lowerGroup.includes("creditor") || lowerGroup.includes("customer") || lowerGroup.includes("supplier");

    const openingBalance = Number(mapped.openingBalance) || 0;
    const rawBalType = String(mapped.balanceType || "").toLowerCase();
    const balanceType: "dr" | "cr" = rawBalType === "cr" ? "cr" : (lowerGroup.includes("creditor") || lowerGroup.includes("supplier") ? "cr" : "dr");

    const gstin = mapped.gstin ? String(mapped.gstin).trim().toUpperCase() : undefined;
    let gstType = String(mapped.gstType || "").trim().toLowerCase();
    if (!gstType) {
      gstType = gstin ? "registered" : "unregistered";
    }

    let status: "valid" | "duplicate" | "error" = "valid";
    if (errors.length > 0) {
      status = "error";
    } else if (name && existingNames.has(name.toLowerCase())) {
      status = "duplicate";
    }

    return {
      name,
      group,
      openingBalance,
      balanceType,
      gstin,
      gstType,
      phone: mapped.phone ? String(mapped.phone).trim() : undefined,
      email: mapped.email ? String(mapped.email).trim() : undefined,
      address: mapped.address ? String(mapped.address).trim() : undefined,
      city: mapped.city ? String(mapped.city).trim() : undefined,
      state: mapped.state ? String(mapped.state).trim() : undefined,
      pincode: mapped.pincode ? String(mapped.pincode).trim() : undefined,
      bankName: mapped.bankName ? String(mapped.bankName).trim() : undefined,
      accountNumber: mapped.accountNumber ? String(mapped.accountNumber).trim() : undefined,
      ifscCode: mapped.ifscCode ? String(mapped.ifscCode).trim() : undefined,
      isParty,
      status,
      errors,
    };
  });
}

// ----------------------------------------------------
// GENERIC FILE PARSER
// ----------------------------------------------------

export async function parseExcelFile(file: File): Promise<any[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  if (!workbook.SheetNames.length) {
    throw new Error("Excel file contains no sheets");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return json;
}
