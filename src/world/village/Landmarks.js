import { Color, Vector3 } from '../../engine/index.js';
import { lin, C, WOOD, pathLight, bench } from '../Props.js';
import { sagPoints } from './GeoBuilder.js';
import { PATHS } from '../terrain/IslandShape.js';
import { PLACES } from '../Places.js';

// Places to visit built into the village builder (Village.js): the lookout at the end of the hiking
// trail and the jetty off the east beach. v is the village (footprints, foundation checks), ctx the
// builder context.

// ------------------------------------------------------------------ places to visit

// a lookout at the top of the hiking trail and a jetty off the east beach (the beach huts are in
// the layout)
export function buildLandmarks( v, ctx ) {

	const { B, terrain, colliders, rand, lights } = ctx;
	const g = ( x, z ) => terrain.heightAt( x, z );
	const wd = ( w = 0.8 ) => WOOD( rand.next(), w, 0.6, 0 );
	const box = ( x, y, z, hx, hy, hz, ry, opts ) => colliders.addBox( new Vector3( x, y, z ), new Vector3( hx, hy, hz ), ry, opts );

	// lookout: a timber platform at the end of the trail, looking south over the bay
	{

		const { x: cx, z: cz, yaw: ry } = PLACES.lookout, W = 4.2, D = 3.2;
		const cs = Math.cos( ry ), sn = Math.sin( ry );
		const at = ( lx, lz ) => [ cx + lx * cs + lz * sn, cz - lx * sn + lz * cs ];
		let top = - Infinity;
		for ( const [ lx, lz ] of [ [ - W / 2, - D / 2 ], [ W / 2, - D / 2 ], [ - W / 2, D / 2 ], [ W / 2, D / 2 ] ] ) top = Math.max( top, g( ...at( lx, lz ) ) );
		const deck = top + 0.45;
		B.box( 'wood', cx, deck - 0.05, cz, W, 0.1, D, { ry, grain: 0, data: wd( 0.9 ) } );
		box( cx, deck - 0.05, cz, W / 2, 0.05, D / 2, ry, { walkable: true, solid: true, tag: 'lookout' } );
		for ( const [ lx, lz ] of [ [ - W / 2 + 0.15, - D / 2 + 0.15 ], [ W / 2 - 0.15, - D / 2 + 0.15 ], [ - W / 2 + 0.15, D / 2 - 0.15 ], [ W / 2 - 0.15, D / 2 - 0.15 ] ] ) {

			const [ x, z ] = at( lx, lz );
			const gy = g( x, z ) - 0.3;
			B.box( 'wood', x, ( gy + deck + 1.0 ) / 2, z, 0.14, deck + 1.0 - gy, 0.14, { ry, grain: 1, data: wd() } );
			v.foundationChecks.push( { x, y: gy, z } );

		}

		// railing on the three open sides (the trail arrives from the back, -z)
		for ( const [ ax, az, bx, bz ] of [ [ - W / 2, D / 2, W / 2, D / 2 ], [ - W / 2, - D / 2, - W / 2, D / 2 ], [ W / 2, - D / 2, W / 2, D / 2 ] ] ) {

			const [ x0, z0 ] = at( ax, az ), [ x1, z1 ] = at( bx, bz );
			for ( const h of [ 0.5, 0.95 ] ) B.beam( 'wood', [ x0, deck + h, z0 ], [ x1, deck + h, z1 ], 0.07, 0.07, { data: wd() } );
			const mx = ( x0 + x1 ) / 2, mz = ( z0 + z1 ) / 2, len = Math.hypot( x1 - x0, z1 - z0 );
			box( mx, deck + 0.5, mz, ax === bx ? 0.06 : len / 2, 0.5, ax === bx ? len / 2 : 0.06, ry, { tag: 'lookoutRail' } );

		}

		const [ bx, bz ] = at( 0, D / 2 - 0.6 );
		bench( B, bx, deck, bz, ry + Math.PI, 1.8, rand.next(), lin( 0x4f8fa0 ) );
		box( bx, deck + 0.45, bz, 0.9, 0.45, 0.3, ry, { tag: 'bench' } );
		const [ lx, lz ] = at( - W / 2 - 0.5, - D / 2 - 0.4 );
		const w = pathLight( B, lx, g( lx, lz ) - 0.25, lz, rand.next() );
		lights.push( { position: w, color: new Color( 1.0, 0.7, 0.4 ), intensity: 2.5, kind: 'pathLight' } );
		v.footprints.push( { x: cx, z: cz, r: 4, kind: 'prop' } );

	}

	// jetty off the east beach: a plank deck on piles running out to ~3 m of water, a light at the end
	{

		const { z, x0, x1 } = PLACES.jetty, deck = 1.45, half = 1.0, step = 3.2;
		for ( let x = x0; x < x1; x += step ) {

			const xe = Math.min( x + step, x1 );
			B.box( 'wood', ( x + xe ) / 2, deck - 0.05, z, xe - x - 0.02, 0.1, half * 2, { grain: 0, data: wd( 0.95 ) } );
			for ( const s of [ - 1, 1 ] ) {

				const pz = z + s * ( half - 0.1 );
				const sea = g( x, pz ) - 0.6;
				B.cyl( 'wood', x, sea, pz, 0.11, 0.13, deck - sea, { segs: 7, data: wd() } );
				colliders.addCylinder( x, pz, 0.13, sea, deck, { tag: 'jettyPile' } );
				v.foundationChecks.push( { x, y: sea, z: pz } );

			}

		}

		box( ( x0 + x1 ) / 2, deck - 0.05, z, ( x1 - x0 ) / 2, 0.05, half, 0, { walkable: true, solid: true, tag: 'jettyDeck' } );
		for ( const s of [ - 1, 1 ] ) B.cyl( 'wood', x1 - 0.4, deck, z + s * ( half - 0.25 ), 0.12, 0.12, 0.5, { segs: 8, data: wd() } );
		const w = pathLight( B, x1 - 1.2, deck, z + half - 0.2, rand.next() );
		lights.push( { position: w, color: new Color( 1.0, 0.72, 0.42 ), intensity: 3, kind: 'pathLight' } );
		for ( let x = x0; x < 272; x += 3 ) v.footprints.push( { x, z, r: 2, kind: 'prop' } );

	}

}

