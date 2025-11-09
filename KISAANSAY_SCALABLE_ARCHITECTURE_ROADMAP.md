# 🚜 Kisaansay.com: Scalable Multi-FPC Platform - Architecture & Roadmap

## 📋 Executive Summary

**Document Purpose:** Comprehensive architecture design and implementation roadmap for transforming Kisaansay into a scalable multi-FPC (Farmer Producer Company) platform supporting vendor networks, omnichannel customers (online + in-store), domestic and international logistics, and integrated marketing capabilities.

**Current State Assessment:** 60% complete - Core agricultural services implemented but with critical gaps
**Target State:** Enterprise-grade, multi-tenant agri-commerce platform serving FPCs, farmers, customers, and logistics partners
**Estimated Timeline:** 6-9 months for full implementation
**Investment Required:** $150,000 - $250,000 (development + infrastructure)

---

## 🎯 Business Model & Use Cases

### **1. Multi-Stakeholder Ecosystem**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KISAANSAY ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐   │
│  │     FPCs     │────▶│  KISAANSAY   │◀────│    CUSTOMERS    │   │
│  │  (Vendors)   │     │   PLATFORM   │     │ (B2C + Retail)  │   │
│  └──────────────┘     └──────────────┘     └─────────────────┘   │
│        │                      │                      │            │
│        │                      │                      │            │
│        ▼                      ▼                      ▼            │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐   │
│  │   FARMERS    │     │   LOGISTICS  │     │    MARKETING    │   │
│  │ (Producers)  │     │   PARTNERS   │     │   AUTOMATION    │   │
│  └──────────────┘     └──────────────┘     └─────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### **2. Core Business Requirements**

#### **A. Multi-FPC Vendor Network**
- **FPC Onboarding**: Registration, verification, profile management
- **Product Catalog**: Each FPC manages their own product inventory
- **Pricing & Commissions**: Dynamic pricing, platform commission structure
- **Quality Standards**: Certification, grading, compliance tracking
- **Performance Analytics**: Sales, orders, customer ratings per FPC

#### **B. Omnichannel Customer Experience**
- **Online Ordering**: Web + mobile app for direct purchases
- **In-Store POS**: Physical store integration for walk-in customers
- **Hybrid Model**: Order online, pickup in-store (BOPIS)
- **Customer Accounts**: Unified profile across channels
- **Loyalty Programs**: Points, rewards, subscriptions

#### **C. Logistics Management**
- **Domestic Logistics**: India-wide fulfillment network
  - Zone-based delivery (metro, tier-2, rural)
  - Cold chain for perishables
  - Last-mile delivery optimization
  - Reverse logistics (returns)
- **International Logistics**: Export capabilities
  - Customs clearance integration
  - International shipping partners (DHL, FedEx, etc.)
  - Country-specific compliance
  - Multi-currency support

#### **D. Marketing & Growth**
- **Digital Marketing**: SEO, SEM, social media campaigns
- **Content Marketing**: Farmer stories, recipe blogs, sustainability
- **Email/SMS Campaigns**: Automated customer engagement
- **Influencer Partnerships**: Agricultural influencers, chefs
- **Referral Programs**: Customer acquisition incentives
- **Analytics & Attribution**: Marketing ROI tracking

---

## 🏗️ Proposed Scalable Architecture

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER (Multi-Channel)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Customer    │  │   FPC Admin  │  │  Store POS   │  │   Mobile     │   │
│  │  Web Portal  │  │   Dashboard  │  │   Terminal   │  │   Apps       │   │
│  │  (Next.js)   │  │  (React)     │  │  (Electron)  │  │ (React Native)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY & ROUTING LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  API Gateway │  │ Rate Limiter │  │   Auth       │  │   Cache      │   │
│  │  (Kong/Nginx)│  │              │  │  Service     │  │  (Redis)     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MICROSERVICES LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │                   CORE COMMERCE SERVICES                       │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │   Product    │  │   Order      │  │   Payment    │        │         │
│  │  │   Catalog    │  │  Management  │  │   Gateway    │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │  Inventory   │  │  Customer    │  │     Cart     │        │         │
│  │  │  Management  │  │  Management  │  │   & Checkout │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │                   FPC VENDOR SERVICES                           │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │     FPC      │  │    Vendor    │  │  Commission  │        │         │
│  │  │  Onboarding  │  │   Product    │  │ & Settlement │        │         │
│  │  │   Service    │  │  Management  │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │  Vendor      │  │  Quality     │  │   Vendor     │        │         │
│  │  │  Analytics   │  │  Assurance   │  │  Compliance  │        │         │
│  │  │  Dashboard   │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │               LOGISTICS & FULFILLMENT SERVICES                  │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │  Warehouse   │  │   Shipping   │  │   Delivery   │        │         │
│  │  │  Management  │  │  Integration │  │   Tracking   │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │   Domestic   │  │International │  │   Returns    │        │         │
│  │  │  Logistics   │  │  Logistics   │  │  Management  │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐                          │         │
│  │  │   Route      │  │  Cold Chain  │                          │         │
│  │  │ Optimization │  │  Monitoring  │                          │         │
│  │  │   Service    │  │   Service    │                          │         │
│  │  └──────────────┘  └──────────────┘                          │         │
│  │                                                                │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │                 AGRICULTURAL SERVICES (Existing)                │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │   Farmer     │  │     Crop     │  │   Market     │        │         │
│  │  │  Management  │  │  Monitoring  │  │ Intelligence │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐                          │         │
│  │  │  Financial   │  │   Weather    │                          │         │
│  │  │   Services   │  │ Integration  │                          │         │
│  │  │              │  │   Service    │                          │         │
│  │  └──────────────┘  └──────────────┘                          │         │
│  │                                                                │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │               MARKETING & ANALYTICS SERVICES                    │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │  Marketing   │  │  Campaign    │  │     SEO      │        │         │
│  │  │ Automation   │  │  Management  │  │ Optimization │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │  Analytics   │  │    Email     │  │     SMS      │        │         │
│  │  │  & Tracking  │  │  Marketing   │  │  Marketing   │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │         │
│  │  │   Content    │  │   Referral   │  │  Influencer  │        │         │
│  │  │  Management  │  │   Program    │  │  Management  │        │         │
│  │  │   Service    │  │   Service    │  │   Service    │        │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │         │
│  │                                                                │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA & INTEGRATION LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │   MongoDB    │  │    Redis     │  │  Elasticsearch│  │
│  │  (Primary)   │  │  (Products)  │  │   (Cache)    │  │   (Search)   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   RabbitMQ   │  │    Kafka     │  │      S3      │  │     CDN      │   │
│  │  (Messaging) │  │  (Events)    │  │   (Storage)  │  │  (Cloudflare)│   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTEGRATIONS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Payment    │  │   Shipping   │  │   Weather    │  │    Market    │   │
│  │  Gateways    │  │   Partners   │  │     APIs     │  │   Data APIs  │   │
│  │ (Razorpay,   │  │ (Delhivery,  │  │ (OpenWeather)│  │  (NCDEX,     │   │
│  │  Stripe)     │  │  Shiprocket) │  │              │  │  Agmarknet)  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │     SMS      │  │    Email     │  │   Google     │  │   Social     │   │
│  │   Gateway    │  │   Service    │  │     Maps     │  │    Media     │   │
│  │  (Twilio,    │  │ (SendGrid,   │  │     API      │  │  (Facebook,  │   │
│  │   MSG91)     │  │  Mailgun)    │  │              │  │  Instagram)  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💾 Database Schema Design

