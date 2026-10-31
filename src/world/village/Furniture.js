import { Color, Vector3 } from '../../engine/index.js';
import { lin, C, WOOD, HARD, lantern } from '../Props.js';
import { quad01Part } from './GeoBuilder.js';

// Furniture for the interiors (hidden home, the house, the beach huts), built into the village
// builder in a room's local frame (y = 0 on the floor). Every piece stands at (x, z) turned by ry and
// faces +z: its back (headboard, shelf back, counter back, desk back) is at -z, against a wall.
// Pieces register colliders, indoor lights (LocalLights: indoor, lit by day too) and interactions:
// sit on a stool or chair, sleep in a bed (see App: interactions).
//
//   const kit = furnitureKit( { B, rand, colliders, lights, interact }, roomYaw );
//   kit.place( x, z, ry, () => kit.bed() );

const SEAT_Y = 0.46;

export function furnitureKit( { B, rand, colliders, lights, interact = null, fire = null }, yaw ) {

	let ry = 0;
	const rot = [];
	const wd = ( w = 0.4, paint = 0, pattern = 0 ) => WOOD( rand.next(), w, paint, pattern );
	const hd = ( rust = 0, metal = 0, rough = 0.5 ) => HARD( rand.next(), rust, metal, rough );
	const cloth = () => [ rand.next(), 0 ]; // fabric without sway
	const dark = lin( 0x5a4030 ), mid = lin( 0x8a6844 ), pale = lin( 0xc9a77c );
	const w3 = ( x, y, z ) => B.toWorld( x, y, z );

	const kit = {

		dark, mid, pale, wd, hd, cloth,

		// build fn() at (x, z) turned by r (nested frames add up)
		place( x, z, r, fn ) {

			B.pushAt( x, 0, z, r );
			rot.push( ry );
			ry += r;
			fn();
			ry = rot.pop();
			B.pop();

		},

		// a collider box given in the current local frame
		solid( lx, ly, lz, sx, sy, sz, opts = {} ) {

			colliders.addBox( w3( lx, ly, lz ), new Vector3( sx / 2, sy / 2, sz / 2 ), yaw + ry, { tag: 'furniture', ...opts } );

		},

		// an indoor lamp: lit day and night, short reach
		light( lx, ly, lz, color, intensity, range = 7 ) {

			const position = w3( lx, ly, lz );
			lights.push( { position, color, intensity, kind: 'lantern', indoor: true, range } );
			return position;

		},

		// a seat you can sit on, looking along local +z (the frame's facing) unless faceTo is given
		seat( lx, lz, faceTo = null ) {

			if ( ! interact ) return;
			const p = w3( lx, 0, lz );
			const f = faceTo ? w3( faceTo[ 0 ], 0, faceTo[ 1 ] ) : w3( lx, 0, lz + 1 );
			const viewYaw = Math.atan2( - ( f.x - p.x ), - ( f.z - p.z ) );
			const stand = w3( lx, 0, lz + 0.6 );
			interact( { pos: new Vector3( p.x, p.y + 0.5, p.z ), radius: 1.2, text: 'Sit down', sound: 'sit', act: ( app ) => app.player.sit( { x: p.x, y: p.y + 0.06, z: p.z, yaw: viewYaw, stand } ) } );

		},

		// ---------------------------------------------------------------- pieces

		bed( { w = 1.4, l = 2.0, blanket = lin( 0x3f7f86 ), throwTint = lin( 0xc9583e ) } = {} ) {

			const z0 = - l / 2, z1 = l / 2;
			B.box( 'wood', 0, 0.24, 0, w, 0.3, l, { grain: 0, tint: mid, data: wd() } );
			B.box( 'wood', 0, 0.62, z0 + 0.04, w + 0.04, 1.05, 0.08, { grain: 0, tint: dark, data: wd( 0.4, 0, 3 ) } );
			B.box( 'wood', 0, 0.4, z1 - 0.04, w + 0.04, 0.5, 0.08, { grain: 0, tint: dark, data: wd() } );
			B.box( 'cloth', 0, 0.47, 0, w - 0.08, 0.16, l - 0.1, { tint: lin( 0xf1ebdf ), data: cloth() } );
			B.box( 'cloth', 0, 0.565, 0.3, w, 0.05, l * 0.68, { tint: blanket, data: cloth() } );
			B.box( 'cloth', 0, 0.57, 0.55, w + 0.02, 0.06, 0.3, { tint: throwTint, data: cloth() } );
			B.box( 'cloth', 0, 0.62, z0 + 0.32, w * 0.64, 0.13, 0.36, { tint: lin( 0xfbf7ee ), data: cloth() } );
			kit.solid( 0, 0.35, 0, w + 0.05, 0.7, l + 0.05 );
			if ( interact ) {

				const p = w3( 0, 0.5, 0 );
				interact( { pos: p, radius: 1.7, text: 'Sleep until morning', act: ( app ) => app.sleep() } );

			}

		},

		sideTable( { lamp = true } = {} ) {

			B.box( 'wood', 0, 0.3, 0, 0.5, 0.6, 0.45, { grain: 0, tint: mid, data: wd( 0.3 ) } );
			kit.solid( 0, 0.3, 0, 0.5, 0.6, 0.45 );
			if ( lamp ) {

				const c = lantern( B, 0, 0.95, 0, rand.next(), 0.55 );
				kit.light( c[ 0 ], c[ 1 ], c[ 2 ], new Color( 1.0, 0.7, 0.4 ), 0.9 );

			}

		},

		chest() {

			B.box( 'wood', 0, 0.25, 0, 0.7, 0.5, 0.5, { grain: 0, tint: lin( 0x7a5434 ), data: wd( 0.5, 0, 5 ) } );
			for ( const dx of [ - 0.22, 0.22 ] ) B.box( 'hard', dx, 0.25, 0, 0.05, 0.52, 0.52, { tint: C.iron, data: hd( 0.5, 0.6, 0.5 ) } );
			kit.solid( 0, 0.25, 0, 0.7, 0.5, 0.5 );

		},

		// a framed picture hanging with its back on the wall (a little island map by default)
		painting( { w = 1.0, h = 0.7, y = 1.5, canvas = lin( 0x7fb8b0 ) } = {} ) {

			B.box( 'wood', 0, y, 0.025, w, h, 0.05, { grain: 0, tint: dark, data: wd( 0.3 ) } );
			B.box( 'cloth', 0, y, 0.055, w - 0.12, h - 0.12, 0.02, { tint: canvas, data: cloth() } );
			B.box( 'cloth', 0.05, y - 0.02, 0.07, 0.22, 0.3, 0.01, { tint: lin( 0xd8c48e ), data: cloth() } );
			B.box( 'cloth', 0.05, y, 0.075, 0.12, 0.18, 0.01, { tint: lin( 0x5f8a4a ), data: cloth() } );

		},

		bookshelf( { len = 1.25, top = 2.0, rows = 4 } = {} ) {

			const sh = { grain: 0, tint: mid, data: wd( 0.35 ) };
			const dz = 0.36, step = ( top - 0.1 ) / rows;
			for ( const sx of [ - len / 2, len / 2 ] ) B.box( 'wood', sx, top / 2, 0, 0.04, top, dz, sh );
			B.box( 'wood', 0, top / 2, - dz / 2 + 0.01, len, top, 0.02, sh );
			const books = [ 0x8a3b2e, 0x2f5f7a, 0xd8b45a, 0x3f6e48, 0x6a4a7a, 0xc96f3a, 0xe9e1cf, 0x1f3f5a, 0x9a8a5a ];
			for ( let i = 0; i <= rows; i ++ ) {

				const y = 0.05 + i * step;
				B.box( 'wood', 0, y, 0, len, 0.03, dz, sh );
				if ( i === rows ) break;
				let x = - len / 2 + 0.04;
				while ( x < len / 2 - 0.12 ) {

					const t = 0.03 + rand.next() * 0.045, h = Math.min( step - 0.06, 0.2 + rand.next() * 0.14 );
					if ( rand.next() < 0.12 ) {

						x += 0.08;
						continue;

					}

					B.box( 'wood', x + t / 2, y + 0.015 + h / 2, 0.02, t - 0.004, h, 0.24, { grain: 1, rz: rand.next() < 0.1 ? 0.15 : 0, tint: lin( books[ Math.floor( rand.next() * books.length ) ] ), data: wd( 0.1, 0.9 ) } );
					x += t;

				}

			}

			kit.solid( 0, top / 2, 0, len, top, dz + 0.04 );

		},

		// kitchen counter along the wall, a shelf of plates and jars above and pans on the wall
		counter( { len = 2.2 } = {} ) {

			B.box( 'wood', 0, 0.42, 0, len, 0.84, 0.58, { grain: 0, tint: lin( 0xd9cba8 ), data: wd( 0.35, 0.85, 3 ) } );
			B.box( 'wood', 0, 0.87, 0.02, len + 0.04, 0.06, 0.64, { grain: 0, tint: dark, data: wd( 0.3 ) } );
			B.box( 'wood', - len * 0.25, 0.915, 0.06, 0.5, 0.03, 0.36, { grain: 0, tint: pale, data: wd( 0.2 ) } );
			B.cyl( 'hard', len * 0.18, 0.9, 0.02, 0.16, 0.14, 0.18, { segs: 12, tint: lin( 0x3a3a3c ), data: hd( 0.1, 0.8, 0.45 ) } );
			B.cyl( 'hard', len * 0.38, 0.9, - 0.1, 0.06, 0.06, 0.16, { segs: 10, tint: lin( 0xb06a3a ), data: hd( 0, 0, 0.5 ) } );
			B.cyl( 'hard', len * 0.44, 0.9, - 0.1, 0.05, 0.05, 0.22, { segs: 10, tint: lin( 0x6e8a4a ), data: hd( 0, 0, 0.5 ) } );
			B.box( 'wood', 0, 1.55, - 0.16, len, 0.04, 0.26, { grain: 0, tint: mid, data: wd( 0.3 ) } );
			const n = Math.max( 2, Math.floor( len / 0.5 ) );
			for ( let i = 0; i < n; i ++ ) B.cyl( 'hard', - len / 2 + 0.25 + i * 0.3, 1.57, - 0.2, 0.1, 0.1, 0.02, { rx: - 1.35, segs: 14, tint: lin( 0xf0ece2 ), data: hd( 0, 0, 0.3 ) } );
			for ( let i = 0; i < 3; i ++ ) B.cyl( 'hard', len / 2 - 0.2 - i * 0.16, 1.57, - 0.18, 0.05, 0.05, 0.14, { segs: 10, tint: lin( [ 0xc8a24a, 0x9a5a3a, 0x5a7a8a ][ i ] ), data: hd( 0, 0, 0.4 ) } );
			for ( let i = 0; i < 2; i ++ ) B.cyl( 'hard', - 0.2 + i * 0.4, 1.2 - i * 0.08, - 0.27, 0.13 - i * 0.03, 0.13 - i * 0.03, 0.03, { rx: Math.PI / 2, segs: 14, tint: lin( 0x2e2e30 ), data: hd( 0.2, 0.8, 0.5 ) } );
			kit.solid( 0, 0.45, 0, len, 0.9, 0.6 );

		},

		// layered rug lying flat (w across x, d along z)
		rug( { w = 2.6, d = 1.8, colors = [ 0xa8463a, 0xd8b45a, 0x7a2e2a ] } = {} ) {

			colors.forEach( ( c, i ) => B.box( 'cloth', 0, 0.075 + i * 0.005, 0, w - i * 0.4, 0.02, d - i * 0.4, { tint: lin( c ), data: cloth() } ) );

		},

		// table with stools (one at each end, or count = 4 adds two along the sides); a mug, a plate, a book
		table( { w = 1.15, d = 0.78, stools = 2 } = {} ) {

			B.box( 'wood', 0, 0.76, 0, w, 0.06, d, { grain: 0, tint: mid, data: wd( 0.35, 0, 6 ) } );
			for ( const [ dx, dz ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ] ] ) B.box( 'wood', dx * ( w / 2 - 0.08 ), 0.37, dz * ( d / 2 - 0.07 ), 0.07, 0.74, 0.07, { grain: 1, tint: dark, data: wd( 0.35 ) } );
			const spots = [ [ - w / 2 - 0.28, 0 ], [ w / 2 + 0.28, 0 ] ];
			if ( stools >= 4 ) spots.push( [ 0, - d / 2 - 0.3 ], [ 0, d / 2 + 0.3 ] );
			for ( const [ sx, sz ] of spots.slice( 0, stools ) ) {

				B.cyl( 'wood', sx, SEAT_Y - 0.02, sz, 0.2, 0.2, 0.05, { segs: 12, tint: mid, data: wd( 0.4 ) } );
				for ( let k = 0; k < 3; k ++ ) {

					const a = k / 3 * Math.PI * 2;
					B.beam( 'wood', [ sx + Math.cos( a ) * 0.15, 0.06, sz + Math.sin( a ) * 0.15 ], [ sx + Math.cos( a ) * 0.1, SEAT_Y - 0.02, sz + Math.sin( a ) * 0.1 ], 0.04, 0.04, { tint: dark, data: wd( 0.4 ) } );

				}

				kit.seat( sx, sz, [ 0, 0 ] );

			}

			B.cyl( 'hard', - 0.25, 0.79, 0.1, 0.045, 0.04, 0.1, { segs: 10, tint: lin( 0xe2d6bc ), data: hd( 0, 0, 0.35 ) } );
			B.box( 'wood', 0.2, 0.81, - 0.12, 0.3, 0.04, 0.22, { grain: 0, ry: 0.3, tint: lin( 0x2f5f7a ), data: wd( 0.1, 0.9 ) } );
			B.cyl( 'hard', 0.05, 0.79, 0.18, 0.13, 0.11, 0.025, { segs: 14, tint: lin( 0xf0ece2 ), data: hd( 0, 0, 0.3 ) } );
			kit.solid( 0, 0.4, 0, w + 0.05, 0.8, d + 0.04 );

		},

		// writing desk against the wall with a chair in front (+z) and a potted plant
		desk() {

			B.box( 'wood', 0, 0.74, 0, 0.95, 0.05, 0.5, { grain: 0, tint: mid, data: wd( 0.3 ) } );
			for ( const [ ox, oz ] of [ [ - 0.42, - 0.2 ], [ 0.42, - 0.2 ], [ - 0.42, 0.2 ], [ 0.42, 0.2 ] ] ) B.box( 'wood', ox, 0.36, oz, 0.05, 0.72, 0.05, { grain: 1, tint: dark, data: wd( 0.3 ) } );
			B.box( 'wood', 0.2, 0.775, 0.02, 0.28, 0.02, 0.2, { grain: 0, ry: 0.2, tint: lin( 0xefe6d0 ), data: wd( 0.1, 1 ) } );
			kit.plant( - 0.32, 0.77, - 0.05, 0.75 );
			// chair (back toward the room)
			B.box( 'wood', 0, SEAT_Y, 0.6, 0.42, 0.04, 0.4, { grain: 0, tint: dark, data: wd( 0.4 ) } );
			for ( const [ ox, oz ] of [ [ - 0.18, - 0.17 ], [ 0.18, - 0.17 ], [ - 0.18, 0.17 ], [ 0.18, 0.17 ] ] ) B.box( 'wood', ox, SEAT_Y / 2, 0.6 + oz, 0.04, SEAT_Y, 0.04, { grain: 1, tint: dark, data: wd( 0.4 ) } );
			B.box( 'wood', 0, 0.75, 0.79, 0.42, 0.55, 0.04, { grain: 0, tint: dark, data: wd( 0.4, 0, 3 ) } );
			kit.solid( 0, 0.4, 0, 1.0, 0.8, 0.55 );
			kit.seat( 0, 0.6, [ 0, - 1 ] );

		},

		// a flower pot with a few leaves (s scales it)
		plant( x, y, z, s = 1 ) {

			B.cyl( 'hard', x, y, z, 0.1 * s, 0.075 * s, 0.15 * s, { segs: 10, tint: lin( 0xb8603a ), data: hd( 0, 0, 0.6 ) } );
			for ( let k = 0; k < 5; k ++ ) {

				const a = k / 5 * Math.PI * 2 + x * 3;
				const c = new Vector3( x, y + 0.12 * s, z );
				B.slab( 'cloth', [ c, new Vector3( x + Math.cos( a ) * 0.2 * s, y + 0.3 * s, z + Math.sin( a ) * 0.2 * s ), new Vector3( x + Math.cos( a + 0.35 ) * 0.15 * s, y + 0.38 * s, z + Math.sin( a + 0.35 ) * 0.15 * s ) ], 0, { tint: lin( 0x4f8a3a ), data: cloth() } );

			}

		},

		// lantern on a short chain from the ceiling (ceilY) over (x, z)
		hangingLantern( x, z, ceilY, intensity = 3.2 ) {

			B.rod( 'hard', [ x, ceilY, z ], [ x, ceilY - 0.45, z ], 0.008, 0.008, { segs: 4, tint: C.iron, data: hd( 0.5, 0.6, 0.5 ) } );
			const c = lantern( B, x, ceilY - 0.45, z, rand.next(), 1.1 );
			return kit.light( c[ 0 ], c[ 1 ], c[ 2 ], new Color( 1.0, 0.72, 0.42 ), intensity );

		},

		// fireplace with its back on the wall: stone surround, mantel, chimney breast up to ceilY, logs,
		// embers and a fire light. Returns the fire's world position.
		fireplace( { w = 1.5, ceilY = 2.5, stone = lin( 0xa69e90 ), breast = lin( 0xeadcc4 ) } = {} ) {

			const st = () => ( { grain: 0, tint: stone, data: [ rand.next(), 0, 0, 0 ] } );
			B.box( 'stone', - w / 2 + 0.15, 0.55, 0.28, 0.3, 1.1, 0.56, st() );
			B.box( 'stone', w / 2 - 0.15, 0.55, 0.28, 0.3, 1.1, 0.56, st() );
			B.box( 'stone', 0, 1.0, 0.28, w, 0.22, 0.56, st() );
			B.box( 'hard', 0, 0.45, 0.04, w - 0.6, 0.9, 0.04, { tint: lin( 0x1a1612 ), data: hd( 0, 0, 0.9 ) } );
			B.box( 'stone', 0, 0.02, 0.55, w + 0.4, 0.06, 1.0, { grain: 0, tint: lin( 0x8f877a ), data: [ rand.next(), 0, 0, 0 ] } );
			B.box( 'wood', 0, 1.17, 0.3, w + 0.25, 0.08, 0.36, { grain: 0, tint: dark, data: wd( 0.4 ) } );
			B.box( 'stone', 0, ( 1.21 + ceilY ) / 2, 0.22, w - 0.5, ceilY - 1.21, 0.44, { grain: 0, tint: breast, data: [ rand.next(), 1, 0, 0 ] } );
			for ( const [ dx, r ] of [ [ - 0.18, 0.2 ], [ 0.16, - 0.25 ], [ 0, 0.05 ] ] ) B.cyl( 'wood', dx, 0.14, 0.3, 0.06, 0.06, 0.55, { rz: Math.PI / 2, ry: r, segs: 7, tint: dark, data: wd( 0.9 ) } );
			B.part( 'glass', quad01Part( 0.5, 0.14 ), 0, 0.12, 0.42, { rx: - 1.2, tint: lin( 0xff8a3a ), data: [ rand.next(), 1, 1, 0 ] } );
			// on the mantel: a clock, a jar, a candle
			B.box( 'wood', - 0.45, 1.33, 0.3, 0.2, 0.26, 0.12, { grain: 1, tint: mid, data: wd( 0.3 ) } );
			B.cyl( 'hard', - 0.45, 1.36, 0.37, 0.07, 0.07, 0.01, { rx: Math.PI / 2, segs: 12, tint: lin( 0xefe6d0 ), data: hd( 0, 0, 0.4 ) } );
			B.cyl( 'hard', 0.05, 1.21, 0.3, 0.07, 0.08, 0.16, { segs: 10, tint: lin( 0x6d8fa6 ), data: hd( 0, 0, 0.3 ) } );
			B.cyl( 'hard', 0.45, 1.21, 0.3, 0.025, 0.025, 0.18, { segs: 8, tint: lin( 0xf2ead8 ), data: hd( 0, 0, 0.7 ) } );
			kit.solid( 0, 0.6, 0.3, w, 1.2, 0.6 );
			const pos = kit.light( 0, 0.45, 0.6, new Color( 1.0, 0.55, 0.25 ), 2.4 );
			if ( fire ) fire( pos ); // (the crackle in SoundScape)
			return pos;

		},

	};

	return kit;

}
