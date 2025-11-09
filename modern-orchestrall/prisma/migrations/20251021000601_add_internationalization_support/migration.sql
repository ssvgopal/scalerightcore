-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferredLanguage" TEXT DEFAULT 'en',
ADD COLUMN     "timezone" TEXT DEFAULT 'UTC';
