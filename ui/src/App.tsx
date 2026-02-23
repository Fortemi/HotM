import { HallOfMind } from './components/HallOfMind';
import { MobileReadView } from './components/mobile/MobileReadView';
import { MediaPlayerProvider, PersistentPlayerOverlay } from './components/player';
// import { TestSidebar } from './components/TestSidebar';
import './index.css';
import './sidebar-layout.css';

function App() {
  // Uncomment to test sidebar: return <TestSidebar />;
  const isMobilePath =
    typeof window !== 'undefined' &&
    window.location.pathname.replace(/\/+$/, '').endsWith('/mobile');

  if (isMobilePath) {
    return <MobileReadView />;
  }

  return (
    <MediaPlayerProvider>
      <HallOfMind />
      <PersistentPlayerOverlay />
    </MediaPlayerProvider>
  );
}

export default App;