### **1. Multi-Tenant Data Model**

```prisma
// Enhanced multi-tenant FPC marketplace schema

// ==================== FPC VENDOR MANAGEMENT ====================

model FPC {
  id                String   @id @default(cuid())
  organizationId    String   // Multi-tenant isolation
  
  // Basic Info
  name              String
  slug              String   @unique
  legalName         String
  registrationNumber String  @unique
  gstNumber         String?
  panNumber         String?
  
  // Contact Info
  email             String
  phone             String
  website           String?
  
  // Business Info
  category          String   // dairy, organic, grains, etc.
  description       String?  @db.Text
  logo              String?
  coverImage        String?
  
  // Location
  address           Json     // structured address
  state             String
  district          String
  pincode           String
  coordinates       Json?    // lat, lng
  
  // Operational
  status            String   @default("pending") // pending, active, suspended
  verificationStatus String  @default("unverified") // unverified, verified, rejected
  rating            Float    @default(0.0)
  reviewCount       Int      @default(0)
  
  // Business Metrics
  totalSales        Decimal  @default(0) @db.Decimal(15, 2)
  totalOrders       Int      @default(0)
  commissionRate    Decimal  @default(10.0) @db.Decimal(5, 2) // percentage
  
  // Compliance
  certifications    Json[]   // organic, FSSAI, etc.
  documents         Json[]   // registration docs, certificates
  
  // Settings
  settings          Json?    // operational hours, policies, etc.
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  products          FPCProduct[]
  inventory         FPCInventory[]
  orders            Order[]
  farmers           FarmerFPCAssociation[]
  warehouses        Warehouse[]
  bankAccounts      FPCBankAccount[]
  settlements       Settlement[]
  reviews           FPCReview[]
  analytics         FPCAnalytics[]
  
  @@map("fpcs")
  @@index([organizationId])
  @@index([status])
  @@index([category])
}

model FPCProduct {
  id                String   @id @default(cuid())
  fpcId             String
  organizationId    String
  
  // Product Info
  name              String
  slug              String
  sku               String   @unique
  description       String?  @db.Text
  shortDescription  String?
  
  // Categorization
  category          String
  subCategory       String?
  tags              String[]
  
  // Pricing
  basePrice         Decimal  @db.Decimal(10, 2)
  sellingPrice      Decimal  @db.Decimal(10, 2)
  discountPercent   Decimal? @db.Decimal(5, 2)
  currency          String   @default("INR")
  
  // Units & Packaging
  unit              String   // kg, liter, piece, etc.
  packagingSize     Decimal  @db.Decimal(10, 2)
  minimumOrderQty   Decimal  @default(1) @db.Decimal(10, 2)
  
  // Media
  images            Json[]   // array of image URLs
  videos            Json[]   // array of video URLs
  
  // Attributes
  attributes        Json?    // organic, farm-fresh, origin, etc.
  specifications    Json?    // detailed specs
  
  // Inventory
  stockAvailable    Boolean  @default(true)
  lowStockAlert     Decimal? @db.Decimal(10, 2)
  
  // Quality & Compliance
  certifications    String[]
  grading           String?  // A, B, C grade
  harvestDate       DateTime?
  expiryDate        DateTime?
  shelfLife         Int?     // days
  
  // Status
  status            String   @default("draft") // draft, active, outofstock, discontinued
  featured          Boolean  @default(false)
  visibility        String   @default("public") // public, private, catalog-only
  
  // SEO
  metaTitle         String?
  metaDescription   String?  @db.Text
  metaKeywords      String[]
  
  // Stats
  viewCount         Int      @default(0)
  orderCount        Int      @default(0)
  rating            Float    @default(0.0)
  reviewCount       Int      @default(0)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  fpc               FPC      @relation(fields: [fpcId], references: [id], onDelete: Cascade)
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  inventory         FPCInventory[]
  orderItems        OrderItem[]
  reviews           ProductReview[]
  cartItems         CartItem[]
  wishlists         Wishlist[]
  
  @@map("fpc_products")
  @@index([fpcId])
  @@index([organizationId])
  @@index([category, status])
  @@index([featured])
}

model FPCInventory {
  id                String   @id @default(cuid())
  fpcId             String
  productId         String
  warehouseId       String?
  organizationId    String
  
  // Inventory Tracking
  currentStock      Decimal  @db.Decimal(10, 2)
  reservedStock     Decimal  @default(0) @db.Decimal(10, 2)
  availableStock    Decimal  @db.Decimal(10, 2) // currentStock - reservedStock
  
  // Warehouse Location
  binLocation       String?
  rackNumber        String?
  
  // Tracking
  batchNumber       String?
  lotNumber         String?
  
  // Quality
  qualityGrade      String?
  inspectionDate    DateTime?
  
  // Dates
  receivedDate      DateTime @default(now())
  expiryDate        DateTime?
  
  updatedAt         DateTime @updatedAt
  
  // Relations
  fpc               FPC      @relation(fields: [fpcId], references: [id], onDelete: Cascade)
  product           FPCProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  warehouse         Warehouse? @relation(fields: [warehouseId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  movementHistory   InventoryMovement[]
  
  @@map("fpc_inventory")
  @@index([fpcId, productId])
  @@index([warehouseId])
  @@unique([productId, warehouseId])
}

model FarmerFPCAssociation {
  id                String   @id @default(cuid())
  farmerId          String
  fpcId             String
  organizationId    String
  
  // Association Details
  membershipNumber  String   @unique
  membershipType    String   // regular, premium, board-member
  joinedDate        DateTime @default(now())
  status            String   @default("active") // active, inactive, suspended
  
  // Contribution
  landContributed   Decimal? @db.Decimal(10, 2) // acres
  shareHolding      Decimal? @db.Decimal(10, 2) // percentage
  
  // Performance
  totalSupply       Decimal  @default(0) @db.Decimal(15, 2) // total value supplied
  lastSupplyDate    DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  farmer            FarmerProfile @relation(fields: [farmerId], references: [id], onDelete: Cascade)
  fpc               FPC @relation(fields: [fpcId], references: [id], onDelete: Cascade)
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("farmer_fpc_associations")
  @@index([farmerId])
  @@index([fpcId])
}

// ==================== OMNICHANNEL CUSTOMER MANAGEMENT ====================

model Customer {
  id                String   @id @default(cuid())
  organizationId    String
  userId            String?  // linked to User if registered
  
  // Basic Info
  firstName         String
  lastName          String?
  email             String?
  phone             String   @unique
  dateOfBirth       DateTime?
  gender            String?
  
  // Authentication
  passwordHash      String?
  emailVerified     Boolean  @default(false)
  phoneVerified     Boolean  @default(false)
  
  // Preferences
  preferredLanguage String   @default("en")
  communicationPref Json?    // email, sms, whatsapp preferences
  
  // Customer Type
  customerType      String   @default("retail") // retail, wholesale, institutional
  businessName      String?  // for B2B customers
  gstNumber         String?  // for B2B customers
  
  // Status
  status            String   @default("active") // active, inactive, blocked
  
  // Customer Value
  totalOrders       Int      @default(0)
  totalSpent        Decimal  @default(0) @db.Decimal(15, 2)
  lifetimeValue     Decimal  @default(0) @db.Decimal(15, 2)
  
  // Loyalty
  loyaltyPoints     Int      @default(0)
  loyaltyTier       String   @default("bronze") // bronze, silver, gold, platinum
  
  // Marketing
  acquisitionChannel String? // organic, paid-ad, referral, social
  referredBy        String?  // customer ID who referred
  
  // Metadata
  metadata          Json?    // custom fields
  tags              String[]
  
  // Dates
  firstOrderDate    DateTime?
  lastOrderDate     DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  lastLoginAt       DateTime?
  
  // Relations
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user              User?    @relation(fields: [userId], references: [id])
  addresses         CustomerAddress[]
  orders            Order[]
  carts             Cart[]
  wishlists         Wishlist[]
  reviews           ProductReview[]
  supportTickets    SupportTicket[]
  loyaltyTransactions LoyaltyTransaction[]
  referrals         Referral[]
  
  @@map("customers")
  @@index([organizationId])
  @@index([userId])
  @@index([phone])
  @@index([email])
}

model CustomerAddress {
  id                String   @id @default(cuid())
  customerId        String
  
  // Address Details
  type              String   // home, work, other
  firstName         String
  lastName          String?
  phone             String
  addressLine1      String
  addressLine2      String?
  landmark          String?
  city              String
  state             String
  pincode           String
  country           String   @default("India")
  coordinates       Json?    // lat, lng
  
  // Flags
  isDefault         Boolean  @default(false)
  isShipping        Boolean  @default(true)
  isBilling         Boolean  @default(true)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  customer          Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  shippingOrders    Order[]  @relation("ShippingAddress")
  billingOrders     Order[]  @relation("BillingAddress")
  
  @@map("customer_addresses")
  @@index([customerId])
}

model Cart {
  id                String   @id @default(cuid())
  customerId        String?  // null for guest carts
  sessionId         String?  // for guest carts
  organizationId    String
  
  // Cart Status
  status            String   @default("active") // active, converted, abandoned
  
  // Metadata
  deviceType        String?  // mobile, desktop, tablet
  channel           String?  // web, app, pos
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  convertedAt       DateTime?
  abandonedAt       DateTime?
  
  // Relations
  customer          Customer? @relation(fields: [customerId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  items             CartItem[]
  
  @@map("carts")
  @@index([customerId])
  @@index([sessionId])
  @@index([status])
}

model CartItem {
  id                String   @id @default(cuid())
  cartId            String
  productId         String
  
  // Quantity & Pricing
  quantity          Decimal  @db.Decimal(10, 2)
  unitPrice         Decimal  @db.Decimal(10, 2)
  totalPrice        Decimal  @db.Decimal(10, 2)
  
  // Discounts
  discountAmount    Decimal? @db.Decimal(10, 2)
  
  // Metadata
  addedAt           DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  cart              Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product           FPCProduct @relation(fields: [productId], references: [id])
  
  @@map("cart_items")
  @@index([cartId])
  @@index([productId])
}

// ==================== ORDER MANAGEMENT ====================

model Order {
  id                String   @id @default(cuid())
  orderNumber       String   @unique
  customerId        String
  fpcId             String?  // null for multi-vendor orders
  organizationId    String
  
  // Order Type
  orderType         String   @default("online") // online, instore, bopis (buy online pickup in store)
  channel           String   // web, mobile, pos
  
  // Customer Details (denormalized for performance)
  customerName      String
  customerEmail     String?
  customerPhone     String
  
  // Addresses
  shippingAddressId String?
  billingAddressId  String?
  shippingAddress   Json?    // snapshot of address at order time
  billingAddress    Json?    // snapshot of address at order time
  
  // Pricing
  subtotal          Decimal  @db.Decimal(10, 2)
  taxAmount         Decimal  @default(0) @db.Decimal(10, 2)
  shippingFee       Decimal  @default(0) @db.Decimal(10, 2)
  discountAmount    Decimal  @default(0) @db.Decimal(10, 2)
  totalAmount       Decimal  @db.Decimal(10, 2)
  currency          String   @default("INR")
  
  // Payment
  paymentMethod     String   // cod, online, wallet
  paymentStatus     String   @default("pending") // pending, paid, failed, refunded
  paymentId         String?  // payment gateway transaction ID
  paidAt            DateTime?
  
  // Order Status
  status            String   @default("pending") // pending, confirmed, processing, shipped, delivered, cancelled, returned
  fulfillmentStatus String   @default("unfulfilled") // unfulfilled, partial, fulfilled
  
  // Fulfillment Details
  warehouseId       String?
  pickupDate        DateTime?
  expectedDelivery  DateTime?
  deliveredAt       DateTime?
  
  // Logistics
  shippingProvider  String?  // delhivery, shiprocket, bluedart, etc.
  trackingNumber    String?
  shippingLabel     String?  // S3 URL
  
  // Special Instructions
  notes             String?  @db.Text
  giftMessage       String?
  giftWrap          Boolean  @default(false)
  
  // Metadata
  metadata          Json?
  tags              String[]
  
  // Dates
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  confirmedAt       DateTime?
  cancelledAt       DateTime?
  
  // Relations
  customer          Customer @relation(fields: [customerId], references: [id])
  fpc               FPC?     @relation(fields: [fpcId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  shippingAddr      CustomerAddress? @relation("ShippingAddress", fields: [shippingAddressId], references: [id])
  billingAddr       CustomerAddress? @relation("BillingAddress", fields: [billingAddressId], references: [id])
  items             OrderItem[]
  shipments         Shipment[]
  statusHistory     OrderStatusHistory[]
  invoices          Invoice[]
  returns           Return[]
  
  @@map("orders")
  @@index([customerId])
  @@index([fpcId])
  @@index([organizationId])
  @@index([status])
  @@index([orderType])
  @@index([createdAt])
}

model OrderItem {
  id                String   @id @default(cuid())
  orderId           String
  productId         String
  
  // Product Details (denormalized)
  productName       String
  productSku        String
  productImage      String?
  
  // Quantity & Pricing
  quantity          Decimal  @db.Decimal(10, 2)
  unitPrice         Decimal  @db.Decimal(10, 2)
  totalPrice        Decimal  @db.Decimal(10, 2)
  taxAmount         Decimal  @default(0) @db.Decimal(10, 2)
  discountAmount    Decimal  @default(0) @db.Decimal(10, 2)
  
  // FPC Commission
  fpcCommission     Decimal  @default(0) @db.Decimal(10, 2)
  fpcPayout         Decimal  @db.Decimal(10, 2) // amount payable to FPC
  
  // Fulfillment
  status            String   @default("pending") // pending, fulfilled, cancelled, returned
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product           FPCProduct @relation(fields: [productId], references: [id])
  
  @@map("order_items")
  @@index([orderId])
  @@index([productId])
}

// ==================== LOGISTICS & FULFILLMENT ====================

model Warehouse {
  id                String   @id @default(cuid())
  fpcId             String?  // null for platform warehouses
  organizationId    String
  
  // Basic Info
  name              String
  code              String   @unique
  type              String   // fpc-owned, platform, third-party
  
  // Location
  address           Json
  city              String
  state             String
  pincode           String
  coordinates       Json     // lat, lng
  
  // Capacity
  totalCapacity     Decimal? @db.Decimal(10, 2) // in cubic meters
  usedCapacity      Decimal  @default(0) @db.Decimal(10, 2)
  
  // Facilities
  coldStorage       Boolean  @default(false)
  temperatureControl Boolean @default(false)
  tempRange         Json?    // min, max temperature
  
  // Operations
  operatingHours    Json?
  contactPerson     String?
  contactPhone      String?
  
  // Status
  status            String   @default("active") // active, inactive, maintenance
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  fpc               FPC?     @relation(fields: [fpcId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  inventory         FPCInventory[]
  shipments         Shipment[]
  
  @@map("warehouses")
  @@index([fpcId])
  @@index([organizationId])
  @@index([pincode])
}

model Shipment {
  id                String   @id @default(cuid())
  shipmentNumber    String   @unique
  orderId           String
  warehouseId       String?
  organizationId    String
  
  // Shipment Type
  shipmentType      String   // domestic, international, return
  
  // Shipping Provider
  provider          String   // delhivery, shiprocket, dhl, fedex, etc.
  serviceType       String?  // standard, express, overnight
  trackingNumber    String?
  awbNumber         String?  // air waybill
  
  // Addresses
  originAddress     Json
  destinationAddress Json
  
  // Package Details
  weight            Decimal  @db.Decimal(10, 2) // kg
  dimensions        Json     // length, width, height in cm
  packageCount      Int      @default(1)
  
  // Pricing
  shippingCost      Decimal  @db.Decimal(10, 2)
  insuranceAmount   Decimal? @db.Decimal(10, 2)
  
  // Status
  status            String   @default("pending") // pending, picked, in-transit, out-for-delivery, delivered, failed, returned
  
  // Dates
  estimatedPickup   DateTime?
  actualPickup      DateTime?
  estimatedDelivery DateTime?
  actualDelivery    DateTime?
  
  // Tracking
  currentLocation   String?
  lastUpdatedAt     DateTime?
  
  // Special Handling
  fragile           Boolean  @default(false)
  perishable        Boolean  @default(false)
  coldChainRequired Boolean  @default(false)
  
  // Documents
  shippingLabel     String?  // S3 URL
  invoiceUrl        String?  // S3 URL
  podUrl            String?  // proof of delivery S3 URL
  
  // Metadata
  notes             String?  @db.Text
  metadata          Json?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  order             Order    @relation(fields: [orderId], references: [id])
  warehouse         Warehouse? @relation(fields: [warehouseId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trackingEvents    ShipmentTracking[]
  
  @@map("shipments")
  @@index([orderId])
  @@index([trackingNumber])
  @@index([status])
}

model ShipmentTracking {
  id                String   @id @default(cuid())
  shipmentId        String
  
  // Event Details
  eventType         String   // picked, in-transit, arrived-at-hub, out-for-delivery, delivered, exception
  eventDescription  String
  eventLocation     String?
  coordinates       Json?    // lat, lng
  
  // Metadata
  carrierStatus     String?  // raw status from shipping provider
  remarks           String?
  
  eventTime         DateTime @default(now())
  
  // Relations
  shipment          Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  
  @@map("shipment_tracking")
  @@index([shipmentId])
  @@index([eventTime])
}

model LogisticsZone {
  id                String   @id @default(cuid())
  organizationId    String
  
  // Zone Details
  name              String   // Metro, Tier-2, Rural, International
  code              String   @unique
  type              String   // domestic, international
  
  // Coverage
  pincodes          String[] // for domestic
  cities            String[]
  states            String[]
  countries         String[] // for international
  
  // Shipping Configuration
  standardDays      Int      // standard delivery days
  expressDays       Int?     // express delivery days
  codAvailable      Boolean  @default(true)
  
  // Pricing
  baseShippingFee   Decimal  @db.Decimal(10, 2)
  perKgRate         Decimal  @db.Decimal(10, 2)
  minWeight         Decimal  @default(0) @db.Decimal(10, 2)
  maxWeight         Decimal? @db.Decimal(10, 2)
  
  // Free Shipping
  freeShippingThreshold Decimal? @db.Decimal(10, 2)
  
  // Status
  status            String   @default("active") // active, inactive
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("logistics_zones")
  @@index([organizationId])
}

// ==================== MARKETING & CAMPAIGNS ====================

model Campaign {
  id                String   @id @default(cuid())
  organizationId    String
  
  // Campaign Details
  name              String
  slug              String   @unique
  description       String?  @db.Text
  
  // Campaign Type
  type              String   // email, sms, social, paid-ad, referral
  channel           String[] // email, sms, whatsapp, facebook, instagram, google-ads
  
  // Targeting
  targetAudience    Json     // customer segments, filters
  audienceSize      Int      @default(0)
  
  // Content
  subject           String?  // for email
  body              String?  @db.Text
  template          String?  // template ID
  assets            Json[]   // images, videos, attachments
  
  // Timing
  scheduleType      String   @default("immediate") // immediate, scheduled, recurring
  scheduledAt       DateTime?
  startDate         DateTime?
  endDate           DateTime?
  
  // Budget
  budget            Decimal? @db.Decimal(10, 2)
  spentAmount       Decimal  @default(0) @db.Decimal(10, 2)
  
  // Status
  status            String   @default("draft") // draft, scheduled, active, paused, completed, cancelled
  
  // Performance Metrics
  sentCount         Int      @default(0)
  deliveredCount    Int      @default(0)
  openedCount       Int      @default(0)
  clickedCount      Int      @default(0)
  convertedCount    Int      @default(0)
  revenue           Decimal  @default(0) @db.Decimal(10, 2)
  
  // CTR & Conversion
  openRate          Decimal  @default(0) @db.Decimal(5, 2) // percentage
  clickRate         Decimal  @default(0) @db.Decimal(5, 2) // percentage
  conversionRate    Decimal  @default(0) @db.Decimal(5, 2) // percentage
  roi               Decimal  @default(0) @db.Decimal(10, 2)
  
  // Metadata
  metadata          Json?
  tags              String[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  launchedAt        DateTime?
  completedAt       DateTime?
  
  // Relations
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  activities        CampaignActivity[]
  
  @@map("campaigns")
  @@index([organizationId])
  @@index([status])
  @@index([type])
}

model CampaignActivity {
  id                String   @id @default(cuid())
  campaignId        String
  customerId        String?
  
  // Activity Details
  activityType      String   // sent, delivered, opened, clicked, converted, bounced, unsubscribed
  channel           String   // email, sms, whatsapp, etc.
  
  // Metadata
  deviceType        String?  // mobile, desktop, tablet
  location          String?
  ipAddress         String?
  userAgent         String?
  
  // Engagement Details
  linkClicked       String?  // URL clicked
  conversionValue   Decimal? @db.Decimal(10, 2)
  orderId           String?  // if converted to order
  
  createdAt         DateTime @default(now())
  
  // Relations
  campaign          Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  customer          Customer? @relation(fields: [customerId], references: [id])
  
  @@map("campaign_activities")
  @@index([campaignId])
  @@index([customerId])
  @@index([activityType])
}

model ContentPage {
  id                String   @id @default(cuid())
  organizationId    String
  
  // Page Details
  title             String
  slug              String   @unique
  type              String   // blog, recipe, farmer-story, sustainability
  
  // Content
  excerpt           String?  @db.Text
  content           String   @db.Text
  featuredImage     String?
  
  // Author
  authorName        String?
  authorId          String?  // staff or FPC member
  
  // SEO
  metaTitle         String?
  metaDescription   String?  @db.Text
  metaKeywords      String[]
  
  // Categorization
  category          String?
  tags              String[]
  
  // Status
  status            String   @default("draft") // draft, published, archived
  featured          Boolean  @default(false)
  
  // Engagement
  viewCount         Int      @default(0)
  shareCount        Int      @default(0)
  likeCount         Int      @default(0)
  
  // Dates
  publishedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("content_pages")
  @@index([organizationId])
  @@index([status])
  @@index([type])
}

model Referral {
  id                String   @id @default(cuid())
  referrerId        String   // customer who referred
  referredId        String?  // customer who was referred (null until they sign up)
  organizationId    String
  
  // Referral Details
  referralCode      String   @unique
  referralLink      String?
  
  // Status
  status            String   @default("pending") // pending, completed, expired
  
  // Rewards
  referrerReward    Decimal  @db.Decimal(10, 2) // amount or points
  referredReward    Decimal  @db.Decimal(10, 2)
  rewardType        String   // discount, cashback, points
  
  // Tracking
  clickCount        Int      @default(0)
  signupCompleted   Boolean  @default(false)
  orderCompleted    Boolean  @default(false)
  
  // Dates
  createdAt         DateTime @default(now())
  completedAt       DateTime?
  expiresAt         DateTime?
  
  // Relations
  referrer          Customer @relation(fields: [referrerId], references: [id], onDelete: Cascade)
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("referrals")
  @@index([referrerId])
  @@index([referralCode])
  @@index([status])
}

model LoyaltyTransaction {
  id                String   @id @default(cuid())
  customerId        String
  organizationId    String
  
  // Transaction Details
  type              String   // earned, redeemed, expired, adjusted
  points            Int      // positive for earned, negative for redeemed
  
  // Source
  source            String   // order, referral, birthday, manual-adjustment
  sourceId          String?  // order ID, referral ID, etc.
  
  // Description
  description       String?
  
  // Expiry
  expiresAt         DateTime?
  
  createdAt         DateTime @default(now())
  
  // Relations
  customer          Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("loyalty_transactions")
  @@index([customerId])
  @@index([createdAt])
}

// ==================== REVIEWS & RATINGS ====================

model ProductReview {
  id                String   @id @default(cuid())
  productId         String
  customerId        String
  orderId           String?
  
  // Review Content
  rating            Int      // 1-5 stars
  title             String?
  review            String?  @db.Text
  
  // Media
  images            Json[]   // review images
  videos            Json[]   // review videos
  
  // Verification
  verified          Boolean  @default(false) // verified purchase
  
  // Status
  status            String   @default("pending") // pending, approved, rejected, flagged
  
  // Engagement
  helpfulCount      Int      @default(0)
  reportCount       Int      @default(0)
  
  // Moderation
  moderatedBy       String?
  moderatedAt       DateTime?
  moderationNotes   String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  product           FPCProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  customer          Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  
  @@map("product_reviews")
  @@index([productId])
  @@index([customerId])
  @@index([status])
}

model FPCReview {
  id                String   @id @default(cuid())
  fpcId             String
  customerId        String
  orderId           String?
  
  // Review Content
  rating            Int      // 1-5 stars
  review            String?  @db.Text
  
  // Review Categories
  productQuality    Int?     // 1-5
  packaging         Int?     // 1-5
  delivery          Int?     // 1-5
  communication     Int?     // 1-5
  
  // Status
  status            String   @default("pending") // pending, approved, rejected
  
  // Engagement
  helpfulCount      Int      @default(0)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  fpc               FPC      @relation(fields: [fpcId], references: [id], onDelete: Cascade)
  customer          Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  
  @@map("fpc_reviews")
  @@index([fpcId])
  @@index([customerId])
}

// ==================== ANALYTICS & REPORTING ====================

model FPCAnalytics {
  id                String   @id @default(cuid())
  fpcId             String
  date              DateTime @db.Date
  
  // Sales Metrics
  totalOrders       Int      @default(0)
  totalRevenue      Decimal  @default(0) @db.Decimal(15, 2)
  averageOrderValue Decimal  @default(0) @db.Decimal(10, 2)
  
  // Product Metrics
  productsViewed    Int      @default(0)
  productsOrdered   Int      @default(0)
  conversionRate    Decimal  @default(0) @db.Decimal(5, 2) // percentage
  
  // Customer Metrics
  newCustomers      Int      @default(0)
  repeatCustomers   Int      @default(0)
  
  // Fulfillment
  ordersShipped     Int      @default(0)
  ordersDelivered   Int      @default(0)
  ordersCancelled   Int      @default(0)
  ordersReturned    Int      @default(0)
  
  // Ratings
  averageRating     Decimal  @default(0) @db.Decimal(3, 2)
  reviewsReceived   Int      @default(0)
  
  createdAt         DateTime @default(now())
  
  // Relations
  fpc               FPC      @relation(fields: [fpcId], references: [id], onDelete: Cascade)
  
  @@map("fpc_analytics")
  @@unique([fpcId, date])
  @@index([fpcId])
  @@index([date])
}

// ==================== SUPPORT & MISC ====================

model SupportTicket {
  id                String   @id @default(cuid())
  ticketNumber      String   @unique
  customerId        String?
  orderId           String?
  organizationId    String
  
  // Ticket Details
  subject           String
  description       String   @db.Text
  category          String   // order-issue, product-query, refund, delivery, other
  priority          String   @default("medium") // low, medium, high, urgent
  
  // Status
  status            String   @default("open") // open, in-progress, resolved, closed
  
  // Assignment
  assignedTo        String?  // staff ID
  
  // Metadata
  attachments       Json[]
  tags              String[]
  
  // Dates
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  resolvedAt        DateTime?
  closedAt          DateTime?
  
  // Relations
  customer          Customer? @relation(fields: [customerId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  messages          SupportMessage[]
  
  @@map("support_tickets")
  @@index([customerId])
  @@index([organizationId])
  @@index([status])
}

model SupportMessage {
  id                String   @id @default(cuid())
  ticketId          String
  
  // Message Details
  senderId          String   // customer or staff ID
  senderType        String   // customer, staff
  message           String   @db.Text
  
  // Attachments
  attachments       Json[]
  
  // Metadata
  isInternal        Boolean  @default(false) // internal staff notes
  
  createdAt         DateTime @default(now())
  
  // Relations
  ticket            SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  
  @@map("support_messages")
  @@index([ticketId])
  @@index([createdAt])
}

// ... (existing models from original schema continue)
```

