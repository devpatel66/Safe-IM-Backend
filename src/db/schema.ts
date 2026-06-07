import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";

//
// 🏢 BUSINESS PROFILE (Your Company)
//
export const businessProfiles = pgTable("business_profiles", {
  id: serial("id").primaryKey(),

  name: text("name").notNull(),
  logoUrl: text("logo_url"),

  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  gstNumber: text("gst_number"),

  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifscCode: text("ifsc_code"),
  branch: text("branch"),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 🧑 CLIENTS
//
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),

  name: text("name").notNull(),
  gstNumber: text("gst_number"),
  address: text("address"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 📊 PLANS (Rate Lists)
//
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),

  clientId: integer("client_id")
    .references(() => clients.id)
    .notNull(),

  name: text("name").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 📈 PLAN RATES
//
export const planRates = pgTable("plan_rates", {
  id: serial("id").primaryKey(),

  planId: integer("plan_id")
    .references(() => plans.id)
    .notNull(),

  serviceType: text("service_type"), // per_km, airport, full_day
  vehicleType: text("vehicle_type"), // hatchback, sedan, suv
  acType: text("ac_type"), // ac / non_ac

  rate: numeric("rate"),
  extraRate: numeric("extra_rate"),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 🧾 INVOICES
//
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),

  invoiceNumber: text("invoice_number").notNull(),

  clientId: integer("client_id")
    .references(() => clients.id)
    .notNull(),

  planId: integer("plan_id").references(() => plans.id),

  invoiceDate: timestamp("invoice_date").notNull(),
  journeyMonth: text("journey_month"),

  journeyStartDate: timestamp("journey_start_date"),
  journeyEndDate: timestamp("journey_end_date"),

  vehicleType: text("vehicle_type"),
  vehicleModel: text("vehicle_model"),
  vehicleNumber: text("vehicle_number"),
  isAc: boolean("is_ac"),

  startKm: integer("start_km"),
  endKm: integer("end_km"),
  totalKm: integer("total_km"),

  startTime: text("start_time"),
  endTime: text("end_time"),

  parkingCharges: numeric("parking_charges"),
  tollCharges: numeric("toll_charges"),

  subtotal: numeric("subtotal"),
  sgst: numeric("sgst"),
  cgst: numeric("cgst"),
  total: numeric("total"),
  roundoffTotal: numeric("roundoff_total"),
  totalInWords: text("total_in_words"),

  notes: text("notes"),

  username: text("username"),
  department: text("department"),

  previousInvoiceNumber: text("previous_invoice_number"),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 📦 INVOICE ITEMS (IMPORTANT)
//
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),

  invoiceId: integer("invoice_id")
    .references(() => invoices.id)
    .notNull(),

  type: text("type"), // base / extra_km / waiting / night

  description: text("description"),

  rate: numeric("rate"),
  quantity: numeric("quantity"),
  amount: numeric("amount"),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 📄 STATEMENTS
//
export const statements = pgTable("statements", {
  id: serial("id").primaryKey(),

  statementNumber: text("statement_number").notNull(),

  clientId: integer("client_id")
    .references(() => clients.id)
    .notNull(),

  statementDate: timestamp("statement_date").notNull(),

  remarks: text("remarks"),
  title: text("title"),

  createdAt: timestamp("created_at").defaultNow(),
});

//
// 🔗 STATEMENT ITEMS
//
export const statementItems = pgTable("statement_items", {
  id: serial("id").primaryKey(),

  statementId: integer("statement_id")
    .references(() => statements.id)
    .notNull(),

  invoiceId: integer("invoice_id")
    .references(() => invoices.id)
    .notNull(),
});

//
// 🎆 FESTIVALS (Watermark Feature)
//
export const festivals = pgTable("festivals", {
  id: serial("id").primaryKey(),

  name: text("name"),
  imageUrl: text("image_url"),

  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  isActive: boolean("is_active"),

  createdAt: timestamp("created_at").defaultNow(),
});


//
// 👤 USERS (Authentication)
//
export const userRoleEnum = ["admin", "staff", "viewer"] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),

  name: text("name"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),      // always a bcrypt hash

  role: text("role")
    .$type<UserRole>()
    .notNull()
    .default("viewer"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow(),
});