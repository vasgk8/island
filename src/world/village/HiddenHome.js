import { Color, Vector3 } from '../../engine/index.js';
import { lin, C, WOOD, HARD, lantern, wallLantern, woodpile } from '../Props.js';
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

export function buildHiddenHome( { B, colliders, rand, lights } ) {

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
		colliders.addBox( w, new Vector3( sx / 2, sy / 2, sz / 2 ), yaw, { tag: 'hiddenHome', ...opts } );

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

	furnish( B, rand, lights, solid, { W, D, T, H, hw, hd, fz, DW, SPRING, OX, OZ, frontTop, backTop, green, wd, cloth, plaster, stoneOut, grey, warm, ground, F } );

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

	B.pop();
	return { F };

}

function furnish( B, rand, lights, solid, o ) {

	const { W, D, T, H, hw, hd, fz, DW, SPRING, OX, OZ, backTop, green, wd, cloth, grey, warm, stoneOut, F } = o;
	const dark = lin( 0x5a4030 ), mid = lin( 0x8a6844 ), pale = lin( 0xc9a77c );
	const light = ( lx, ly, lz, color, intensity, kind = 'lantern' ) => lights.push( { position: B.toWorld( lx, ly, lz ), color, intensity, kind } );

	// ---- the door: arched, painted green, standing open against the inside wall
	{

		const dw = DW - 0.03, pts = [ new Vector3( 0, 0.02, 0 ), new Vector3( 2 * dw, 0.02, 0 ) ];
		for ( let k = 0; k <= 12; k ++ ) {

			const th = k / 12 * Math.PI;
			pts.push( new Vector3( dw + Math.cos( th ) * dw, SPRING + Math.sin( th ) * dw, 0 ) );

		}

		B.pushAt( - DW, 0, hd - 0.02, 1.8 ); // hinge on the left jamb, swung in
		B.slab( 'wood', pts, 0.07, { up: new Vector3( 0, 0, 1 ), uDir: new Vector3( 0, 1, 0 ), tint: green, data: wd( 0.35, 0.85, 3 ) } );
		B.cyl( 'hard', dw, SPRING - 0.4, 0.02, 0.05, 0.05, 0.05, { rx: Math.PI / 2, segs: 10, tint: lin( 0xc8a24a ), data: HARD( rand.next(), 0, 1, 0.3 ) } );
		for ( const hy of [ 0.35, SPRING - 0.1 ] ) B.box( 'hard', 0.3, hy, 0.01, 0.6, 0.05, 0.02, { tint: C.iron, data: HARD( rand.next(), 0.4, 0.6, 0.5 ) } );
		B.pop();

	}

	// ---- fireplace on the back wall, with a chimney up through the roof
	const fx = 1.2, fw = 1.5;
	{

		const st = { grain: 0, tint: lin( 0xa69e90 ), data: stoneOut() };
		B.box( 'stone', fx - fw / 2 + 0.15, 0.55, - hd + 0.28, 0.3, 1.1, 0.56, st );
		B.box( 'stone', fx + fw / 2 - 0.15, 0.55, - hd + 0.28, 0.3, 1.1, 0.56, st );
		B.box( 'stone', fx, 1.0, - hd + 0.28, fw, 0.22, 0.56, st ); // lintel
		B.box( 'hard', fx, 0.45, - hd + 0.04, fw - 0.6, 0.9, 0.04, { tint: lin( 0x1a1612 ), data: HARD( rand.next(), 0, 0, 0.9 ) } ); // sooty back
		B.box( 'stone', fx, 0.02, - hd + 0.55, fw + 0.4, 0.06, 1.0, { grain: 0, tint: lin( 0x8f877a ), data: stoneOut() } ); // hearth
		B.box( 'wood', fx, 1.17, - hd + 0.3, fw + 0.25, 0.08, 0.36, { grain: 0, tint: dark, data: wd( 0.4 ) } ); // mantel
		B.box( 'stone', fx, ( 1.21 + H + 0.1 ) / 2, - hd + 0.22, fw - 0.5, H + 0.1 - 1.21, 0.44, { grain: 0, tint: warm, data: [ rand.next(), 1, 0, 0 ] } ); // chimney breast
		// logs and embers
		for ( const [ dx, ry ] of [ [ - 0.18, 0.2 ], [ 0.16, - 0.25 ], [ 0, 0.05 ] ] ) B.cyl( 'wood', fx + dx, 0.14, - hd + 0.3, 0.06, 0.06, 0.55, { rz: Math.PI / 2, ry, segs: 7, tint: dark, data: wd( 0.9 ) } );
		B.part( 'glass', quad01Part( 0.5, 0.14 ), fx, 0.12, - hd + 0.42, { rx: - 1.2, tint: lin( 0xff8a3a ), data: [ rand.next(), 1, 1, 0 ] } );
		light( fx, 0.45, - hd + 0.6, new Color( 1.0, 0.55, 0.25 ), 2.4 );
		// on the mantel: a clock, a candle, a jar
		B.box( 'wood', fx - 0.45, 1.33, - hd + 0.3, 0.2, 0.26, 0.12, { grain: 1, tint: mid, data: wd( 0.3 ) } );
		B.cyl( 'hard', fx - 0.45, 1.36, - hd + 0.37, 0.07, 0.07, 0.01, { rx: Math.PI / 2, segs: 12, tint: lin( 0xefe6d0 ), data: HARD( rand.next(), 0, 0, 0.4 ) } );
		B.cyl( 'hard', fx + 0.05, 1.21, - hd + 0.3, 0.07, 0.08, 0.16, { segs: 10, tint: lin( 0x6d8fa6 ), data: HARD( rand.next(), 0, 0, 0.3 ) } );
		B.cyl( 'hard', fx + 0.45, 1.21, - hd + 0.3, 0.025, 0.025, 0.18, { segs: 8, tint: lin( 0xf2ead8 ), data: HARD( rand.next(), 0, 0, 0.7 ) } );
		solid( fx, 0.6, - hd + 0.3, fw, 1.2, 0.6 );
		// chimney: through the roof and above the slope behind
		const cz = - hd - 0.05, top = backTop + 1.3;
		B.box( 'stone', fx, ( H + top ) / 2, cz, 0.7, top - H, 0.7, { grain: 0, tint: grey, data: stoneOut() } );
		B.box( 'stone', fx, top + 0.06, cz, 0.85, 0.12, 0.85, { grain: 0, tint: lin( 0x8f877a ), data: stoneOut() } );
		B.cyl( 'hard', fx, top + 0.12, cz, 0.12, 0.12, 0.3, { segs: 10, tint: lin( 0x6b4a36 ), data: HARD( rand.next(), 0.5, 0, 0.6 ) } );

	}

	// ---- bed along the left wall at the back
	{

		const bx = - hw + 0.72, bz0 = - hd + 0.05, bz1 = bz0 + 2.0, bc = ( bz0 + bz1 ) / 2;
		B.box( 'wood', bx, 0.24, bc, 1.4, 0.3, 2.0, { grain: 0, tint: mid, data: wd( 0.4 ) } );
		B.box( 'wood', bx, 0.62, bz0 + 0.04, 1.44, 1.05, 0.08, { grain: 0, tint: dark, data: wd( 0.4, 0, 3 ) } ); // headboard
		B.box( 'wood', bx, 0.4, bz1 - 0.04, 1.44, 0.5, 0.08, { grain: 0, tint: dark, data: wd( 0.4 ) } ); // footboard
		B.box( 'cloth', bx, 0.47, bc, 1.32, 0.16, 1.9, { tint: lin( 0xf1ebdf ), data: cloth() } ); // mattress
		B.box( 'cloth', bx, 0.565, bc + 0.3, 1.4, 0.05, 1.35, { tint: lin( 0x3f7f86 ), data: cloth() } ); // blanket
		B.box( 'cloth', bx, 0.57, bc + 0.55, 1.42, 0.06, 0.3, { tint: lin( 0xc9583e ), data: cloth() } ); // folded throw
		B.box( 'cloth', bx, 0.62, bz0 + 0.32, 0.9, 0.13, 0.36, { tint: lin( 0xfbf7ee ), data: cloth() } ); // pillow
		solid( bx, 0.35, bc, 1.45, 0.7, 2.05 );
		// bedside table with a little lantern
		const tz = bz1 + 0.35;
		B.box( 'wood', bx - 0.35, 0.3, tz, 0.5, 0.6, 0.45, { grain: 0, tint: mid, data: wd( 0.3 ) } );
		const lc = lantern( B, bx - 0.35, 0.95, tz, rand.next(), 0.55 );
		light( lc[ 0 ], lc[ 1 ], lc[ 2 ], new Color( 1.0, 0.7, 0.4 ), 0.9 );
		solid( bx - 0.35, 0.3, tz, 0.5, 0.6, 0.45 );
		// chest at the foot of the bed
		const cz = tz + 0.65;
		B.box( 'wood', - hw + 0.42, 0.25, cz, 0.7, 0.5, 0.5, { grain: 0, tint: lin( 0x7a5434 ), data: wd( 0.5, 0, 5 ) } );
		for ( const dx of [ - 0.22, 0.22 ] ) B.box( 'hard', - hw + 0.42 + dx, 0.25, cz, 0.05, 0.52, 0.52, { tint: C.iron, data: HARD( rand.next(), 0.5, 0.6, 0.5 ) } );
		solid( - hw + 0.42, 0.25, cz, 0.7, 0.5, 0.5 );
		// a painting over the bed (a little map of the island)
		B.box( 'wood', - hw + 0.03, 1.5, bc, 0.05, 0.7, 1.0, { grain: 0, tint: dark, data: wd( 0.3 ) } );
		B.box( 'cloth', - hw + 0.06, 1.5, bc, 0.02, 0.58, 0.88, { tint: lin( 0x7fb8b0 ), data: cloth() } );
		B.box( 'cloth', - hw + 0.075, 1.48, bc + 0.05, 0.01, 0.3, 0.22, { tint: lin( 0xd8c48e ), data: cloth() } );
		B.box( 'cloth', - hw + 0.08, 1.5, bc + 0.05, 0.01, 0.18, 0.12, { tint: lin( 0x5f8a4a ), data: cloth() } );

	}

	// ---- bookshelf on the right wall at the back
	{

		const sx = hw - 0.2, z0 = - hd + 0.1, z1 = - hd + 1.35, zc = ( z0 + z1 ) / 2, top = 2.0;
		const sh = { grain: 0, tint: mid, data: wd( 0.35 ) };
		for ( const zz of [ z0, z1 ] ) B.box( 'wood', sx, top / 2, zz, 0.36, top, 0.04, sh );
		B.box( 'wood', sx + 0.17, top / 2, zc, 0.02, top, z1 - z0, sh );
		const books = [ 0x8a3b2e, 0x2f5f7a, 0xd8b45a, 0x3f6e48, 0x6a4a7a, 0xc96f3a, 0xe9e1cf, 0x1f3f5a, 0x9a8a5a ];
		for ( let i = 0; i < 5; i ++ ) {

			const y = 0.05 + i * 0.47;
			B.box( 'wood', sx, y, zc, 0.36, 0.03, z1 - z0, sh );
			if ( i === 4 ) break;
			let zz = z0 + 0.04;
			while ( zz < z1 - 0.12 ) {

				const t = 0.03 + rand.next() * 0.045, h = 0.2 + rand.next() * 0.14;
				if ( rand.next() < 0.12 ) {

					zz += 0.08;
					continue;

				}

				B.box( 'wood', sx + 0.02, y + 0.015 + h / 2, zz + t / 2, 0.24, h, t - 0.004, { grain: 1, rx: rand.next() < 0.1 ? 0.15 : 0, tint: lin( books[ Math.floor( rand.next() * books.length ) ] ), data: wd( 0.1, 0.9 ) } );
				zz += t;

			}

		}

		solid( sx, top / 2, zc, 0.4, top, z1 - z0 );

	}

	// ---- kitchen counter on the right wall at the front, a shelf and pans above it
	{

		const cx = hw - 0.3, z0 = - 0.3, z1 = hd - 0.25, zc = ( z0 + z1 ) / 2, L = z1 - z0;
		B.box( 'wood', cx, 0.42, zc, 0.58, 0.84, L, { grain: 1, tint: lin( 0xd9cba8 ), data: wd( 0.35, 0.85, 3 ) } );
		B.box( 'wood', cx - 0.02, 0.87, zc, 0.64, 0.06, L + 0.04, { grain: 0, tint: dark, data: wd( 0.3 ) } );
		B.box( 'wood', cx + 0.08, 0.95, zc - 0.5, 0.36, 0.03, 0.5, { grain: 0, tint: pale, data: wd( 0.2 ) } ); // cutting board
		B.cyl( 'hard', cx, 0.9, zc + 0.35, 0.16, 0.14, 0.18, { segs: 12, tint: lin( 0x3a3a3c ), data: HARD( rand.next(), 0.1, 0.8, 0.45 ) } ); // pot
		B.cyl( 'hard', cx + 0.1, 0.9, zc + 0.85, 0.06, 0.06, 0.16, { segs: 10, tint: lin( 0xb06a3a ), data: HARD( rand.next(), 0, 0, 0.5 ) } ); // jar
		B.cyl( 'hard', cx + 0.1, 0.9, zc + 0.98, 0.05, 0.05, 0.22, { segs: 10, tint: lin( 0x6e8a4a ), data: HARD( rand.next(), 0, 0, 0.5 ) } );
		B.box( 'wood', hw - 0.14, 1.55, zc, 0.26, 0.04, L, { grain: 0, tint: mid, data: wd( 0.3 ) } ); // shelf
		for ( let i = 0; i < 4; i ++ ) B.cyl( 'hard', hw - 0.1, 1.57, zc - 0.45 + i * 0.3, 0.1, 0.1, 0.02, { rz: 1.35, segs: 14, tint: lin( 0xf0ece2 ), data: HARD( rand.next(), 0, 0, 0.3 ) } ); // plates
		for ( let i = 0; i < 3; i ++ ) B.cyl( 'hard', hw - 0.08, 1.57, zc + 0.5 + i * 0.16, 0.05, 0.05, 0.14, { segs: 10, tint: lin( [ 0xc8a24a, 0x9a5a3a, 0x5a7a8a ][ i ] ), data: HARD( rand.next(), 0, 0, 0.4 ) } );
		for ( let i = 0; i < 2; i ++ ) B.cyl( 'hard', hw - 0.04, 1.2 - i * 0.08, zc - 0.2 + i * 0.4, 0.13 - i * 0.03, 0.13 - i * 0.03, 0.03, { rz: Math.PI / 2, segs: 14, tint: lin( 0x2e2e30 ), data: HARD( rand.next(), 0.2, 0.8, 0.5 ) } ); // pans
		solid( cx, 0.45, zc, 0.6, 0.9, L );

	}

	// ---- table with stools in the middle, on a rug
	{

		const tx = 0.25, tz = 0.55;
		B.box( 'cloth', tx - 0.1, 0.075, tz - 0.1, 2.6, 0.02, 1.8, { tint: lin( 0xa8463a ), data: cloth() } );
		B.box( 'cloth', tx - 0.1, 0.08, tz - 0.1, 2.2, 0.02, 1.4, { tint: lin( 0xd8b45a ), data: cloth() } );
		B.box( 'cloth', tx - 0.1, 0.085, tz - 0.1, 1.9, 0.02, 1.1, { tint: lin( 0x7a2e2a ), data: cloth() } );
		B.box( 'wood', tx, 0.76, tz, 1.15, 0.06, 0.78, { grain: 0, tint: mid, data: wd( 0.35, 0, 6 ) } );
		for ( const [ dx, dz ] of [ [ - 0.5, - 0.32 ], [ 0.5, - 0.32 ], [ - 0.5, 0.32 ], [ 0.5, 0.32 ] ] ) B.box( 'wood', tx + dx, 0.37, tz + dz, 0.07, 0.74, 0.07, { grain: 1, tint: dark, data: wd( 0.35 ) } );
		for ( const dx of [ - 0.85, 0.85 ] ) {

			B.cyl( 'wood', tx + dx, 0.44, tz, 0.2, 0.2, 0.05, { segs: 12, tint: mid, data: wd( 0.4 ) } );
			for ( let k = 0; k < 3; k ++ ) {

				const a = k / 3 * Math.PI * 2;
				B.beam( 'wood', [ tx + dx + Math.cos( a ) * 0.15, 0.06, tz + Math.sin( a ) * 0.15 ], [ tx + dx + Math.cos( a ) * 0.1, 0.44, tz + Math.sin( a ) * 0.1 ], 0.04, 0.04, { tint: dark, data: wd( 0.4 ) } );

			}

		}

		B.cyl( 'hard', tx - 0.25, 0.79, tz + 0.1, 0.045, 0.04, 0.1, { segs: 10, tint: lin( 0xe2d6bc ), data: HARD( rand.next(), 0, 0, 0.35 ) } ); // mug
		B.box( 'wood', tx + 0.2, 0.81, tz - 0.12, 0.3, 0.04, 0.22, { grain: 0, ry: 0.3, tint: lin( 0x2f5f7a ), data: wd( 0.1, 0.9 ) } ); // book
		B.cyl( 'hard', tx + 0.05, 0.79, tz + 0.18, 0.13, 0.11, 0.025, { segs: 14, tint: lin( 0xf0ece2 ), data: HARD( rand.next(), 0, 0, 0.3 ) } ); // plate
		solid( tx, 0.4, tz, 1.2, 0.8, 0.82 );

	}

	// ---- writing desk and chair under the left window, a plant
	{

		const dx = - 1.95, dz = hd - 0.32;
		B.box( 'wood', dx, 0.74, dz, 0.95, 0.05, 0.5, { grain: 0, tint: mid, data: wd( 0.3 ) } );
		for ( const [ ox, oz ] of [ [ - 0.42, - 0.2 ], [ 0.42, - 0.2 ], [ - 0.42, 0.2 ], [ 0.42, 0.2 ] ] ) B.box( 'wood', dx + ox, 0.36, dz + oz, 0.05, 0.72, 0.05, { grain: 1, tint: dark, data: wd( 0.3 ) } );
		B.box( 'wood', dx - 0.2, 0.78, dz, 0.28, 0.02, 0.2, { grain: 0, ry: - 0.2, tint: lin( 0xefe6d0 ), data: wd( 0.1, 1 ) } ); // open notebook
		B.box( 'wood', dx, 0.46, dz - 0.6, 0.42, 0.04, 0.4, { grain: 0, tint: dark, data: wd( 0.4 ) } ); // chair seat
		for ( const [ ox, oz ] of [ [ - 0.18, - 0.17 ], [ 0.18, - 0.17 ], [ - 0.18, 0.17 ], [ 0.18, 0.17 ] ] ) B.box( 'wood', dx + ox, 0.23, dz - 0.6 + oz, 0.04, 0.46, 0.04, { grain: 1, tint: dark, data: wd( 0.4 ) } );
		B.box( 'wood', dx, 0.75, dz - 0.79, 0.42, 0.55, 0.04, { grain: 0, tint: dark, data: wd( 0.4, 0, 3 ) } ); // chair back
		B.cyl( 'hard', dx + 0.32, 0.77, dz + 0.05, 0.08, 0.06, 0.12, { segs: 10, tint: lin( 0xb8603a ), data: HARD( rand.next(), 0, 0, 0.6 ) } ); // flower pot
		for ( let k = 0; k < 5; k ++ ) {

			const a = k / 5 * Math.PI * 2;
			B.slab( 'cloth', [ new Vector3( dx + 0.32, 0.88, dz + 0.05 ), new Vector3( dx + 0.32 + Math.cos( a ) * 0.16, 1.02, dz + 0.05 + Math.sin( a ) * 0.16 ), new Vector3( dx + 0.32 + Math.cos( a + 0.35 ) * 0.12, 1.08, dz + 0.05 + Math.sin( a + 0.35 ) * 0.12 ) ], 0, { tint: lin( 0x4f8a3a ), data: cloth() } );

		}

		solid( dx, 0.4, dz, 1.0, 0.8, 0.55 );

	}

	// ---- hanging lantern over the table
	{

		B.rod( 'hard', [ 0.25, H, 0.55 ], [ 0.25, H - 0.45, 0.55 ], 0.008, 0.008, { segs: 4, tint: C.iron, data: HARD( rand.next(), 0.5, 0.6, 0.5 ) } );
		const lc = lantern( B, 0.25, H - 0.45, 0.55, rand.next(), 1.1 );
		light( lc[ 0 ], lc[ 1 ], lc[ 2 ], new Color( 1.0, 0.72, 0.42 ), 3.2 );

	}

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

}
