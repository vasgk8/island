// Keyboard / mouse input with pointer lock support.
export class Input {

	constructor( dom ) {

		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this.look = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;
		// analog movement from the touch stick: x right, y forward (length <= 1)
		this.stick = { x: 0, y: 0 };
		this.lookScale = 1; // look sensitivity (settings panel)
		this._move = { x: 0, y: 0 };

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ) ) return;
			if ( ! this.keys.has( e.code ) ) this.pressed.add( e.code );
			this.keys.add( e.code );
			if ( [ 'Space', 'ArrowUp', 'ArrowDown', 'Tab' ].includes( e.code ) ) e.preventDefault();

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.keys.clear() );

		dom.addEventListener( 'mousedown', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = true;
			if ( e.button === 2 ) this.rightDown = true;

		} );
		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = false;
			if ( e.button === 2 ) this.rightDown = false;

		} );
		dom.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );
		window.addEventListener( 'mousemove', ( e ) => {

			if ( this.locked || this.mouseDown || this.rightDown ) {

				this.look.x += e.movementX;
				this.look.y += e.movementY;

			}

		} );
		dom.addEventListener( 'wheel', ( e ) => {

			this.wheel += Math.sign( e.deltaY );
			e.preventDefault();

		}, { passive: false } );

		document.addEventListener( 'pointerlockchange', () => {

			this.locked = document.pointerLockElement === dom;

		} );

	}

	requestLock() {

		if ( ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	down( code ) {

		return this.enabled && this.keys.has( code );

	}

	// true once per physical key press
	hit( code ) {

		return this.enabled && this.pressed.has( code );

	}

	// movement intent: WASD plus the touch stick, x right / y forward, clamped to length 1
	move() {

		const m = this._move;
		m.x = 0; m.y = 0;
		if ( ! this.enabled ) return m;
		if ( this.keys.has( 'KeyW' ) ) m.y += 1;
		if ( this.keys.has( 'KeyS' ) ) m.y -= 1;
		if ( this.keys.has( 'KeyD' ) ) m.x += 1;
		if ( this.keys.has( 'KeyA' ) ) m.x -= 1;
		m.x += this.stick.x;
		m.y += this.stick.y;
		const l = Math.hypot( m.x, m.y );
		if ( l > 1 ) {

			m.x /= l; m.y /= l;

		}

		return m;

	}

	consumeLook() {

		const l = { x: this.look.x * this.lookScale, y: this.look.y * this.lookScale };
		this.look.x = 0;
		this.look.y = 0;
		return l;

	}

	consumeWheel() {

		const w = this.wheel;
		this.wheel = 0;
		return w;

	}

	endFrame() {

		this.pressed.clear();

	}

}
