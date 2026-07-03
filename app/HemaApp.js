'use client';

import { useEffect } from 'react';

// Scripts must load in dependency order. Three.js + GLTFLoader come from a
// CDN, followed by the app's own modules. app.js self-initialises once the
// DOM is ready (see the bottom of public/js/app.js).
const SCRIPTS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  '/js/models_gltf.js',
  '/js/data.js',
  '/js/progress.js',
  '/js/viewer3d.js',
  '/js/navigation.js',
  '/js/app.js',
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Skip if already present (avoids duplicates on re-mount)
    if (document.querySelector(`script[data-hema="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // preserve execution order
    s.dataset.hema = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

export default function HemaApp() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const src of SCRIPTS) {
          if (cancelled) return;
          await loadScript(src);
        }
      } catch (e) {
        console.error('HEMA-Vision script load error:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="app">
      {/* HOME */}
      <div className="page active" id="page-home" />
      {/* ABOUT */}
      <div className="page" id="page-about" />
      {/* MODULES */}
      <div className="page" id="page-modules" />
      {/* BLOOD COMPONENTS */}
      <div className="page" id="page-components" />
      {/* PATTERN LIBRARY */}
      <div className="page" id="page-patterns" />
      {/* MYTH VS FACT */}
      <div className="page" id="page-mythfact" />
      {/* CRIME SCENE */}
      <div className="page" id="page-crimescene" />
      {/* QUIZ */}
      <div className="page" id="page-quiz" />
      {/* PROGRESS / STATS */}
      <div className="page" id="page-progress" />
      {/* Shared AR card viewer */}
      <div
        className="viewer-container"
        id="ar-card-viewer"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 150,
          display: 'none',
          borderRadius: 0,
        }}
      />
    </div>
  );
}
