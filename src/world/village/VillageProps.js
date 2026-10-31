import { Color, Vector3 } from '../../engine/index.js';
import { lin, C, WOOD, rowboat, netRack, laundryLine, oar, buoy, ropeCoil, pathLight, lampPost, wreck, bench } from '../Props.js';
import { PIER } from '../Pier.js';

// Props around the settlement (Village.js builds them into its builder): the lookout plaza at the top
// of the boardwalk, the beach gear by the pier, and the yard of the house. v is the village (its
// footprints, foundation checks and instanced props), ctx the builder context.

// ------------------------------------------------------------------ plaza

export function buildPlaza( v, ctx ) {

	const { B, terrain, colliders, rand, lights } = ctx;
	// a lookout plaza: benches, a lamp and some barrels at the top of the boardwalk
	const g = ( x, z ) => terrain.heightAt( x, z );
	bench( B, 36.2, g( 36.2, - 108.2 ), - 108.2, 0.9, 1.6, rand.next(), lin( 0x4f8fa0 ) );
	colliders.addBox( new Vector3( 36.2, g( 36.2, - 108.2 ) + 0.45, - 108.2 ), new Vector3( 0.85, 0.45, 0.3 ), 0.9, { tag: 'bench' } );
	bench( B, 45.8, g( 45.8, - 108.6 ), - 108.6, - 0.85, 1.6, rand.next(), lin( 0xb05a45 ) );
	colliders.addBox( new Vector3( 45.8, g( 45.8, - 108.6 ) + 0.45, - 108.6 ), new Vector3( 0.85, 0.45, 0.3 ), - 0.85, { tag: 'bench' } );
	const lw = lampPost( B, 44.3, g( 44.3, - 106.2 ), - 106.2, - 2.4, 3.3, rand.next() );
	lights.push( { position: lw, color: new Color( 1.0, 0.72, 0.42 ), intensity: 5, kind: 'lantern' } );
	colliders.addCylinder( 44.3, - 106.2, 0.1, g( 44.3, - 106.2 ), g( 44.3, - 106.2 ) + 3.4, { tag: 'lampPost' } );
	v.foundationChecks.push( { x: 44.3, y: g( 44.3, - 106.2 ), z: - 106.2 } );
	for ( const [ x, z ] of [ [ 37.4, - 115.6 ], [ 38.1, - 116.1 ] ] ) {

		v.inst.add( 'barrel', x, g( x, z ) - 0.02, z, rand.range( 0, 6 ), [ rand.range( 0.85, 1.05 ), 0.92, 0.85 ] );
		colliders.addCylinder( x, z, 0.32, g( x, z ), g( x, z ) + 0.9, { tag: 'barrel' } );

	}

	v.footprints.push( { x: 41.5, z: - 111, r: 6, kind: 'plaza' } );

}

// ------------------------------------------------------------------ beach props

