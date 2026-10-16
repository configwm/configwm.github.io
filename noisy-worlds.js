'use strict';

// Recorded five-second clips. Only the selected level receives video sources.
(() => {
  const section = document.getElementById('worlds');
  const grid = section.querySelector('.world-grid');
  const slider = document.getElementById('distraction');
  const toggle = document.getElementById('world-playback');
  const status = document.getElementById('world-video-status');
  const cards = [...section.querySelectorAll('.world-motion')];
  const videos = cards.map(card => card.querySelector('video'));
  const names = {tworoom: 'Two-Room', pusht: 'Push-T', cube: 'OGBench-Cube'};
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = motionPreference.matches || Boolean(navigator.connection?.saveData);
  let inView = false;
  let dragging = false;
  let loadedLevel = null;
  let resumeTime = 0;
  let generation = 0;
  let timer;
  let pending;

  function updateToggle() {
    toggle.dataset.paused = String(userPaused);
    toggle.setAttribute('aria-label', userPaused ? 'Play environment videos' : 'Pause environment videos');
    toggle.title = userPaused ? 'Play videos' : 'Pause videos';
  }

  function canLoad() {
    return inView && !document.hidden && !dragging;
  }

  function stop() {
    clearTimeout(timer);
    generation += 1;
    pending?.abort();
    pending = null;
    if (cards[0].dataset.ready === 'true') resumeTime = videos[0].currentTime;
    videos.forEach(video => video.pause());
  }

  function waitForMedia(video, event, ready, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
      if (ready()) return resolve();
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener(event, done);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', aborted);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Video unavailable')); };
      const aborted = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      const timeout = setTimeout(failed, 15000);
      video.addEventListener(event, done, {once: true});
      video.addEventListener('error', failed, {once: true});
      signal.addEventListener('abort', aborted, {once: true});
    });
  }

  async function playLevel() {
    if (!canLoad()) return;
    stop();
    const version = generation;
    const level = Number(slider.value);
    const controller = new AbortController();
    pending = controller;
    const current = () => version === generation && Number(slider.value) === level && canLoad();
    try {
      if (loadedLevel !== level) {
        loadedLevel = null;
        cards.forEach((card, index) => {
          card.dataset.ready = 'false';
          card.dataset.loading = 'true';
          card.setAttribute('aria-busy', 'true');
          const source = `assets/noisy-worlds/${card.dataset.environment}-${level}.mp4`;
          const video = videos[index];
          video.muted = true;
          if (video.getAttribute('src') !== source || video.error || video.networkState === 3) {
            video.src = source;
            video.load();
          }
        });
        await Promise.all(videos.map(video => waitForMedia(video, 'canplay', () => video.readyState >= 3, controller.signal)));
        if (!current()) return;
        const time = Math.min(resumeTime % 5, 4.9);
        await Promise.all(videos.map(async video => {
          if (Math.abs(video.currentTime - time) > .04) {
            video.currentTime = time;
            await waitForMedia(video, 'seeked', () => !video.seeking, controller.signal);
          }
        }));
        if (!current()) return;
        loadedLevel = level;
      }
      if (!userPaused) await Promise.all(videos.map(video => video.play()));
      if (!current()) {
        // A newer generation owns the players; it handles pausing them.
        if (version === generation) videos.forEach(video => video.pause());
        return;
      }
      cards.forEach(card => {
        card.dataset.ready = 'true';
        card.dataset.loading = 'false';
        card.setAttribute('aria-busy', 'false');
      });
      status.textContent = '';
    } catch (error) {
      if (version !== generation || error.name === 'AbortError') return;
      controller.abort();
      videos.forEach(video => video.pause());
      cards.forEach((card, index) => {
        // Keep a decoded video frame visible if only autoplay was blocked.
        card.dataset.ready = String(videos[index].readyState >= 2);
        card.dataset.loading = 'false';
        card.setAttribute('aria-busy', 'false');
      });
      loadedLevel = null;
      userPaused = true;
      updateToggle();
      status.textContent = 'Press Play to start or retry the videos.';
    } finally {
      if (pending === controller) pending = null;
    }
  }

  function schedule(delay = 140) {
    clearTimeout(timer);
    if (canLoad()) timer = setTimeout(playLevel, delay);
  }

  function updateLevel() {
    stop();
    const level = Number(slider.value);
    const description = `${level} distractor${level === 1 ? '' : 's'}`;
    slider.style.setProperty('--progress', `${level / 8 * 100}%`);
    slider.setAttribute('aria-valuetext', description);
    document.getElementById('distraction-value').textContent = String(level);
    cards.forEach(card => {
      card.dataset.ready = 'false';
      card.dataset.loading = 'true';
      card.setAttribute('aria-busy', 'true');
      card.querySelector('video').setAttribute('aria-label', `${names[card.dataset.environment]} with ${description}`);
    });
    schedule();
  }

  slider.addEventListener('pointerdown', () => { dragging = true; stop(); });
  slider.addEventListener('input', updateLevel);
  slider.addEventListener('change', () => { dragging = false; schedule(); });
  window.addEventListener('pointerup', () => { if (dragging) { dragging = false; schedule(); } });
  slider.addEventListener('pointercancel', () => { dragging = false; schedule(); });
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    updateToggle();
    stop();
    schedule(0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule(0);
  });
  motionPreference.addEventListener('change', event => {
    if (event.matches) { userPaused = true; stop(); updateToggle(); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) schedule(0); else stop();
    }, {threshold: .05}).observe(grid);
  } else {
    const checkViewport = () => {
      const rect = grid.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible !== inView) {
        inView = visible;
        if (inView) schedule(0); else stop();
      }
    };
    window.addEventListener('scroll', checkViewport, {passive: true});
    window.addEventListener('resize', checkViewport);
    checkViewport();
  }
  updateToggle();
  toggle.hidden = false;
})();
