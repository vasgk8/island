import { Color, Vector3 } from '../../engine/index.js';
import { lin, C, WOOD, HARD, wallLantern, woodpile } from '../Props.js';
import { furnitureKit } from './Furniture.js';
import { quad01Part } from './GeoBuilder.js';

// A small home dug into the west flank of the mountain, facing the sunset over the long west beach.
// From above and behind it is a mossy sod roof flush with the slope; from the front a rubble-stone
// face with an arched green door standing open and two small lit windows. Inside: a plastered room
// with a plank floor, ceiling beams, a fireplace with a chimney, a bed, a chest, a table and stools,
// a bookshelf, a kitchen counter, a desk under the window, a rug, a painting and a hanging lantern.
// A faint footpath leads down to it from the lookout (terrain/IslandShape.js PATHS).
//
// Two steps: carveHiddenHome() digs the room and the front yard into the heightmap (before anything
// reads heights), buildHiddenHome() builds the geometry, lights and colliders.
//
// Local frame (as the village builder): x across the front, +z out of the door (downhill), y up
// from the floor level F.

export const HIDDEN_HOME = {
	x: - 68, z: - 380, yaw: - 85 * Math.PI / 180, // front faces west
	W: 6.0, D: 5.0, // inner room (m)
	T: 0.4, // wall thickness
	H: 2.5, // floor to ceiling
};

const HOME = HIDDEN_HOME;
const OX = HOME.W / 2 + HOME.T, OZ = HOME.D / 2 + HOME.T; // outer half sizes
// where the side banks sample the original ground (front of the house to behind the back wall)
const BERM_Z = [ OZ + 0.3, 1.9, 0.9, 0, - 0.9, - 1.9, - OZ, - OZ - 0.9 ];

export function carveHiddenHome( terrain ) {

	const { x, z, yaw } = HOME;
	const c = Math.cos( yaw ), s = Math.sin( yaw );
	const g = ( lx, lz ) => terrain.heightAt( x + lx * c + lz * s, z - lx * s + lz * c );

	// floor level: the ground along the front wall
	let sum = 0;
	for ( let i = 0; i <= 6; i ++ ) sum += g( - OX + i * OX / 3, OZ );
	const F = sum / 7 - 0.05;

	// the original ground beside and behind the walls (the stone berms rise to meet it)
	const ground = {
		lz: BERM_Z,
		left: BERM_Z.map( ( lz ) => g( - OX - 0.45, lz ) ),
		right: BERM_Z.map( ( lz ) => g( OX + 0.45, lz ) ),
		back: [ - 2.9, 0, 2.9 ].map( ( lx ) => g( lx, - OZ - 0.45 ) ),
	};

	// the room (sharp edge, under the walls) and a little front yard (blended into the slope)
	// (the room cut reaches 0.7 m past the walls so the 1 m heightmap ramp stays under the berms)
	terrain.carveRect( x, z, yaw, OX + 0.7, - OZ - 0.7, OZ, F - 0.04, 0.4 );
	terrain.carveRect( x, z, yaw, OX + 0.4, OZ, OZ + 3.6, F - 0.03, 3 );
	HOME.F = F;
	HOME.ground = ground;
	return F;

}

