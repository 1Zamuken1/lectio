import { Global, Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.js';
import { LocalFileStorage } from './local-file-storage.js';

/** Storage de archivos. Al desplegar se enlaza aquí el adaptador de R2/S3. */
@Global()
@Module({
  providers: [{ provide: FILE_STORAGE, useClass: LocalFileStorage }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
