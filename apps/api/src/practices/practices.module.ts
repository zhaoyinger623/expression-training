import { Module } from '@nestjs/common';
import { PracticeStore } from './practice.store.js';
import { PracticesController } from './practices.controller.js';

@Module({ providers: [PracticeStore], controllers: [PracticesController], exports: [PracticeStore] })
export class PracticesModule {}