export function buildHiddenHome( ctx ) {

	const { B, colliders, rand } = ctx;

	const { x, z, yaw, W, D, T, H } = HOME;
	const F = HOME.F;
	const ground = HOME.ground;
	const hw = W / 2, hd = D / 2;
	const wd = ( w = 0.6, paint = 0, pattern = 0 ) => WOOD( rand.next(), w, paint, pattern );
	const stoneOut = () => [ rand.next(), 0, 0, 0 ]; // coursed rubble
	const plaster = () => [ rand.next(), 1, 0, 0 ]; // plaster over stone
	const cloth = () => [ rand.next(), 0 ]; // no sway indoors
	const grey = lin( 0x9c968b ), warm = lin( 0xeadcc4 );

	B.pushAt( x, F, z, yaw );

	// collider helper: a box given in the local frame
	const solid = ( lx, ly, lz, sx, sy, sz, opts = {} ) => {

		const w = B.toWorld( lx, ly, lz );
		return colliders.addBox( w, new Vector3( sx / 2, sy / 2, sz / 2 ), yaw, { tag: 'hiddenHome', ...opts } );

	};

	// ------------------------------------------------------------- shell
	const frontTop = H + 0.06 + 0.35, backTop = Math.max( H + 0.06 + 0.75, Math.max( ...ground.back ) - F );
	const base = - 0.4;

	// floor: planks over the carved ground
	B.box( 'wood', 0, 0.01, 0, W, 0.1, D, { grain: 0, tint: lin( 0xb48a5e ), data: wd( 0.25, 0, 6 ) } );
	solid( 0, 0.0, 0, W, 0.12, D, { walkable: true } );

	// back wall (stone out, plaster in)
	B.box( 'stone', 0, ( base + backTop ) / 2, - hd - T / 2 - 0.05, W + 2 * T, backTop - base, T - 0.1, { grain: 0, tint: grey, data: stoneOut() } );
	B.box( 'stone', 0, ( base + H + 0.1 ) / 2, - hd - 0.05, W, H + 0.1 - base, 0.1, { grain: 0, tint: warm, data: plaster() } );
	solid( 0, H / 2, - hd - T / 2, W + 2 * T, H + 1, T );

	// side walls: sloped tops following the roof
	for ( const sd of [ - 1, 1 ] ) {

		const xo = sd * OX;
		const pts = [ [ OZ, base ], [ OZ, frontTop ], [ - OZ, backTop ], [ - OZ, base ] ].map( ( [ lz, y ] ) => new Vector3( xo, y, lz ) );
		B.slab( 'stone', pts, T - 0.1, { up: new Vector3( sd, 0, 0 ), uDir: new Vector3( 0, 0, 1 ), tint: grey, data: stoneOut() } );
		B.box( 'stone', sd * ( hw + 0.05 ), ( base + H + 0.1 ) / 2, 0, 0.1, H + 0.1 - base, D, { grain: 2, tint: warm, data: plaster() } );
		solid( sd * ( hw + T / 2 ), H / 2, 0, T, H + 1, D + 2 * T );

	}

	// banks outside the side walls: earth faced with stone, up to the original ground and capped with
	// sod, following the slope (they hide the cut and blend the walls into the hill)
	const roofAt = ( lz ) => frontTop + 0.05 + ( backTop - frontTop ) * ( OZ + 0.35 - lz ) / ( 2 * OZ + 1.25 ) - 0.05;
	for ( const [ sd, list ] of [ [ - 1, ground.left ], [ 1, ground.right ] ] ) {

		const xo = sd * ( OX + 0.9 );
		const top = list.map( ( gh, i ) => Math.max( 0.05, Math.min( gh - F + 0.05, roofAt( ground.lz[ i ] ) ) ) );
		for ( let i = 0; i < top.length - 1; i ++ ) {

			const za = ground.lz[ i ], zb = ground.lz[ i + 1 ];
			const pts = [ [ za, base ], [ za, top[ i ] ], [ zb, top[ i + 1 ] ], [ zb, base ] ].map( ( [ lz, y ] ) => new Vector3( xo, y, lz ) );
			B.slab( 'stone', pts, 0.9, { up: new Vector3( sd, 0, 0 ), uDir: new Vector3( 0, 0, 1 ), tint: grey, data: stoneOut() } );
			B.beam( 'thatch', [ sd * ( OX + 0.45 ), top[ i ] + 0.05, za ], [ sd * ( OX + 0.45 ), top[ i + 1 ] + 0.05, zb ], 1.0, 0.14, { extend: 0.06, tint: [ 0.42, 0.62, 0.3 ], data: [ rand.next(), 0.85, 0, 0 ] } );

		}

	}

	ground.back.forEach( ( gh, i ) => {

		const top = gh - F + 0.05;
		if ( top < 0.4 ) return;
		B.box( 'stone', [ - 2.9, 0, 2.9 ][ i ], ( base + top ) / 2, - OZ - 0.45, 2.95, top - base, 0.9, { grain: 0, tint: grey, data: stoneOut() } );

	} );

	// front wall: pieces around the arched door (lx -0.65..0.65, arch springs at 1.4) and two windows
	const fz = hd + T / 2; // front wall centre line
	const DW = 0.65, SPRING = 1.4, RO = 0.95; // door half width, arch spring height, arch outer radius
	const win = [ [ - 1.95, 0.35 ], [ 1.95, 0.35 ] ]; // window centre x, half width
	const WY0 = 1.0, WY1 = 1.7;
	const fbox = ( x0, x1, y0, y1 ) => {

		if ( x1 - x0 < 0.01 || y1 - y0 < 0.01 ) return;
		B.box( 'stone', ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, fz, x1 - x0, y1 - y0, T, { grain: 0, tint: grey, data: stoneOut() } );

	};

	for ( const sd of [ - 1, 1 ] ) {

		const [ wx, whw ] = win[ sd < 0 ? 0 : 1 ];
		const a = Math.abs( wx ) - whw, b = Math.abs( wx ) + whw;
		const seg = ( u0, u1, y0, y1 ) => sd < 0 ? fbox( - u1, - u0, y0, y1 ) : fbox( u0, u1, y0, y1 );
		seg( b, OX, base, frontTop ); // outer pier
		seg( a, b, base, WY0 ); // under the window
		seg( a, b, WY1, frontTop ); // over the window
		seg( RO, a, base, frontTop ); // between window and door
		seg( DW, RO, base, SPRING ); // door jamb
		solid( sd * ( DW + OX ) / 2, H / 2, fz, OX - DW, H + 1, T );

		// spandrel between the arch ring and the square corner: the corner first (slabs fan from
		// pts[0]) and the arc wound counter-clockwise seen from the front, so it is never reversed
		const pts = [ new Vector3( sd * RO, SPRING + RO, hd + T ) ];
		for ( let k = 0; k <= 8; k ++ ) {

			const th = sd < 0 ? Math.PI - k / 8 * Math.PI / 2 : ( 1 - k / 8 ) * Math.PI / 2;
			pts.push( new Vector3( Math.cos( th ) * RO, SPRING + Math.sin( th ) * RO, hd + T ) );

		}

		B.slab( 'stone', pts, T, { up: new Vector3( 0, 0, 1 ), tint: grey, data: stoneOut() } );

	}

	fbox( - RO, RO, SPRING + RO, frontTop ); // over the arch

	// arch ring: wedge stones around the door head
	for ( let k = 0; k < 9; k ++ ) {

		const t0 = k / 9 * Math.PI, t1 = ( k + 1 ) / 9 * Math.PI, rm = ( DW + RO ) / 2;
		B.beam( 'stone', [ Math.cos( t0 ) * rm, SPRING + Math.sin( t0 ) * rm, fz + 0.02 ], [ Math.cos( t1 ) * rm, SPRING + Math.sin( t1 ) * rm, fz + 0.02 ], T + 0.06, RO - DW, { extend: 0.02, tint: lin( 0xb7afa2 ), data: stoneOut() } );

	}

	// threshold
	B.box( 'stone', 0, - 0.03, fz + 0.1, DW * 2 + 0.2, 0.12, T + 0.3, { grain: 0, tint: lin( 0xb0a898 ), data: stoneOut() } );

	// windows: lit panes, wooden frames, sills and green shutters
	const green = lin( 0x3f6e48 );
	for ( const [ wx, whw ] of win ) {

		const ww = whw * 2, wh = WY1 - WY0, wy = ( WY0 + WY1 ) / 2;
		B.part( 'glass', quad01Part( ww - 0.04, wh - 0.04 ), wx, wy, fz + 0.06, { tint: lin( 0xe8d6b0 ), data: [ rand.next(), 0, 1, 0 ] } );
		const fr = { grain: 0, tint: lin( 0x6e5238 ), data: wd( 0.5 ) };
		B.box( 'wood', wx, WY0 + 0.03, fz + 0.06, ww + 0.1, 0.06, 0.1, fr );
		B.box( 'wood', wx, WY1 - 0.03, fz + 0.06, ww + 0.1, 0.06, 0.1, fr );
		B.box( 'wood', wx - whw, wy, fz + 0.06, 0.06, wh, 0.1, fr );
		B.box( 'wood', wx + whw, wy, fz + 0.06, 0.06, wh, 0.1, fr );
		B.box( 'wood', wx, wy, fz + 0.06, 0.04, wh, 0.06, fr ); // muntin
		B.box( 'wood', wx, WY0 - 0.04, fz + 0.18, ww + 0.2, 0.06, 0.2, { grain: 0, tint: lin( 0x8a6a48 ), data: wd( 0.6 ) } ); // outer sill
		B.box( 'wood', wx, WY0 - 0.04, hd - 0.08, ww + 0.1, 0.05, 0.2, { grain: 0, tint: lin( 0x8a6a48 ), data: wd( 0.3 ) } ); // inner sill
		// shutters folded back against the stone
		for ( const sd of [ - 1, 1 ] ) B.box( 'wood', wx + sd * ( whw + whw / 2 + 0.06 ), wy, hd + T + 0.03, whw, wh, 0.04, { grain: 1, tint: green, data: wd( 0.4, 0.8, 4 ) } );

	}

	const res = furnish( B, rand, ctx, solid, { H, hw, hd, fz, DW, SPRING, OX, OZ, T, frontTop, backTop, green, wd, cloth, stoneOut, grey, warm, win, WY0, WY1, yaw } );

	// ceiling planks, beams and the sod roof
	B.box( 'wood', 0, H + 0.06 + 0.03, 0, W, 0.06, D, { grain: 0, tint: lin( 0x9a7550 ), data: wd( 0.3, 0, 6 ) } );
	for ( const bz of [ - 1.6, 0, 1.6 ] ) B.box( 'wood', 0, H - 0.05, bz, W, 0.18, 0.16, { grain: 0, tint: lin( 0x6e5238 ), data: wd( 0.5 ) } );
	{

		const z0 = OZ + 0.35, z1 = - OZ - 0.9, len = z0 - z1;
		const y0 = frontTop + 0.05, y1 = backTop + 0.05;
		const pitch = Math.atan2( y1 - y0, len );
		B.box( 'thatch', 0, ( y0 + y1 ) / 2 - 0.2, ( z0 + z1 ) / 2, W + 2 * T + 1.6, 0.4, len / Math.cos( pitch ), { rx: pitch, tint: [ 0.42, 0.62, 0.3 ], data: [ rand.next(), 0.85, 0, 0 ] } );
		// walkable roof (three steps following the pitch) so you can cross it from the slope
		for ( let i = 0; i < 3; i ++ ) {

			const za = z0 - len * i / 3, zb = z0 - len * ( i + 1 ) / 3;
			const yt = y0 + ( y1 - y0 ) * ( i + 0.5 ) / 3;
			solid( 0, yt - 0.1, ( za + zb ) / 2, W + 2 * T + 1.6, 0.2, za - zb, { walkable: true } );

		}

	}

	// the room, for indoor sound (App) and the minimap
	if ( ctx.interior ) ctx.interior( { x, z, yaw, hx: hw, hz: hd, floorY: F, ceilY: F + H } );

	B.pop();
	return { F, fire: res.fire, chimneyTop: res.chimneyTop };

}

