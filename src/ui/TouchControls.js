// On-screen controls for touch screens: an analog movement stick (Input.stick), drag-to-look and
// a few buttons that feed the same key set the keyboard does (Input.keys / Input.pressed), plus a
// photo-mode button. Shown on coarse-pointer devices or with ?touch.

const BUTTONS = [
	{ label: 'Jump', code: 'Space', hold: true },
	{ label: 'E', code: 'KeyE', hold: false },
	{ label: 'Run', code: 'ShiftLeft', hold: true, toggle: true },
	{ label: 'Dive', code: 'KeyC', hold: true },
];

export function touchWanted() {

	return new URLSearchParams( location.search ).has( 'touch' ) || !! ( window.matchMedia && window.matchMedia( '(pointer: coarse)' ).matches );

}

export class TouchControls {

	constructor( input ) {

		this.input = input;
		this.onPhoto = null; // (): the photo button was tapped (AppUI toggles photo mode)
		const root = this.root = document.createElement( 'div' );
		root.className = 'vi-touch';
		root.innerHTML = `
			<div class="vi-look"></div>
			<div class="vi-stick"><div class="vi-knob"></div></div>
			<div class="vi-btns"></div>
			<button type="button" class="vi-photo" aria-label="Photo mode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg></button>`;
		this.look = root.querySelector( '.vi-look' );
		this.stick = root.querySelector( '.vi-stick' );
		this.knob = root.querySelector( '.vi-knob' );
		const btns = root.querySelector( '.vi-btns' );
		for ( const b of BUTTONS ) {

			const el = document.createElement( 'button' );
			el.type = 'button';
			el.className = 'vi-btn';
			el.textContent = b.label;
			this._bindButton( el, b );
			btns.append( el );

		}

		const photo = root.querySelector( '.vi-photo' );
		photo.addEventListener( 'pointerdown', ( e ) => {

			e.preventDefault();
			e.stopPropagation();
			if ( this.onPhoto ) this.onPhoto();

		} );

		this._bindLook();
		this._bindStick();
		document.body.append( root );
		document.documentElement.classList.add( 'has-touch' );

	}

	// photo mode hides the stick and buttons (the photo button stays, faint, to leave it)
	setPhotoMode( on ) {

		this.root.classList.toggle( 'is-photo', on );

	}

	_press( code ) {

		const k = this.input.keys;
		if ( ! k.has( code ) ) this.input.pressed.add( code );
		k.add( code );

	}

	_release( code ) {

		this.input.keys.delete( code );

	}

	_bindButton( el, b ) {

		let on = false;
		const set = ( v ) => {

			on = v;
			el.classList.toggle( 'is-on', v );
			if ( v ) this._press( b.code ); else this._release( b.code );

		};

		el.addEventListener( 'pointerdown', ( e ) => {

			e.preventDefault();
			e.stopPropagation();
			if ( b.toggle ) set( ! on );
			else set( true );

		} );
		const up = () => {

			if ( ! b.toggle && on ) set( false );

		};
		el.addEventListener( 'pointerup', up );
		el.addEventListener( 'pointercancel', up );
		el.addEventListener( 'pointerleave', up );

	}

	_bindLook() {

		let id = null, lx = 0, ly = 0;
		const el = this.look;
		el.addEventListener( 'pointerdown', ( e ) => {

			if ( id !== null ) return;
			id = e.pointerId;
			lx = e.clientX;
			ly = e.clientY;
			el.setPointerCapture( id );

		} );
		el.addEventListener( 'pointermove', ( e ) => {

			if ( e.pointerId !== id ) return;
			this.input.look.x += ( e.clientX - lx ) * 1.3;
			this.input.look.y += ( e.clientY - ly ) * 1.3;
			lx = e.clientX;
			ly = e.clientY;

		} );
		const end = ( e ) => {

			if ( e.pointerId === id ) id = null;

		};
		el.addEventListener( 'pointerup', end );
		el.addEventListener( 'pointercancel', end );

	}

	_bindStick() {

		let id = null, cx = 0, cy = 0;
		const el = this.stick, R = 48, DEAD = 0.12;
		const apply = ( dx, dy ) => {

			// analog, with a small dead zone and the rest rescaled to 0..1
			let x = dx / R, y = - dy / R;
			const l = Math.hypot( x, y );
			const k = l < DEAD ? 0 : ( l - DEAD ) / ( 1 - DEAD ) / l;
			x *= k; y *= k;
			this.input.stick.x = x;
			this.input.stick.y = y;

		};

		const move = ( e ) => {

			let dx = e.clientX - cx, dy = e.clientY - cy;
			const d = Math.hypot( dx, dy );
			if ( d > R ) {

				dx *= R / d;
				dy *= R / d;

			}

			this.knob.style.transform = `translate(${ dx }px, ${ dy }px)`;
			apply( dx, dy );

		};

		el.addEventListener( 'pointerdown', ( e ) => {

			if ( id !== null ) return;
			e.preventDefault();
			id = e.pointerId;
			const r = el.getBoundingClientRect();
			cx = r.left + r.width / 2;
			cy = r.top + r.height / 2;
			el.setPointerCapture( id );
			move( e );

		} );
		el.addEventListener( 'pointermove', ( e ) => {

			if ( e.pointerId === id ) move( e );

		} );
		const end = ( e ) => {

			if ( e.pointerId !== id ) return;
			id = null;
			this.knob.style.transform = '';
			apply( 0, 0 );

		};
		el.addEventListener( 'pointerup', end );
		el.addEventListener( 'pointercancel', end );

	}

}
