import { useEffect, useRef, useState } from 'react';
import { recordingMode } from '../config/recording';
import { connectRealtimeTranscription, type RealtimeSession } from '../api/realtimeTranscription';
import { startPcmCapture } from './pcmCapture';

export function useRecorder() {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'recorded'>('idle');
  const [audio, setAudio] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connecting' | 'listening' | 'finalizing' | 'complete' | 'failed'>('idle');
  const [realtimeError, setRealtimeError] = useState('');
  const realtime = useRef<{ session: RealtimeSession; capture: Awaited<ReturnType<typeof startPcmCapture>> } | null>(null);
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
    realtime.current?.session.cancel();
    realtime.current?.capture.cancel();
    realtime.current = null;
    setTranscript('');
    setRealtimeStatus('idle');
    setRealtimeError('');
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
      if (recordingMode === 'realtime') {
        setRealtimeStatus('connecting');
        let session: RealtimeSession | undefined;
        let connectionFailed = false;
        try {
          session = connectRealtimeTranscription(setTranscript, (message) => {
            connectionFailed = true;
            setRealtimeStatus('failed');
            setRealtimeError(message);
          });
          const capture = await startPcmCapture(input, session.write);
          if (!mounted.current) { session.cancel(); capture.cancel(); input.getTracks().forEach(track => track.stop()); return; }
          if (connectionFailed) {
            session.cancel();
            capture.cancel();
          } else {
            const active = { session, capture };
            realtime.current = active;
            void session.ready.then(() => {
              if (realtime.current === active && recorder.current?.state === 'recording') setRealtimeStatus('listening');
            }).catch(() => {});
          }
        } catch (cause) {
          session?.cancel();
          if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
          setRealtimeStatus('failed');
          setRealtimeError(cause instanceof Error ? cause.message : '无法开始实时转写');
        }
      }
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
        realtime.current?.session.cancel();
        realtime.current?.capture.cancel();
        realtime.current = null;
        setRealtimeStatus('failed');
        setPhase('idle');
        setError('录音中断，请检查麦克风后重新录音。');
      };
      recording.onstop = async () => {
        clearInterval(interval.current);
        clearTimeout(limit.current);
        const active = realtime.current;
        const finishing = active?.capture.stop();
        input.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        if (failed) return;
        const blob = new Blob(chunks, { type: recording.mimeType });
        if (!blob.size || blob.size > 4 * 1024 * 1024) {
          active?.session.cancel();
          void finishing?.catch(() => {});
          realtime.current = null;
          setPhase('idle');
          setError(blob.size ? '录音超过 4 MiB，请重新录制较短的回答。' : '没有录到声音数据，请重新录音。');
          return;
        }
        setAudio(blob);
        setSeconds(Math.min((performance.now() - startedAt) / 1000, 180));
        setPhase('recorded');
        if (active) {
          setRealtimeStatus('finalizing');
          try {
            await finishing;
            const text = await active.session.finish();
            if (realtime.current !== active) return;
            setTranscript(text);
            setRealtimeStatus('complete');
          } catch (cause) {
            if (realtime.current !== active) return;
            active.session.cancel();
            setRealtimeStatus('failed');
            setRealtimeError(cause instanceof Error ? cause.message : '实时转写未完成');
          } finally {
            if (realtime.current === active) realtime.current = null;
          }
        }
      };
      recording.start();
      setPhase('recording');
      interval.current = window.setInterval(() => setSeconds(Math.min(Math.floor((performance.now() - startedAt) / 1000), 180)), 250);
      limit.current = window.setTimeout(stop, 180_000);
    } catch (cause) {
      realtime.current?.session.cancel();
      realtime.current?.capture.cancel();
      realtime.current = null;
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
      realtime.current?.session.cancel();
      realtime.current?.capture.cancel();
      realtime.current = null;
    };
  }, []);

  return { phase, audio, seconds, error, transcript, realtimeStatus, realtimeError, start, stop, reset };
}