function furnish( B, rand, ctx, solid, o ) {

	const { H, hw, hd, fz, DW, SPRING, OX, OZ, T, backTop, green, wd, cloth, grey, warm, stoneOut, win, WY0, WY1, frontTop, yaw } = o;
	const { lights } = ctx;
	const kit = furnitureKit( ctx, yaw );
	const out = {};

	// ---- plaster on the inside of the front wall, around the door and the windows
	{

		const pz = hd - 0.05, pl = ( x0, x1, y0, y1 ) => {

			if ( x1 - x0 < 0.01 || y1 - y0 < 0.01 ) return;
			B.box( 'stone', ( x0 + x1 ) / 2, ( y0 + y1 ) / 2, pz, x1 - x0, y1 - y0, 0.1, { grain: 0, tint: warm, data: [ rand.next(), 1, 0, 0 ] } );

		};

		const top = H + 0.1;
		for ( const sd of [ - 1, 1 ] ) {

			const [ wx, whw ] = win[ sd < 0 ? 0 : 1 ];
			const a = Math.abs( wx ) - whw, b = Math.abs( wx ) + whw;
			const seg = ( u0, u1, y0, y1 ) => sd < 0 ? pl( - u1, - u0, y0, y1 ) : pl( u0, u1, y0, y1 );
			seg( b, hw, 0, top );
			seg( a, b, 0, WY0 );
			seg( a, b, WY1, top );
			seg( DW + 0.05, a, 0, top );

		}

		pl( - DW - 0.05, DW + 0.05, SPRING + DW + 0.08, top );
		// plaster spandrels between the arch and that lintel piece (corner first, counter-clockwise
		// seen from inside, i.e. facing -z)
		for ( const sd of [ - 1, 1 ] ) {

			const R = DW + 0.05, pts = [ new Vector3( sd * R, SPRING + R + 0.03, hd ) ];
			for ( let k = 0; k <= 8; k ++ ) {

				const th = sd > 0 ? k / 8 * Math.PI / 2 : Math.PI - ( 1 - k / 8 ) * Math.PI / 2;
				pts.push( new Vector3( Math.cos( th ) * R, SPRING + Math.sin( th ) * R, hd ) );

			}

			B.slab( 'stone', pts, 0.1, { up: new Vector3( 0, 0, - 1 ), tint: warm, data: [ rand.next(), 1, 0, 0 ] } );

		}
		// the arch's inner soffit stones show on the inside face too
		for ( let k = 0; k < 9; k ++ ) {

			const t0 = k / 9 * Math.PI, t1 = ( k + 1 ) / 9 * Math.PI, rm = DW + 0.04;
			B.beam( 'stone', [ Math.cos( t0 ) * rm, SPRING + Math.sin( t0 ) * rm, pz ], [ Math.cos( t1 ) * rm, SPRING + Math.sin( t1 ) * rm, pz ], 0.1, 0.1, { extend: 0.02, tint: warm, data: [ rand.next(), 1, 0, 0 ] } );

		}

	}

	// ---- the door: arched, painted green, on its own hinged mesh so it can open and close (E)
	if ( ctx.door ) {

		const dw = DW - 0.03, pts = [ new Vector3( 0, 0.02, 0 ), new Vector3( 2 * dw, 0.02, 0 ) ];
		for ( let k = 0; k <= 12; k ++ ) {

			const th = k / 12 * Math.PI;
			pts.push( new Vector3( dw + Math.cos( th ) * dw, SPRING + Math.sin( th ) * dw, 0 ) );

		}

		// hinge on the left jamb; open = swung in against the wall
		const blocker = solid( 0, 1.05, fz, DW * 2, 2.1, T );
		const D = ctx.door( { hinge: B.toWorld( - DW, 0, hd - 0.02 ), yaw, openAngle: 1.8, open: true, blocker } );
		const DB = D.B;
		DB.slab( 'wood', pts, 0.07, { up: new Vector3( 0, 0, 1 ), uDir: new Vector3( 0, 1, 0 ), tint: green, data: wd( 0.35, 0.85, 3 ) } );
		DB.cyl( 'hard', dw, SPRING - 0.4, 0.02, 0.05, 0.05, 0.05, { rx: Math.PI / 2, segs: 10, tint: lin( 0xc8a24a ), data: HARD( rand.next(), 0, 1, 0.3 ) } );
		DB.cyl( 'hard', dw, SPRING - 0.4, - 0.09, 0.05, 0.05, 0.05, { rx: Math.PI / 2, segs: 10, tint: lin( 0xc8a24a ), data: HARD( rand.next(), 0, 1, 0.3 ) } );
		for ( const hy of [ 0.35, SPRING - 0.1 ] ) DB.box( 'hard', 0.3, hy, 0.01, 0.6, 0.05, 0.02, { tint: C.iron, data: HARD( rand.next(), 0.4, 0.6, 0.5 ) } );
		if ( ctx.interact ) ctx.interact( { pos: B.toWorld( 0, 1.0, hd ), radius: 1.8, text: () => D.target > 0.5 ? 'Close door' : 'Open door', act: () => D.toggle() } );

	}

	// ---- fireplace on the back wall, with a chimney up through the roof
	const fx = 1.2;
	kit.place( fx, - hd, 0, () => {

		out.fire = kit.fireplace( { w: 1.5, ceilY: H + 0.1 } );

	} );
	{

		const cz = - hd - 0.05, top = backTop + 1.3;
		B.box( 'stone', fx, ( H + top ) / 2, cz, 0.7, top - H, 0.7, { grain: 0, tint: grey, data: stoneOut() } );
		B.box( 'stone', fx, top + 0.06, cz, 0.85, 0.12, 0.85, { grain: 0, tint: lin( 0x8f877a ), data: stoneOut() } );
		B.cyl( 'hard', fx, top + 0.12, cz, 0.12, 0.12, 0.3, { segs: 10, tint: lin( 0x6b4a36 ), data: HARD( rand.next(), 0.5, 0, 0.6 ) } );
		out.chimneyTop = B.toWorld( fx, top + 0.45, cz );

	}

	// ---- sleeping corner on the left: bed, a little table with a lamp, a chest, a painting
	const bz = - hd + 1.05;
	kit.place( - hw + 0.72, bz, 0, () => kit.bed() );
	kit.place( - hw + 0.37, bz + 1.35, 0, () => kit.sideTable() );
	kit.place( - hw + 0.42, bz + 2.0, 0, () => kit.chest() );
	kit.place( - hw, bz, Math.PI / 2, () => kit.painting() );

	// ---- right wall: bookshelf at the back, kitchen counter at the front
	kit.place( hw - 0.19, - hd + 0.725, - Math.PI / 2, () => kit.bookshelf( { len: 1.25, top: 2.0 } ) );
	kit.place( hw - 0.3, 0.975, - Math.PI / 2, () => kit.counter( { len: 2.55 } ) );

	// ---- the middle: rug, table and stools, the lantern over it; a desk under the left window
	kit.place( 0.15, 0.45, 0, () => kit.rug() );
	kit.place( 0.25, 0.55, 0, () => kit.table() );
	kit.hangingLantern( 0.25, 0.55, H );
	kit.place( - 1.95, hd - 0.27, Math.PI, () => kit.desk() );

	// ---- outside: a lantern by the door, a woodpile, stepping stones and flower pots
	{

		const wl = wallLantern( B, 1.25, 1.85, hd + T, rand.next() );
		lights.push( { position: wl, color: new Color( 1.0, 0.72, 0.42 ), intensity: 1.6, kind: 'pathLight' } );
		woodpile( B, - OX - 0.1, - 0.05, OZ + 0.9, Math.PI / 2, rand );
		solid( - OX + 0.3, 0.5, OZ + 0.9, 1.4, 1.0, 0.7 );
		for ( let i = 0; i < 5; i ++ ) B.box( 'stone', ( rand.next() - 0.5 ) * 0.3, - 0.02, OZ + 0.55 + i * 0.62, 0.55 + rand.next() * 0.15, 0.08, 0.42, { grain: 0, ry: rand.next() - 0.5, tint: lin( 0xb0a898 ), data: stoneOut() } );
		for ( const [ px, pz ] of [ [ 1.0, OZ + 0.35 ], [ 1.35, OZ + 0.55 ], [ - 1.1, OZ + 0.4 ] ] ) {

			B.cyl( 'hard', px, - 0.02, pz, 0.16, 0.12, 0.28, { segs: 10, tint: lin( 0xb8603a ), data: HARD( rand.next(), 0, 0, 0.7 ) } );
			for ( let k = 0; k < 6; k ++ ) {

				const a = k / 6 * Math.PI * 2 + px;
				B.slab( 'cloth', [ new Vector3( px, 0.24, pz ), new Vector3( px + Math.cos( a ) * 0.22, 0.48, pz + Math.sin( a ) * 0.22 ), new Vector3( px + Math.cos( a + 0.4 ) * 0.15, 0.55, pz + Math.sin( a + 0.4 ) * 0.15 ) ], 0, { tint: k % 2 ? lin( 0x4f8a3a ) : lin( 0xd8543e ), data: cloth() } );

			}

		}

	}

	return out;

}