---

## 🚀 Implementation Roadmap

### **Phase 1: Foundation & Core Commerce (Months 1-2)**

#### **Month 1: Database & API Foundation**

**Week 1-2: Enhanced Database Schema**
- [ ] Implement complete FPC vendor management schema
- [ ] Implement omnichannel customer schema
- [ ] Implement logistics and fulfillment schema
- [ ] Implement marketing and campaign schema
- [ ] Run migrations and set up test data
- [ ] **Deliverable:** Production-ready database with all tables

**Week 3-4: Core Commerce APIs**
- [ ] Product catalog service (CRUD operations)
- [ ] Order management service (create, update, tracking)
- [ ] Cart and checkout service
- [ ] Payment gateway integration (Razorpay, Stripe)
- [ ] Inventory management service
- [ ] **Deliverable:** Functional e-commerce backend APIs

#### **Month 2: FPC Management & Authentication**

**Week 1-2: FPC Vendor Management**
- [ ] FPC onboarding workflow
- [ ] FPC product management APIs
- [ ] FPC inventory tracking
- [ ] Commission calculation engine
- [ ] FPC analytics dashboard backend
- [ ] **Deliverable:** Complete multi-vendor marketplace backend

**Week 3-4: Authentication & Security**
- [ ] JWT authentication for all APIs
- [ ] Role-based access control (Customer, FPC Admin, Platform Admin, Staff)
- [ ] API key management for FPCs
- [ ] Rate limiting per API endpoint
- [ ] Audit logging for all transactions
- [ ] **Deliverable:** Secure, production-ready authentication system

