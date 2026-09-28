import { Module } from '@nestjs/common';
import { GenerateAudioService } from './application/generate-audio.service.js';
import { VoiceSamplesService } from './application/voice-samples.service.js';
import { AUDIO_REPOSITORY } from './domain/ports.js';
import { PrismaAudioRepository } from './infrastructure/persistence/prisma-audio.repository.js';
import { AudioGenerationProcessor } from './infrastructure/queue/audio-generation.processor.js';
import { TtsProviderFactory } from './infrastructure/tts/tts-provider.factory.js';

/** Lado worker: consume audio-generation y genera las muestras de las voces. */
@Module({
  providers: [
    GenerateAudioService,
    VoiceSamplesService,
    TtsProviderFactory,
    AudioGenerationProcessor,
    { provide: AUDIO_REPOSITORY, useClass: PrismaAudioRepository },
  ],
})
export class AudioGenerationModule {}
