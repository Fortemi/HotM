import { Fragment, useSyncExternalStore } from 'react';
import { getDataContextRevision, subscribeDataContextChanges } from './api/data-context';
import { HallOfMind } from './components/HallOfMind';
import { MobileReadView } from './components/mobile/MobileReadView';
import { MediaPlayerProvider, PersistentPlayerOverlay } from './components/player';
// import { TestSidebar } from './components/TestSidebar';
import './index.css';
import './sidebar-layout.css';

function App() {
  const contextRevision = useSyncExternalStore(
    subscribeDataContextChanges, getDataContextRevision, getDataContextRevision,
  );
  // Uncomment to test sidebar: return <TestSidebar />;
  const isMobilePath =
    typeof window !== 'undefined' &&
    window.location.pathname.replace(/\/+$/, '').endsWith('/mobile');

  return (
    <Fragment key={contextRevision}>
      {isMobilePath ? <MobileReadView /> : (
        <MediaPlayerProvider>
          <HallOfMind />
          <PersistentPlayerOverlay />
        </MediaPlayerProvider>
      )}
    </Fragment>
  );
}

export default App;