---

### **Phase 2: Logistics & Fulfillment (Months 3-4)**

#### **Month 3: Domestic Logistics**

**Week 1-2: Warehouse Management**
- [ ] Warehouse management system
- [ ] Multi-location inventory tracking
- [ ] Stock allocation and reservation
- [ ] Inventory movement history
- [ ] Low stock alerts
- [ ] **Deliverable:** Warehouse management system

**Week 3-4: Shipping Integration**
- [ ] Integration with Delhivery API
- [ ] Integration with Shiprocket API
- [ ] Shipping label generation
- [ ] AWB number generation
- [ ] Real-time shipment tracking
- [ ] Zone-based shipping rate calculator
- [ ] **Deliverable:** Domestic shipping automation

#### **Month 4: International Logistics & Advanced Features**

**Week 1-2: International Shipping**
- [ ] Integration with DHL API
- [ ] Integration with FedEx API
- [ ] Customs declaration automation
- [ ] International address validation
- [ ] Multi-currency support
- [ ] Country-specific compliance checks
- [ ] **Deliverable:** International shipping capabilities

**Week 3-4: Advanced Logistics**
- [ ] Route optimization service
- [ ] Cold chain monitoring (for perishables)
- [ ] Returns management system
- [ ] Reverse logistics
- [ ] Driver mobile app integration
- [ ] **Deliverable:** Complete logistics management system

