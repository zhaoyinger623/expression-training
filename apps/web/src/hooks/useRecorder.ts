import { useEffect, useRef, useState } from 'react';

export function useRecorder() {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'recorded'>('idle');
  const [audio, setAudio] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const interval = useRef<number | undefined>(undefined);
  const limit = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  function stop() {
    clearInterval(interval.current);
    clearTimeout(limit.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  function reset() {
    setAudio(null);
    setSeconds(0);
    setError('');
    setPhase('idle');
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('当前浏览器无法录音，请使用支持录音的浏览器，并通过 localhost 或 HTTPS 打开。');
      return;
    }
    reset();
    setPhase('requesting');
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      if (!mounted.current) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('UNSUPPORTED_RECORDING');
      const recording = new MediaRecorder(input, { mimeType, audioBitsPerSecond: 32_000 });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let failed = false;
      const startedAt = performance.now();
      recording.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recording.onerror = () => {
        failed = true;
        stop();
        input.getTracks().forEach((track) => track.stop());
        setPhase('idle');
        setError('录音中断，请检查麦克风后重新录音。');
      };
      recording.onstop = () => {
        clearInterval(interval.current);
        clearTimeout(limit.current);
        input.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        if (failed) return;
        const blob = new Blob(chunks, { type: recording.mimeType });
        if (!blob.size || blob.size > 4 * 1024 * 1024) {
          setPhase('idle');
          setError(blob.size ? '录音超过 4 MiB，请重新录制较短的回答。' : '没有录到声音数据，请重新录音。');
          return;
        }
        setAudio(blob);
        setSeconds(Math.min((performance.now() - startedAt) / 1000, 180));
        setPhase('recorded');
      };
      recording.start();
      setPhase('recording');
      interval.current = window.setInterval(() => setSeconds(Math.min(Math.floor((performance.now() - startedAt) / 1000), 180)), 250);
      limit.current = window.setTimeout(stop, 180_000);
    } catch (cause) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setPhase('idle');
      const name = cause instanceof Error ? cause.name : '';
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? '麦克风权限未开启，请在浏览器中允许后重试。'
        : name === 'NotFoundError'
          ? '未找到麦克风，请连接设备后重试。'
          : cause instanceof Error && cause.message === 'UNSUPPORTED_RECORDING'
            ? '浏览器没有可用的录音格式，请换用新版 Chrome、Edge 或 Safari。'
            : '麦克风暂时无法使用，请检查设备是否被其他程序占用。');
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(interval.current);
      clearTimeout(limit.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        recorder.current.ondataavailable = null;
        if (recorder.current.state === 'recording') recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { phase, audio, seconds, error, start, stop, reset };
}