// Timber steps set into the steep stretches of the mountain trails (grade over ~1:2), with a rope
// rail on posts along the downhill side, so the climb to the cabin reads as a made path.
export function buildTrailSteps( v, ctx ) {

	const { B, terrain, colliders, rand } = ctx;
	const g = ( x, z ) => terrain.heightAt( x, z );
	for ( const trail of PATHS.filter( ( p ) => p.name === 'mountain' || p.name === 'hidden' ) ) {

		const pts = trail.pts;
		for ( let k = 0; k + 1 < pts.length; k ++ ) {

			const [ ax, az ] = pts[ k ], [ bx, bz ] = pts[ k + 1 ];
			const L = Math.hypot( bx - ax, bz - az );
			const grade = ( g( bx, bz ) - g( ax, az ) ) / L;
			if ( Math.abs( grade ) < 0.5 ) continue;
			const dx = ( bx - ax ) / L, dz = ( bz - az ) / L;
			const px = - dz, pz = dx; // across the path
			const half = trail.w + 0.35;
			// steps: a squared log across the path every ~0.55 m of climb, pegged at both ends
			const n = Math.max( 2, Math.round( Math.abs( grade ) * L / 0.55 ) );
			for ( let i = 0; i < n; i ++ ) {

				const t = ( i + 0.5 ) / n;
				const x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
				const ya = g( x - px * half, z - pz * half ), yb = g( x + px * half, z + pz * half );
				B.beam( 'wood', [ x - px * half, ya + 0.05, z - pz * half ], [ x + px * half, yb + 0.05, z + pz * half ], 0.16, 0.13, { data: WOOD( rand.next(), 0.85 ) } );
				for ( const sd of [ - 1, 1 ] ) {

					const sx = x + px * sd * ( half + 0.06 ), sz = z + pz * sd * ( half + 0.06 );
					B.cyl( 'wood', sx, g( sx, sz ) - 0.25, sz, 0.035, 0.04, 0.42, { segs: 5, data: WOOD( rand.next(), 0.9 ) } );

				}

			}

			// rope rail on posts along the downhill side
			const ox = px * ( half + 0.45 ), oz = pz * ( half + 0.45 );
			const side = g( ax + ox, az + oz ) < g( ax - ox, az - oz ) ? 1 : - 1;
			const np = Math.max( 2, Math.ceil( L / 2.4 ) + 1 );
			let prev = null;
			for ( let i = 0; i < np; i ++ ) {

				const t = i / ( np - 1 );
				const x = ax + ( bx - ax ) * t + ox * side, z = az + ( bz - az ) * t + oz * side;
				const gy = g( x, z );
				B.cyl( 'wood', x, gy - 0.35, z, 0.05, 0.06, 1.4, { segs: 6, data: WOOD( rand.next(), 0.9 ) } );
				colliders.addCylinder( x, z, 0.07, gy - 0.35, gy + 1.05, { tag: 'post' } );
				v.foundationChecks.push( { x, y: gy - 0.35, z } );
				const top = [ x, gy + 0.95, z ];
				if ( prev ) B.tube( 'rope', sagPoints( prev, top, 0.12, 6 ), 0.014, { radial: 4, tint: C.rope, data: [ rand.next(), 0, 0, 0 ] } );
				prev = top;

			}

		}

	}

}