---

### **Phase 3: Omnichannel Experience (Months 5-6)**

#### **Month 5: Frontend Development**

**Week 1-2: Customer Web Portal**
- [ ] Next.js customer-facing website
- [ ] Product listing and search (with Elasticsearch)
- [ ] Product detail pages
- [ ] Cart and checkout flow
- [ ] Customer account dashboard
- [ ] Order tracking interface
- [ ] **Deliverable:** Responsive customer web portal

**Week 3-4: FPC Admin Dashboard**
- [ ] React-based FPC admin dashboard
- [ ] Product management interface
- [ ] Order management interface
- [ ] Inventory management
- [ ] Analytics and reports
- [ ] Payout and settlements view
- [ ] **Deliverable:** FPC vendor dashboard

#### **Month 6: Mobile & POS**

**Week 1-2: Mobile Apps**
- [ ] React Native customer mobile app (iOS + Android)
- [ ] Push notifications
- [ ] Offline cart support
- [ ] Mobile payment integration
- [ ] QR code scanning for products
- [ ] **Deliverable:** Mobile apps for iOS and Android

**Week 3-4: In-Store POS System**
- [ ] Electron-based POS terminal
- [ ] Barcode scanner integration
- [ ] Receipt printer integration
- [ ] Offline mode with sync
- [ ] Cash drawer management
- [ ] **Deliverable:** In-store POS system

