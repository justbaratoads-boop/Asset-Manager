import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable, companySettingsTable, ledgersTable, stockCategoriesTable, stockItemsTable, partiesTable
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Admin user
  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.email, "admin@example.com")).limit(1);
  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash("password", 10);
    await db.insert(usersTable).values({
      name: "Admin User",
      email: "admin@example.com",
      passwordHash: hash,
      role: "admin",
      isActive: true,
    });
    console.log("Created admin user: admin@example.com / password");
  }

  // Company settings
  const existingSettings = await db.select().from(companySettingsTable).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(companySettingsTable).values({
      companyName: "My Business",
      address: "123 Main Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      gstin: "27AADCS0472N1Z1",
      pan: "AADCS0472N",
      phone: "+91 98765 43210",
      email: "info@mybusiness.com",
      invoicePrefix: "INV",
      enableGst: true,
      defaultState: "Maharashtra",
      defaultPrintFormat: "a4",
      billFooter: "Thank you for your business!",
    });
    console.log("Created company settings");
  }

  // Default ledgers
  const defaultLedgers = [
    { name: "Cash", group: "assets", nature: "dr", openingBalance: "10000" },
    { name: "Bank Account", group: "assets", nature: "dr", openingBalance: "50000" },
    { name: "Accounts Receivable", group: "assets", nature: "dr", openingBalance: "0" },
    { name: "Inventory", group: "assets", nature: "dr", openingBalance: "0" },
    { name: "Accounts Payable", group: "liabilities", nature: "cr", openingBalance: "0" },
    { name: "GST Payable", group: "liabilities", nature: "cr", openingBalance: "0" },
    { name: "Input GST (ITC)", group: "assets", nature: "dr", openingBalance: "0" },
    { name: "Output GST", group: "liabilities", nature: "cr", openingBalance: "0" },
    { name: "Sales", group: "income", nature: "cr", openingBalance: "0" },
    { name: "Purchase", group: "expense", nature: "dr", openingBalance: "0" },
    { name: "Capital Account", group: "capital", nature: "cr", openingBalance: "100000" },
    { name: "UPI Account", group: "assets", nature: "dr", openingBalance: "0" },
    { name: "Rent Expense", group: "expense", nature: "dr", openingBalance: "0" },
    { name: "Salary Expense", group: "expense", nature: "dr", openingBalance: "0" },
  ];

  const existingLedgers = await db.select().from(ledgersTable);
  if (existingLedgers.length === 0) {
    for (const l of defaultLedgers) {
      await db.insert(ledgersTable).values(l);
    }
    console.log("Created default ledgers");
  }

  // Stock categories
  const existingCats = await db.select().from(stockCategoriesTable);
  if (existingCats.length === 0) {
    const cats = ["Electronics", "Clothing", "Food & Beverages", "Hardware", "Stationery"];
    for (const name of cats) {
      await db.insert(stockCategoriesTable).values({ name });
    }
    console.log("Created sample categories");
  }

  // Sample stock items
  const existingItems = await db.select().from(stockItemsTable);
  if (existingItems.length === 0) {
    const cats = await db.select().from(stockCategoriesTable);
    const elecCat = cats.find(c => c.name === "Electronics");
    const items = [
      { name: "Product A", categoryId: elecCat?.id, hsnCode: "8471", unit: "pcs", purchaseRate: "500", saleRate: "750", minStockLevel: "5", physicalStock: "100" },
      { name: "Product B", categoryId: elecCat?.id, hsnCode: "8471", unit: "pcs", purchaseRate: "1200", saleRate: "1800", minStockLevel: "10", physicalStock: "50" },
      { name: "Product C", unit: "kg", purchaseRate: "200", saleRate: "280", minStockLevel: "20", physicalStock: "200", hsnCode: "1001" },
    ];
    for (const item of items) {
      await db.insert(stockItemsTable).values(item as any);
    }
    console.log("Created sample stock items");
  }

  // Sample parties
  const existingParties = await db.select().from(partiesTable);
  if (existingParties.length === 0) {
    await db.insert(partiesTable).values([
      { name: "ABC Corporation", type: "customer", city: "Mumbai", state: "Maharashtra", phone: "9876543210", openingBalance: "0", balanceType: "dr" },
      { name: "XYZ Traders", type: "supplier", city: "Delhi", state: "Delhi", phone: "9876543211", openingBalance: "0", balanceType: "cr" },
      { name: "Reliable Wholesale", type: "both", city: "Pune", state: "Maharashtra", phone: "9876543212", openingBalance: "5000", balanceType: "dr" },
    ]);
    console.log("Created sample parties");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
