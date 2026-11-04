/* 将设备采样率转换为 16 kHz PCM16，每 100 ms 发送一帧；stop 时先发送尾帧再确认。 */
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new ArrayBuffer(3200);
    this.view = new DataView(this.frame);
    this.offset = 0;
    this.sum = 0;
    this.weight = 0;
    this.ratio = sampleRate / 16000;
    this.total = 0;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'stop') {
        this.stopped = true;
        if (this.weight && this.total < 180 * 16000) this.append(this.sum / this.weight);
        this.flush();
        this.port.postMessage('stopped');
      }
    };
  }
  flush() {
    if (!this.offset) return;
    const frame = this.frame.slice(0, this.offset);
    this.port.postMessage(frame, [frame]);
    this.offset = 0;
  }
  append(value) {
    if (this.total >= 180 * 16000) return;
    const clamped = Math.max(-1, Math.min(1, value));
    this.view.setInt16(this.offset, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true);
    this.offset += 2;
    this.total++;
    if (this.offset === this.frame.byteLength) this.flush();
  }
  process(inputs) {
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] / channels.length;
      let remaining = 1;
      while (remaining > 1e-8) {
        const portion = Math.min(remaining, this.ratio - this.weight);
        this.sum += value * portion;
        this.weight += portion;
        remaining -= portion;
        if (this.weight >= this.ratio - 1e-8) {
          this.append(this.sum / this.weight);
          this.sum = 0;
          this.weight = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-recorder', PcmRecorder);
