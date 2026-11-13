// The reader's theme choice (Auto, Light, Dark), shared by the footer switch and the root layout.

export const THEME_KEY = 'pc-theme';

/** Runs in <head> before the first paint so the page never flashes the wrong theme. Keep it tiny: it blocks rendering. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
