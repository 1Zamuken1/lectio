-- AlterTable
ALTER TABLE "audio_segments" ADD COLUMN     "units_done" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "units_total" INTEGER NOT NULL DEFAULT 0;
