import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_CONFIG } from '../../../../config/config.module.js';
import type { AppConfig } from '../../../../config/env.js';
import { QUEUES } from '../../../../infrastructure/queues/queues.module.js';
import type { AudioGenerationQueue } from '../../domain/ports.js';

export interface AudioGenerationJob {
  audioSegmentId: string;
}

/**
 * Encola la generación de un capítulo. Sin jobId fijo: un segmento en error se vuelve a
 * pedir sobre la misma fila, y BullMQ ignoraría un id que ya usó un job fallido. Que no se
 * genere dos veces lo garantiza la base (solo un worker pasa el segmento a processing).
 */
@Injectable()
export class BullAudioGenerationQueue implements AudioGenerationQueue {
  constructor(
    @InjectQueue(QUEUES.audioGeneration) private readonly queue: Queue<AudioGenerationJob>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async enqueue(audioSegmentId: string): Promise<void> {
    await this.queue.add(
      'generate',
      { audioSegmentId },
      {
        attempts: this.config.AUDIO_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );
  }
}