export function buildBeachProps( v, ctx ) {

	const { B, terrain, colliders, rand } = ctx;
	const g = ( x, z ) => terrain.heightAt( x, z );
	const box = ( x, y, z, hx, hy, hz, ry, tag ) => colliders.addBox( new Vector3( x, y, z ), new Vector3( hx, hy, hz ), ry, { tag } );

	// rowboats pulled up on the sand: two upturned ones down the beach west of Joe's fish stand (kept
	// clear of it), one by the pier foot
	const BX = - 26; // the upturned pair and their oars, relative to where they first stood by the stand
	const boats = [
		{ x: 46.8 + BX, z: - 57.2, ry: 0.35, up: true, hull: lin( 0x2f8f9a ), bottom: lin( 0xa0402e ) },
		{ x: 43.9 + BX, z: - 59.8, ry: 0.55, up: true, hull: lin( 0xe9e4d6 ), bottom: lin( 0x2e5f86 ) },
		{ x: 63.5, z: - 55.6, ry: - 0.35, up: false, hull: lin( 0xd8c35a ), bottom: lin( 0x3e6f5a ), rz: 0.14 },
	];
	for ( const b of boats ) {

		const gy = g( b.x, b.z );
		rowboat( B, b.x, gy + ( b.up ? 0.0 : 0.05 ), b.z, b.ry, { upsideDown: b.up, seed: rand.next(), hull: b.hull, bottom: b.bottom, trim: C.white, rz: b.rz || 0 } );
		box( b.x, gy + 0.4, b.z, 0.72, 0.45, 2.0, b.ry, 'rowboat' );
		v.footprints.push( { x: b.x, z: b.z, r: 2.4, kind: 'prop' } );

	}

	// one more boat pulled up next to the boathouse, and an old wreck by the waterline
	{

		const bx = 84.6, bz = - 53.2, gy = g( bx, bz );
		rowboat( B, bx, gy + 0.03, bz, 0.45, { seed: rand.next(), hull: lin( 0xd0e4ea ), bottom: lin( 0xb04a30 ), trim: lin( 0x2f5f7a ), rz: - 0.16, oars: false } );
		box( bx, gy + 0.4, bz, 0.72, 0.45, 2.0, 0.45, 'rowboat' );
		v.footprints.push( { x: bx, z: bz, r: 2.4, kind: 'prop' } );
		const wx = 102.5, wz = - 49.8;
		wreck( B, wx, g( wx, wz ) - 0.12, wz, 0.95, rand, { rz: 0.22, beam: 3.1, depth: 1.05 } );
		box( wx, g( wx, wz ) + 0.4, wz, 1.3, 0.6, 3.6, 0.95, 'wreck' );
		v.footprints.push( { x: wx, z: wz, r: 4, kind: 'prop' } );

	}

	// oars leaning against the first upturned boat, oars on the sand
	oar( B, [ 48.1 + BX, g( 48.1 + BX, - 55.7 ) + 0.03, - 55.7 ], [ 49.6 + BX, g( 49.6 + BX, - 57.9 ) + 0.05, - 57.9 ], rand.next(), lin( 0xc23b2e ) );
	oar( B, [ 48.4 + BX, g( 48.4 + BX, - 55.4 ) + 0.03, - 55.4 ], [ 49.9 + BX, g( 49.9 + BX, - 57.6 ) + 0.06, - 57.6 ], rand.next(), lin( 0xc23b2e ) );

	// net drying racks
	const racks = [ [ 41.8, - 64.2, 0.25, lin( 0x3f6f5f ) ], [ 74.6, - 58.6, - 0.12, lin( 0x2f5f8a ) ], [ 86.4, - 64.0, 0.3, lin( 0xb0553a ) ] ];
	for ( const [ x, z, ry, tint ] of racks ) {

		const cy = Math.cos( ry ), sy = Math.sin( ry );
		netRack( B, x, g( x, z ), z, ry, 3.2, tint, rand.next(), ( lx, lz ) => g( x + lx * cy + lz * sy, z - lx * sy + lz * cy ) );
		for ( const sx of [ - 1.6, 1.6 ] ) {

			const px = x + sx * cy, pz = z - sx * sy;
			colliders.addCylinder( px, pz, 0.1, g( px, pz ) - 0.4, g( px, pz ) + 2.0, { tag: 'rack' } );
			v.foundationChecks.push( { x: px, y: g( px, pz ) - 0.4, z: pz } );

		}

		v.footprints.push( { x, z, r: 2.2, kind: 'prop' } );

	}

	// crates, traps and barrels around the pier foot and along the beach
	const X = PIER.x;
	const cluster = ( items ) => {

		for ( const [ type, x, z, ry, stack ] of items ) {

			const gy = g( x, z );
			const y = gy + ( stack ? stack : 0 ) - 0.02;
			const tone = [ rand.range( 0.82, 1.08 ), rand.range( 0.84, 1.02 ), rand.range( 0.8, 0.98 ) ];
			v.inst.add( type, x, y, z, ry, tone );
			if ( ! stack ) {

				if ( type === 'barrel' ) colliders.addCylinder( x, z, 0.32, gy, gy + 0.9, { tag: 'barrel' } );
				else box( x, gy + 0.25, z, type === 'trap' ? 0.48 : 0.33, 0.3, type === 'trap' ? 0.28 : 0.24, ry, type );

			}

		}

	};

	cluster( [
		[ 'barrel', X + 2.4, - 62.4, 0.4 ], [ 'barrel', X + 3.05, - 62.9, 1.9 ], [ 'crate', X + 2.6, - 61.2, 0.1 ],
		[ 'crate', X + 2.65, - 61.25, 0.4, 0.4 ], [ 'trap', X - 2.6, - 61.0, 0.05 ], [ 'trap', X - 2.65, - 61.6, 0.08 ], [ 'trap', X - 2.6, - 61.3, 0.2, 0.31 ],
		[ 'crate', X - 3.4, - 62.4, 0.6 ],
		[ 'trap', 64.5, - 61.6, 0.3 ], [ 'trap', 65.3, - 61.2, 0.15 ], [ 'trap', 64.9, - 61.4, 0.5, 0.31 ], [ 'trap', 64.6, - 61.5, 1.9, 0.62 ],
		[ 'barrel', 71.3, - 62.3, 0.1 ], [ 'crate', 71.1, - 61.2, 0.3 ], [ 'crate', 71.9, - 61.4, 1.3 ],
		[ 'trap', 83.2, - 67.4, 0.4 ], [ 'trap', 83.9, - 67.9, 0.2 ], [ 'barrel', 82.6, - 68.9, 0.7 ],
		[ 'crate', 88.0, - 53.0, 0.2 ], [ 'crate', 88.1, - 53.0, 0.6, 0.4 ], [ 'barrel', 89.0, - 52.2, 0.3 ],
		[ 'trap', 34.6, - 68.6, 0.3 ], [ 'trap', 35.3, - 68.2, 0.1 ], [ 'crate', 39.6, - 68.9, 0.5 ],
	] );

	// loose buoys and rope coils on the sand
	const pal = [ [ C.orange, C.white ], [ C.red, C.white ], [ C.yellow, C.black ], [ C.white, C.blue ] ];
	for ( const [ x, z ] of [ [ 60.8, - 60.3 ], [ 61.3, - 60.9 ], [ 66.2, - 58.4 ], [ 89.6, - 51.2 ], [ 45.2, - 62.3 ] ] ) {

		const [ a, b ] = rand.pick( pal );
		buoy( B, x, g( x, z ) - 0.02, z, a, b, rand.chance( 0.5 ) ? 0 : 2, rand.next(), { rz: 1.4, ry: rand.range( 0, 6 ) } );

	}

	ropeCoil( B, 59.6, g( 59.6, - 59.2 ), - 59.2, 0.08, 0.34, 5, rand.next() );
	ropeCoil( B, 90.4, g( 90.4, - 52.4 ), - 52.4, 0.08, 0.28, 4, rand.next(), C.ropeBlue );

	// a buoy string on a line of old posts east of the pier foot
	for ( let i = 0; i < 5; i ++ ) {

		const x = 57.8 + i * 1.6, z = - 67.8 - i * 0.25;
		B.cyl( 'wood', x, g( x, z ) - 0.4, z, 0.06, 0.07, 1.65, { segs: 6, data: WOOD( rand.next(), 0.95 ) } );
		colliders.addCylinder( x, z, 0.08, g( x, z ) - 0.4, g( x, z ) + 1.25, { tag: 'post' } );
		v.foundationChecks.push( { x, y: g( x, z ) - 0.4, z } );
		if ( i > 0 ) {

			const px = 57.8 + ( i - 1 ) * 1.6, pz = - 67.8 - ( i - 1 ) * 0.25;
			B.tube( 'rope', [ new Vector3( px, g( px, pz ) + 1.15, pz ), new Vector3( ( px + x ) / 2, ( g( px, pz ) + g( x, z ) ) / 2 + 0.95, ( pz + z ) / 2 ), new Vector3( x, g( x, z ) + 1.15, z ) ], 0.014, { radial: 4, tint: C.rope, data: [ rand.next(), 0, 0, 0 ] } );

		}

	}

}

