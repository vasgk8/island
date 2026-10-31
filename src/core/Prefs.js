// Settings remembered between visits (this browser only): time of day and clock speed, look speed,
// walk / fly and the render scale. Storage can be missing or blocked (private windows, previews):
// every access is guarded and the game runs on its defaults without it.
const KEY = 'vasgk.prefs';

export function loadPrefs() {

	try {

		const p = JSON.parse( localStorage.getItem( KEY ) || '{}' );
		return p && typeof p === 'object' ? p : {};

	} catch {

		return {};

	}

}

export function savePrefs( p ) {

	try {

		localStorage.setItem( KEY, JSON.stringify( p ) );

	} catch { /* storage unavailable */ }

}

// a finite number in [lo, hi], else undefined
export function prefNumber( v, lo, hi ) {

	return typeof v === 'number' && Number.isFinite( v ) && v >= lo && v <= hi ? v : undefined;

}

// phones and tablets: a touch-first screen (coarse pointer) or a small one
export function isPhoneLike() {

	try {

		return !! ( window.matchMedia && window.matchMedia( '(pointer: coarse)' ).matches ) || Math.min( window.innerWidth, window.innerHeight ) < 600;

	} catch {

		return false;

	}

}
