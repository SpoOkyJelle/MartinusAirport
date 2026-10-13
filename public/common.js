// Gedeelde code voor alle schermen: verbinding met de server en gelijke klok.
const Airport = (() => {
  let offset = 0;
  let state = { connected: true, lostAt: null, restoredAt: 0, fadeMs: 20000, screens: {}, urls: [] };

  const clamp = (v) => Math.max(0, Math.min(1, v));

  function connect(role, onChange) {
    const es = new EventSource('/events?role=' + role);
    es.onmessage = (e) => {
      state = JSON.parse(e.data);
      offset = state.now - Date.now();
      document.body.classList.remove('offline');
      if (onChange) onChange(state);
    };
    es.onerror = () => document.body.classList.add('offline');
  }

  // Tijd volgens de server, zodat alle schermen exact gelijk lopen.
  const now = () => Date.now() + offset;

  // Signaalsterkte van 1 (verbonden) naar 0 (verbroken).
  function strength(t = now()) {
    if (state.connected) return clamp((t - state.restoredAt) / 2500);
    return clamp(1 - (t - state.lostAt) / state.fadeMs);
  }

  // Klik = volledig scherm (voor de twee beeldschermen).
  function fullscreenOnClick() {
    document.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  }

  return { connect, now, strength, fullscreenOnClick, get state() { return state; } };
})();
