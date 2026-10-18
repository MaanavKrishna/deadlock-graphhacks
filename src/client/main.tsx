import React from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import App from './App';
import Landing from './site/Landing';
import Docs from './site/Docs';
import { useRoute } from './router';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles.css';
import './site/site.css';

function Root() {
  const route = useRoute();
  React.useEffect(() => {
    if (route === 'landing') document.title = 'Deadlock · Three can trade where two can’t';
    if (route === 'docs') document.title = 'Docs · Deadlock';
  }, [route]);
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={route}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {route === 'landing' ? <Landing /> : route === 'docs' ? <Docs /> : <App />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
