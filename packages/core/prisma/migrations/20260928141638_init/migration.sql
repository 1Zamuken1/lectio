-- CreateEnum
CREATE TYPE "book_status" AS ENUM ('pending', 'processing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "nav_source" AS ENUM ('nav', 'ncx', 'spine');

-- CreateEnum
CREATE TYPE "chapter_kind" AS ENUM ('narrative', 'front_matter', 'back_matter', 'notes');

-- CreateEnum
CREATE TYPE "audio_status" AS ENUM ('pending', 'processing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "reading_mode" AS ENUM ('reading', 'listening');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "total_characters_processed" INTEGER NOT NULL DEFAULT 0,
    "tts_monthly_quota" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "slug" TEXT,
    "title" TEXT,
    "author" TEXT,
    "language" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "source_key" TEXT NOT NULL,
    "cover_key" TEXT,
    "source_hash" TEXT NOT NULL,
    "status" "book_status" NOT NULL DEFAULT 'pending',
    "error_code" TEXT,
    "error_message" TEXT,
    "nav_source" "nav_source",
    "pipeline_version" INTEGER,
    "processing_report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "ancestors" TEXT[],
    "kind" "chapter_kind" NOT NULL,
    "classification" JSONB NOT NULL,
    "content_html" TEXT NOT NULL,
    "sentences" JSONB NOT NULL,
    "notes" JSONB NOT NULL,
    "character_count" INTEGER NOT NULL,
    "sentence_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_segments" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "voice_id" TEXT NOT NULL,
    "requested_by" UUID,
    "status" "audio_status" NOT NULL DEFAULT 'pending',
    "provider" TEXT,
    "prosody_key" TEXT,
    "audio_key" TEXT,
    "alignment_key" TEXT,
    "duration_ms" INTEGER,
    "reserved_characters" INTEGER NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "sentence_index" INTEGER NOT NULL,
    "mode" "reading_mode" NOT NULL,
    "client_updated_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tts_usage_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "characters_processed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tts_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" UUID,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "books_slug_key" ON "books"("slug");

-- CreateIndex
CREATE INDEX "books_owner_id_idx" ON "books"("owner_id");

-- CreateIndex
CREATE INDEX "books_is_public_idx" ON "books"("is_public");

-- CreateIndex
CREATE INDEX "books_owner_id_source_hash_idx" ON "books"("owner_id", "source_hash");

-- CreateIndex
CREATE INDEX "books_pipeline_version_idx" ON "books"("pipeline_version");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_book_id_order_index_key" ON "chapters"("book_id", "order_index");

-- CreateIndex
CREATE INDEX "audio_segments_requested_by_status_idx" ON "audio_segments"("requested_by", "status");

-- CreateIndex
CREATE UNIQUE INDEX "audio_segments_chapter_id_voice_id_key" ON "audio_segments"("chapter_id", "voice_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_id_book_id_key" ON "reading_progress"("user_id", "book_id");

-- CreateIndex
CREATE INDEX "tts_usage_logs_user_id_created_at_idx" ON "tts_usage_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_segments" ADD CONSTRAINT "audio_segments_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_segments" ADD CONSTRAINT "audio_segments_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_usage_logs" ADD CONSTRAINT "tts_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_usage_logs" ADD CONSTRAINT "tts_usage_logs_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
