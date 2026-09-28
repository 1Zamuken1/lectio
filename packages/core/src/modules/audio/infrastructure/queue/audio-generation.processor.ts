import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { APP_CONFIG } from '../../../../config/config.module.js';
import type { AppConfig } from '../../../../config/env.js';
import { QUEUES } from '../../../../infrastructure/queues/queues.module.js';
import {
  GenerateAudioService,
  type GenerationOutcome,
} from '../../application/generate-audio.service.js';
import { VoiceSamplesService } from '../../application/voice-samples.service.js';
import type { AudioGenerationJob } from './audio-generation.queue.js';

/**
 * Consume `audio-generation` (RNF-07). El límite global es doble: AUDIO_WORKER_CONCURRENCY
 * capítulos a la vez y TTS_REQUESTS_PER_CHAPTER solicitudes por capítulo, así el proveedor
 * nunca recibe más de su producto, sin importar cuántos usuarios pidan audio. El limiter
 * de BullMQ frena además los arranques de capítulos por minuto.
 */
@Processor(QUEUES.audioGeneration, { limiter: { max: 30, duration: 60_000 } })
export class AudioGenerationProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger('AudioGeneration');

  constructor(
    private readonly generator: GenerateAudioService,
    private readonly samples: VoiceSamplesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    // El decorador es estático; la concurrencia sale de la configuración.
    this.worker.concurrency = this.config.AUDIO_WORKER_CONCURRENCY;
    // Las muestras se generan en segundo plano: no retrasan el arranque del worker.
    void this.samples.ensureAll();
  }

  async process(job: Job<AudioGenerationJob>): Promise<GenerationOutcome> {
    const started = performance.now();
    const outcome = await this.generator.generate(job.data.audioSegmentId);
    if (outcome.status === 'ready') {
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      const minutes = (outcome.durationMs / 60_000).toFixed(1);
      this.logger.log(
        `Audio ${job.data.audioSegmentId}: ${minutes} min en ${seconds} s (${outcome.units} unidades)`,
      );
    }
    return outcome;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AudioGenerationJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(
      `Audio ${job.data.audioSegmentId}: intento ${job.attemptsMade} falló (${error.message})${final ? ', sin más reintentos' : ''}`,
    );
    if (final) await this.generator.giveUp(job.data.audioSegmentId, error);
  }
}