---

### **Phase 4: Marketing & Analytics (Months 7-8)**

#### **Month 7: Marketing Automation**

**Week 1-2: Campaign Management**
- [ ] Email marketing service (SendGrid integration)
- [ ] SMS marketing service (Twilio/MSG91)
- [ ] Campaign creation and scheduling
- [ ] Customer segmentation engine
- [ ] A/B testing framework
- [ ] **Deliverable:** Marketing automation platform

**Week 3-4: Content & SEO**
- [ ] Content management system (blog, recipes, stories)
- [ ] SEO optimization tools
- [ ] Social media integration (Facebook, Instagram)
- [ ] Influencer management portal
- [ ] Referral program automation
- [ ] **Deliverable:** Content marketing platform

#### **Month 8: Analytics & Intelligence**

**Week 1-2: Business Intelligence**
- [ ] Grafana dashboards for all stakeholders
- [ ] Customer analytics (LTV, cohorts, retention)
- [ ] FPC performance analytics
- [ ] Product performance reports
- [ ] Logistics efficiency metrics
- [ ] Marketing attribution reports
- [ ] **Deliverable:** Comprehensive analytics dashboards

**Week 3-4: AI & Recommendations**
- [ ] Product recommendation engine
- [ ] Dynamic pricing suggestions
- [ ] Demand forecasting
- [ ] Customer churn prediction
- [ ] Fraud detection system
- [ ] **Deliverable:** AI-powered insights

