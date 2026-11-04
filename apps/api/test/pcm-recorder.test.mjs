import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../../web/public/pcm-recorder.worklet.js', import.meta.url), 'utf8');
function capture(sampleRate) {
  let Processor;
  const frames = [];
  runInNewContext(code, {
    sampleRate,
    AudioWorkletProcessor: class { port = { postMessage: data => frames.push(data) }; },
    registerProcessor: (_name, value) => { Processor = value; },
  });
  return { processor: new Processor(), frames };
}

test('48kHz 跨 128 样本块降采样为 16kHz，停止先送尾帧再确认', () => {
  const { processor, frames } = capture(48000);
  const input = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i * Math.PI / 24));
  for (let i = 0; i < input.length; i += 128) processor.process([[input.slice(i, i + 128)]]);
  processor.port.onmessage({ data: 'stop' });
  assert.equal(frames.pop(), 'stopped');
  const audio = Buffer.concat(frames.map(frame => Buffer.from(frame)));
  assert.equal(audio.length, 16000 * 2);
  for (let i = 0; i < 16000; i++) {
    const average = (input[i * 3] + input[i * 3 + 1] + input[i * 3 + 2]) / 3;
    assert.equal(audio.readInt16LE(i * 2), Math.round(average * (average < 0 ? 32768 : 32767)));
  }
  assert.equal(processor.process([[input]]), false);
});

test('44.1kHz 保持一秒时长、双声道混合、PCM16 小端与削峰', () => {
  const { processor, frames } = capture(44100);
  for (let i = 0; i < 44100; i += 128) {
    const length = Math.min(128, 44100 - i);
    processor.process([[new Float32Array(length).fill(1), new Float32Array(length).fill(0)]]);
  }
  processor.port.onmessage({ data: 'stop' });
  frames.pop();
  const audio = Buffer.concat(frames.map(frame => Buffer.from(frame)));
  assert.equal(audio.length, 32000);
  assert.equal(audio.readInt16LE(0), 16384);
  const other = capture(16000);
  other.processor.process([[Float32Array.from([-2, 2])]]);
  other.processor.port.onmessage({ data: 'stop' });
  assert.deepEqual([...Buffer.from(other.frames[0])], [0, 128, 255, 127]);
});
