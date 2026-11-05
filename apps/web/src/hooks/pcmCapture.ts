export async function startPcmCapture(input: MediaStream, onFrame: (audio: ArrayBuffer) => void) {
  const context = new AudioContext({ latencyHint: 'interactive' });
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    source?.disconnect();
    node?.disconnect();
    void context.close();
  };
  try {
    await context.resume();
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}pcm-recorder.worklet.js`);
    node = new AudioWorkletNode(context, 'pcm-recorder');
    source = context.createMediaStreamSource(input);
    // Worklet 只读取输入、输出静音，连接 destination 保持音频图运行，不回放麦克风。
    source.connect(node);
    node.connect(context.destination);
    let stopped: (() => void) | undefined;
    node.port.onmessage = ({ data }) => {
      if (data === 'stopped') stopped?.();
      else onFrame(data as ArrayBuffer);
    };
    return {
      async stop() {
        try {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error('音频采集收尾超时')), 2000);
            stopped = () => { clearTimeout(timer); resolve(); };
            node!.port.postMessage('stop');
          });
        } finally { cleanup(); }
      },
      cancel: cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