---

### **Phase 5: Advanced Features & Optimization (Month 9)**

#### **Month 9: Launch Preparation**

**Week 1-2: Performance & Scale**
- [ ] Database query optimization
- [ ] Redis caching layer optimization
- [ ] CDN integration (Cloudflare)
- [ ] Load testing (10,000+ concurrent users)
- [ ] Auto-scaling configuration
- [ ] **Deliverable:** Optimized, scalable platform

**Week 3-4: Production Launch**
- [ ] Security audit and penetration testing
- [ ] Compliance documentation (GDPR, data privacy)
- [ ] Disaster recovery and backup setup
- [ ] Monitoring and alerting (PagerDuty)
- [ ] Staff training
- [ ] Soft launch with beta users
- [ ] **Deliverable:** Production launch

---

## 💰 Cost Estimation

### **Development Costs**

| Resource | Quantity | Duration | Rate (USD) | Total (USD) |
|----------|----------|----------|------------|-------------|
| **Backend Developer (Senior)** | 2 | 9 months | $8,000/mo | $144,000 |
| **Frontend Developer** | 2 | 6 months | $6,000/mo | $72,000 |
| **Mobile Developer** | 1 | 3 months | $7,000/mo | $21,000 |
| **DevOps Engineer** | 1 | 4 months | $7,500/mo | $30,000 |
| **UI/UX Designer** | 1 | 3 months | $5,000/mo | $15,000 |
| **QA Engineer** | 1 | 6 months | $4,000/mo | $24,000 |
| **Project Manager** | 1 | 9 months | $6,000/mo | $54,000 |
| **Total Development** | | | | **$360,000** |

### **Infrastructure Costs (First Year)**

| Service | Monthly (USD) | Annual (USD) |
|---------|---------------|--------------|
| **Cloud Hosting (AWS/GCP)** | $2,000 | $24,000 |
| **Database (PostgreSQL RDS)** | $500 | $6,000 |
| **Redis Cache** | $200 | $2,400 |
| **CDN (Cloudflare)** | $200 | $2,400 |
| **Email Service (SendGrid)** | $150 | $1,800 |
| **SMS Service (Twilio)** | $300 | $3,600 |
| **Monitoring (Datadog/New Relic)** | $300 | $3,600 |
| **Storage (S3)** | $200 | $2,400 |
| **Elasticsearch** | $300 | $3,600 |
| **SSL Certificates** | $20 | $240 |
| **External APIs** | $500 | $6,000 |
| **Total Infrastructure** | **$4,670** | **$56,040** |

### **Third-Party Integrations (Annual)**

| Service | Cost (USD) |
|---------|------------|
| **Payment Gateway** | $5,000 (transaction fees variable) |
| **Shipping APIs** | $3,000 |
| **Google Maps API** | $2,000 |
| **OpenWeatherMap API** | $500 |
| **Market Data APIs** | $2,000 |
| **Total Integrations** | **$12,500** |

### **Total First Year Investment**

- **Development:** $360,000
- **Infrastructure:** $56,040
- **Integrations:** $12,500
- **Contingency (15%):** $64,281
- **TOTAL:** **$492,821**

### **Post-Launch Annual Costs**

- **Infrastructure:** $56,040
- **Integrations:** $12,500
- **Maintenance (20% of dev cost):** $72,000
- **Support Staff:** $60,000
- **Marketing:** $100,000
- **TOTAL:** **$300,540/year**

