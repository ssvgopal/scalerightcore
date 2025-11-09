-- CreateTable
CREATE TABLE "tenant_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isolationMode" TEXT NOT NULL DEFAULT 'schema',
    "customConfig" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_backups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_migrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromMode" TEXT NOT NULL,
    "toMode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_configs_organizationId_key" ON "tenant_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
