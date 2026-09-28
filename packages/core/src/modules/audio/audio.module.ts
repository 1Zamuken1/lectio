import { Module } from '@nestjs/common';
import { AudioService } from './application/audio.service.js';
import { MediaUrlSigner } from './application/media-urls.js';
import { AUDIO_GENERATION_QUEUE, AUDIO_REPOSITORY } from './domain/ports.js';
import { AudioController } from './infrastructure/http/audio.controller.js';
import { MediaController, VoicesController } from './infrastructure/http/media.controller.js';
import { UsageController } from './infrastructure/http/usage.controller.js';
import { PrismaAudioRepository } from './infrastructure/persistence/prisma-audio.repository.js';
import { BullAudioGenerationQueue } from './infrastructure/queue/audio-generation.queue.js';

/**
 * Audio, lado API: pedirlo (cuota y concurrencia), consultar su estado, servirlo con URL
 * firmadas, las voces y el consumo. La síntesis vive en AudioGenerationModule (worker).
 */
@Module({
  controllers: [AudioController, MediaController, VoicesController, UsageController],
  providers: [
    AudioService,
    MediaUrlSigner,
    { provide: AUDIO_REPOSITORY, useClass: PrismaAudioRepository },
    { provide: AUDIO_GENERATION_QUEUE, useClass: BullAudioGenerationQueue },
  ],
})
export class AudioModule {}
