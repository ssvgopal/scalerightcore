-- AlterTable
ALTER TABLE "farmer_profiles" ADD COLUMN     "aadhaarNumber" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "ifscCode" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "farmer_documents" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "land_records" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "surveyNumber" TEXT NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "soilType" TEXT NOT NULL,
    "irrigationType" TEXT NOT NULL,
    "boundaries" JSONB NOT NULL DEFAULT '{}',
    "ownershipType" TEXT NOT NULL,
    "leaseExpiry" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_health_records" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "diseaseDetected" TEXT[],
    "pestDetected" TEXT[],
    "nutrientDeficiency" TEXT[],
    "recommendations" JSONB NOT NULL DEFAULT '{}',
    "images" TEXT[],
    "assessedBy" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yield_predictions" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "predictedYield" DECIMAL(10,2) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "location" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "predictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "yield_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scores" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "tenure" INTEGER NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "policyId" TEXT,
    "damageType" TEXT NOT NULL,
    "damagePercentage" DOUBLE PRECISION NOT NULL,
    "damageArea" DECIMAL(10,2) NOT NULL,
    "claimAmount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'filed',
    "assessmentScore" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "filedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "coverageArea" DECIMAL(10,2) NOT NULL,
    "sumInsured" DECIMAL(10,2) NOT NULL,
    "premium" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selling_recommendations" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "variety" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "recommendedPrice" DECIMAL(10,2) NOT NULL,
    "market" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selling_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_alerts" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT,
    "location" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acknowledgedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_alerts" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT,
    "cropType" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "previousPrice" DECIMAL(10,2) NOT NULL,
    "changePercent" DOUBLE PRECISION NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acknowledgedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_verifications" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationData" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmer_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_policies_policyNumber_key" ON "insurance_policies"("policyNumber");

-- AddForeignKey
ALTER TABLE "farmer_documents" ADD CONSTRAINT "farmer_documents_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "land_records" ADD CONSTRAINT "land_records_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_health_records" ADD CONSTRAINT "crop_health_records_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_predictions" ADD CONSTRAINT "yield_predictions_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "insurance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selling_recommendations" ADD CONSTRAINT "selling_recommendations_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_alerts" ADD CONSTRAINT "weather_alerts_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_alerts" ADD CONSTRAINT "market_alerts_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_verifications" ADD CONSTRAINT "farmer_verifications_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
