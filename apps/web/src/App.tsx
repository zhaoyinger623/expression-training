import { AppRouter } from './router';
import { PracticeProvider } from './stores/practiceStore';

export default function App() {
  return <PracticeProvider><AppRouter /></PracticeProvider>;
}
