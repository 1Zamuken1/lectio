import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../src/config/env.js';
import { MediaUrlSigner } from '../../src/modules/audio/application/media-urls.js';
import { quotaPeriod, remainingQuota } from '../../src/modules/audio/domain/quota.js';
import { availableVoices, pickVoice, voiceVersion } from '../../src/modules/audio/domain/voices.js';
import { parseRange } from '../../src/modules/audio/infrastructure/http/range.js';

describe('parseRange', () => {
  it('los tramos que piden los reproductores', () => {
    expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  });

  it('fuera del archivo: 416; sin Range o ilegible: el archivo completo', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=500-100', 1000)).toBe('unsatisfiable');
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('bytes=0-1,5-9', 1000)).toBeNull();
    expect(parseRange('items=0-1', 1000)).toBeNull();
  });
});

describe('cuota', () => {
  it('el periodo es el mes calendario en UTC', () => {
    expect(quotaPeriod(new Date('2026-09-30T23:59:59Z'))).toEqual({
      periodStart: new Date('2026-09-01T00:00:00Z'),
      resetsAt: new Date('2026-10-01T00:00:00Z'),
    });
    expect(quotaPeriod(new Date('2026-12-15T10:00:00Z')).resetsAt).toEqual(
      new Date('2027-01-01T00:00:00Z'),
    );
  });

  it('lo restante descuenta lo reservado y nunca es negativo', () => {
    expect(remainingQuota({ quota: 1000, consumed: 300, reserved: 200 })).toBe(500);
    expect(remainingQuota({ quota: 1000, consumed: 900, reserved: 200 })).toBe(0);
  });
});

describe('voces', () => {
  it('los perfiles del idioma, el de por defecto primero', () => {
    const ids = availableVoices('es-CO').map((v) => v.id);
    expect(ids[0]).toBe('gonzalo');
    expect(ids).toEqual(expect.arrayContaining(['jorge', 'salome', 'salome-grave']));
  });

  it('sin perfiles, la voz de Edge por defecto del idioma', () => {
    expect(availableVoices('en')).toEqual([
      { id: 'en-US-AndrewNeural', name: 'Andrew', language: 'en', isDefault: true },
    ]);
  });

  it('pickVoice: la pedida, la de por defecto, o un error con las disponibles', () => {
    expect(pickVoice(undefined, 'es').id).toBe('gonzalo');
    expect(pickVoice('Salome', 'es').id).toBe('salome');
    expect(pickVoice('en-us-andrewneural', 'en').id).toBe('en-US-AndrewNeural');
    expect(() => pickVoice('jorge', 'en')).toThrow(
      expect.objectContaining({
        code: 'VOICE_NOT_AVAILABLE',
        details: { available: ['en-US-AndrewNeural'] },
      }),
    );
  });

  it('la versión cambia con la prosodia', () => {
    expect(voiceVersion(pickVoice('salome', 'es'))).not.toBe(
      voiceVersion(pickVoice('salome-grave', 'es')),
    );
    expect(voiceVersion(pickVoice('gonzalo', 'es'))).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe('MediaUrlSigner', () => {
  const signer = new MediaUrlSigner({
    JWT_SECRET: 'x'.repeat(40),
    MEDIA_URL_TTL_SECONDS: 3600,
  } as AppConfig);
  const query = (url: string) => Object.fromEntries(new URL(url, 'http://x').searchParams);
  const now = Date.parse('2026-09-28T12:03:00Z');

  it('firma y verifica; el vencimiento se redondea para que la URL sea estable', () => {
    const a = signer.sign('books/k.mp3', now);
    const b = signer.sign('books/k.mp3', now + 60_000);
    expect(a.url).toBe(b.url);
    expect(a.expiresAt.toISOString()).toBe('2026-09-28T13:10:00.000Z');
    expect(signer.verify(query(a.url), now)).toBe('books/k.mp3');
  });

  it('rechaza otra clave con la misma firma, una firma alterada y un enlace vencido', () => {
    const q = query(signer.sign('books/k.mp3', now).url);
    expect(() => signer.verify({ ...q, key: 'books/otro.mp3' }, now)).toThrow(
      expect.objectContaining({ code: 'MEDIA_URL_INVALID' }),
    );
    expect(() => signer.verify({ ...q, sig: `${q.sig!.slice(0, -1)}A` }, now)).toThrow(
      expect.objectContaining({ code: 'MEDIA_URL_INVALID' }),
    );
    expect(() => signer.verify(q, now + 3 * 3600_000)).toThrow(
      expect.objectContaining({ code: 'MEDIA_URL_EXPIRED' }),
    );
  });
});
