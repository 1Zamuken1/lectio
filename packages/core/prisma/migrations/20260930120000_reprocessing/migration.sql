-- DropForeignKey
ALTER TABLE "tts_usage_logs" DROP CONSTRAINT "tts_usage_logs_chapter_id_fkey";

-- AlterTable
ALTER TABLE "audio_segments" ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "narration_hash" TEXT;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "narration_hash" TEXT;

-- AlterTable
ALTER TABLE "tts_usage_logs" ALTER COLUMN "chapter_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tts_usage_logs" ADD CONSTRAINT "tts_usage_logs_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