// ------------------------------------------------------------------ village props

export function buildVillageProps( v, ctx ) {

	const { B, terrain, colliders, rand, lights } = ctx;
	const g = ( x, z ) => terrain.heightAt( x, z );

	// laundry line in the side yard of the house (west of it) and a little clutter by it and the shed
	const cloth = [ lin( 0xf2f0ea ), lin( 0xd9534a ), lin( 0x4f8fc0 ), lin( 0xf0c850 ), lin( 0x7fbf9f ), lin( 0xe89ab0 ) ];
	const pole = ( x, z ) => {

		B.cyl( 'wood', x, g( x, z ) - 0.3, z, 0.04, 0.05, 2.5, { segs: 6, data: WOOD( rand.next(), 0.9 ) } );
		colliders.addCylinder( x, z, 0.06, g( x, z ) - 0.3, g( x, z ) + 2.2, { tag: 'pole' } );
		v.foundationChecks.push( { x, y: g( x, z ) - 0.3, z } );
		return [ x, g( x, z ) + 2.1, z ];

	};

	laundryLine( B, pole( 22.4, - 146.6 ), pole( 22.0, - 151.6 ), rand, cloth );

	const clutter = [
		[ 'trap', 47.9, - 150.2, 0.6 ], [ 'trap', 48.2, - 150.8, 0.4 ],
		[ 'barrel', 25.4, - 157.4, 0.5 ], [ 'barrel', 26.1, - 157.8, 1.5 ],
		[ 'crate', 36.4, - 155.8, 0.3 ], [ 'crate', 36.45, - 155.85, 0.9, 0.4 ],
	];
	for ( const [ type, x, z, ry, stack ] of clutter ) {

		const gy = g( x, z );
		v.inst.add( type, x, gy + ( stack || 0 ) - 0.02, z, ry, [ rand.range( 0.82, 1.08 ), rand.range( 0.84, 1.02 ), rand.range( 0.8, 0.98 ) ] );
		if ( ! stack ) {

			if ( type === 'barrel' ) colliders.addCylinder( x, z, 0.32, gy, gy + 0.9, { tag: 'barrel' } );
			else colliders.addBox( new Vector3( x, gy + 0.25, z ), new Vector3( type === 'trap' ? 0.48 : 0.33, 0.3, type === 'trap' ? 0.28 : 0.24 ), ry, { tag: type } );

		}

	}

	// path lights along the walk from the plaza up to the house
	for ( const [ x, z ] of [ [ 44.2, - 124.0 ], [ 43.0, - 134.5 ], [ 37.0, - 141.5 ] ] ) {

		const w = pathLight( B, x, g( x, z ) - 0.25, z, rand.next() );
		lights.push( { position: w, color: new Color( 1.0, 0.7, 0.4 ), intensity: 2.5, kind: 'pathLight' } );
		colliders.addCylinder( x, z, 0.1, g( x, z ) - 0.25, g( x, z ) + 0.95, { tag: 'pathLight' } );
		v.foundationChecks.push( { x, y: g( x, z ) - 0.25, z } );

	}

}
