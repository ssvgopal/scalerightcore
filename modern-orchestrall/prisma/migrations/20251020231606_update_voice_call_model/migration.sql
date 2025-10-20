/*
  Warnings:

  - You are about to drop the column `audioUrl` on the `voice_calls` table. All the data in the column will be lost.
  - You are about to drop the column `transcript` on the `voice_calls` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "voice_calls" DROP COLUMN "audioUrl",
DROP COLUMN "transcript",
ADD COLUMN     "audioDataSize" INTEGER,
ADD COLUMN     "command" TEXT,
ADD COLUMN     "response" TEXT,
ADD COLUMN     "transcription" TEXT;