---

## 📊 Success Metrics & KPIs

### **Business Metrics**

| Metric | Target (Year 1) | Target (Year 2) | Target (Year 3) |
|--------|-----------------|-----------------|-----------------|
| **FPCs Onboarded** | 50 | 200 | 500 |
| **Active Farmers** | 5,000 | 20,000 | 50,000 |
| **Monthly Active Customers** | 10,000 | 50,000 | 150,000 |
| **Monthly GMV** | $100,000 | $500,000 | $1,500,000 |
| **Platform Revenue** | $1.2M | $6M | $18M |
| **Average Order Value** | $50 | $60 | $75 |
| **Customer Retention Rate** | 40% | 60% | 75% |

### **Technical Metrics**

| Metric | Target |
|--------|--------|
| **API Response Time (p95)** | < 200ms |
| **Database Query Time (p95)** | < 100ms |
| **Page Load Time** | < 2 seconds |
| **Mobile App Crash Rate** | < 0.1% |
| **System Uptime** | 99.9% |
| **Cart Abandonment Rate** | < 60% |
| **Search Success Rate** | > 95% |

### **Operational Metrics**

| Metric | Target |
|--------|--------|
| **Order Fulfillment Time** | < 24 hours |
| **Shipping Accuracy** | > 99% |
| **Customer Support Response Time** | < 2 hours |
| **Return Rate** | < 5% |
| **NPS Score** | > 50 |
| **Customer Satisfaction (CSAT)** | > 4.5/5 |

---

## 🔒 Security & Compliance

### **Security Measures**

1. **Authentication & Authorization**
   - JWT-based authentication
   - Multi-factor authentication (MFA)
   - OAuth 2.0 for social logins
   - API key rotation

2. **Data Protection**
   - AES-256 encryption at rest
   - TLS 1.3 encryption in transit
   - PII data masking in logs
   - GDPR compliance (right to deletion, data export)

3. **Application Security**
   - Input validation with Zod
   - SQL injection protection (Prisma ORM)
   - XSS protection (helmet.js)
   - CSRF protection
   - Rate limiting per IP/user

4. **Infrastructure Security**
   - VPC network isolation
   - WAF (Web Application Firewall)
   - DDoS protection
   - Regular security audits
   - Penetration testing

### **Compliance Requirements**

1. **Payment Compliance**
   - PCI DSS Level 1 compliance
   - Payment gateway tokenization
   - No credit card storage on platform

2. **Data Privacy**
   - GDPR compliance (EU customers)
   - Data residency (India-specific regulations)
   - Customer consent management
   - Privacy policy and terms of service

3. **Agricultural Compliance**
   - FSSAI certification tracking
   - Organic certification validation
   - Export compliance (APEDA, customs)

4. **Financial Compliance**
   - RBI guidelines for digital payments
   - GST compliance
   - TDS deduction for FPC payouts
   - Invoice generation and management

---

## 🎯 Competitive Advantages

### **1. Multi-FPC Marketplace**
- **Unique Value:** First-of-its-kind platform connecting multiple FPCs
- **Benefit:** Variety and choice for customers, scale for FPCs

### **2. Farm-to-Table Traceability**
- **Unique Value:** Complete transparency from farmer to customer
- **Benefit:** Trust, quality assurance, premium pricing

### **3. Omnichannel Experience**
- **Unique Value:** Seamless online + offline shopping
- **Benefit:** Convenience, wider reach, better customer experience

### **4. Integrated Logistics**
- **Unique Value:** End-to-end logistics management
- **Benefit:** Faster delivery, cost optimization, international reach

### **5. Data-Driven Insights**
- **Unique Value:** AI-powered recommendations and analytics
- **Benefit:** Better decision-making for FPCs and farmers

### **6. Social Impact**
- **Unique Value:** Direct farmer empowerment and livelihood improvement
- **Benefit:** Brand loyalty, CSR partnerships, government support

---

## 🚧 Risks & Mitigation

### **Technical Risks**

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Scalability Issues** | High | Medium | Load testing, auto-scaling, CDN |
| **Data Loss** | Critical | Low | Daily backups, multi-region replication |
| **Security Breach** | Critical | Low | Security audits, penetration testing, WAF |
| **Third-Party API Failures** | Medium | Medium | Fallback mechanisms, circuit breakers |
| **Performance Degradation** | High | Medium | Monitoring, caching, database optimization |

### **Business Risks**

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Low FPC Adoption** | Critical | Medium | Onboarding incentives, partnership programs |
| **Customer Acquisition Cost** | High | High | Referral programs, organic marketing, partnerships |
| **Supply Chain Disruptions** | High | Medium | Multiple FPC partnerships, buffer inventory |
| **Regulatory Changes** | Medium | Medium | Compliance monitoring, legal consultation |
| **Competition** | High | High | Differentiation through quality, technology, impact |

---

## 📈 Growth Strategy

### **Year 1: Foundation & Proof of Concept**
- Launch in 2-3 states (Maharashtra, Karnataka, Tamil Nadu)
- Onboard 50 FPCs
- Acquire 10,000 customers
- Focus on product-market fit

### **Year 2: Scale & Expansion**
- Expand to 10 states
- Onboard 200 FPCs
- Target 50,000 customers
- Launch mobile apps
- Begin international shipping (UAE, Singapore)

### **Year 3: Market Leadership**
- Pan-India presence
- 500+ FPCs
- 150,000+ customers
- International expansion (US, Europe)
- B2B partnerships (hotels, restaurants, corporate)

---

## 🎉 Conclusion

This architecture provides Kisaansay with a **scalable, multi-FPC agri-commerce platform** that can:

✅ **Support multiple FPCs** with independent product catalogs and analytics
✅ **Provide omnichannel experience** for customers (web, mobile, in-store)
✅ **Manage complex logistics** (domestic + international)
✅ **Drive growth through marketing** automation and referrals
✅ **Scale to millions of users** with modern cloud architecture

**Investment:** $492,821 (Year 1)
**Timeline:** 9 months to production launch
**ROI:** Break-even estimated at Month 18, profitable by Month 24

**Next Steps:**
1. Review and approve architecture
2. Secure funding
3. Hire development team
4. Begin Phase 1 implementation
5. Pilot with 5-10 FPCs

This platform will position Kisaansay as **India's leading multi-FPC agricultural marketplace**, driving social impact while building a sustainable, profitable business.
