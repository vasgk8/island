import { BufferGeometry, Color, Euler, Group, Mesh, Vector3 } from '../engine/index.js';
import { mulberry32 } from '../util/Noise.js';
import { Builder, Batch } from './village/GeoBuilder.js';
import { createVillageMaterials } from './village/VillageMaterials.js';
import { VillageTextures } from './village/TextureBaker.js';
import { buildHouse, buildBoathouse, buildShed } from './village/Buildings.js';
import { buildBoardwalk } from './village/Boardwalk.js';
import { HIDDEN_HOME, carveHiddenHome, buildHiddenHome } from './village/HiddenHome.js';
import { furnishRoom } from './village/Interiors.js';
import { PLACES } from './Places.js';
import { buildPier, PIER } from './Pier.js';
import { G } from '../engine/render/Frame.js';
import { InstancedProps, Rand, lin } from './Props.js';
import { PASTELS, TRIMS, ROOFS, CURTAINS } from './village/Palette.js';
import { buildPlaza, buildBeachProps, buildVillageProps } from './village/VillageProps.js';
import { buildLandmarks, buildTrailSteps } from './village/Landmarks.js';
import { makeDoor, buildDoorMeshes, updateDoors } from './village/Doors.js';

// The settlement by the bay: timber pier with a T-head and the island's name sign, a boathouse,
// a boardwalk up to a small lookout plaza, one two-storey house with its shed on the slope and
// beach huts on the long beaches, dressed with nets, traps, barrels, crates, boats and lanterns.
//
// All static geometry (including repeated props) is merged per material: 6 draw calls
// (wood + glass, hard + rope, roof metal, thatch, stone, fabric). The opaque materials
// share one vertex / index buffer; the wood mesh is the only shadow caster and covers all
// opaque geometry in the shadow passes (see _assemble). Surface detail comes from GPU-baked
// PBR texture sets (village/TextureBaker.js, 43 MB) sampled with metre-scale uvs.

const _lanternEuler = new Euler();

export class Village {

	constructor( { scene, terrain, colliders } ) {

		this.scene = scene;
		this.terrain = terrain;
		this.colliders = colliders;
		this.lights = [];
		this.footprints = [];
		this.foundationChecks = [];
		this.buildings = [];
		// interiors: hinged doors (own meshes), things to use with E (App), rooms (indoor sound)
		this.doors = [];
		this.interactables = [];
		this.interiors = [];
		this.fires = []; // fireplaces (world positions)
		this.chimneys = []; // chimney tops that smoke (App: spray mist)
		this.group = new Group();
		this.group.name = 'Village';

		const rand = new Rand( mulberry32( 90210 ) );
		this.rand = rand;
		// tileable PBR texture sets, baked on the GPU the first time a village material renders
		this.textures = new VillageTextures();
		this.materials = createVillageMaterials( this.textures );
		// one builder: everything static merges into a single mesh per material
		this.B = new Builder();
		this.harbor = this.B;
		this.town = this.B;
		this.inst = new InstancedProps( this.B );

		const specs = this._layout();
		this._flattenPads( specs );

		const ctx = ( B ) => ( {
			B, terrain, colliders, rand, lights: this.lights, inst: this.inst, checks: this.foundationChecks,
			door: ( spec ) => {

				const D = makeDoor( spec );
				this.doors.push( D );
				return D;

			},
			interact: ( it ) => this.interactables.push( it ),
			interior: ( room ) => this.interiors.push( room ),
			fire: ( p ) => this.fires.push( p ),
		} );

		// the fish sign at the pier entrance is its own small mesh: it swings in the wind (update())
		this.signB = new Builder();
		this.pierInfo = buildPier( { B: this.harbor, terrain, colliders, rand, lights: this.lights, inst: this.inst, signB: this.signB, hang: () => new Builder() } );

		// boardwalk from the foot of the pier steps up to the plaza
		const foot = this.pierInfo.stepFoot;
		this.path = buildBoardwalk( ctx( this.harbor ), [
			[ foot.x, foot.z + 0.05 ], [ 54.6, - 72 ], [ 52.4, - 82 ], [ 48.4, - 92 ], [ 44.8, - 100.5 ], [ 42.6, - 107.2 ],
		], { width: 1.8, startY: foot.y + 0.24, lightEvery: 70 } );
		buildPlaza( this, ctx( this.town ) );

		for ( const s of specs.houses ) {

			const B = s.harbor ? this.harbor : this.town;
			const res = buildHouse( ctx( B ), s );
			if ( res.interior ) {

				furnishRoom( ctx( B ), res.interior, s.layout || 'house' );
				if ( res.interior.upstairs ) furnishRoom( ctx( B ), res.interior.upstairs, 'bedroom' );
				// a house with a lit hearth inside smokes
				if ( res.chimneyTop && [ 'house', 'cabin' ].includes( s.layout || 'house' ) ) this.chimneys.push( res.chimneyTop );

			}
			this.buildings.push( { name: s.name, x: s.x, z: s.z, floorY: res.floorY, roofTop: res.roofTop, stilts: s.foundation === 'stilts', footprint: res.footprint } );
			this.footprints.push( res.footprint );

		}

		for ( const s of specs.sheds ) {

			const res = buildShed( ctx( this.town ), s );
			this.buildings.push( { name: s.name, x: s.x, z: s.z, floorY: res.floorY, roofTop: res.roofTop, stilts: false, footprint: res.footprint } );
			this.footprints.push( res.footprint );

		}

		this.sidePaths = []; // the plank side paths led to houses that are no longer built

		this.footprints.push( buildBoathouse( ctx( this.harbor ), specs.boathouse ).footprint );

		buildBeachProps( this, ctx( this.harbor ) );
		buildVillageProps( this, ctx( this.town ) );
		buildLandmarks( this, ctx( this.harbor ) );
		buildTrailSteps( this, ctx( this.town ) );
		if ( HIDDEN_HOME.F !== undefined ) {

			this.hiddenHome = buildHiddenHome( ctx( this.town ) );
			if ( this.hiddenHome.chimneyTop ) this.chimneys.push( this.hiddenHome.chimneyTop );
			this.footprints.push( { x: HIDDEN_HOME.x, z: HIDDEN_HOME.z, r: 5.2, kind: 'building' } );

		}

		this._assemble();
		this._buildSign();
		buildDoorMeshes( this.doors, this.materials, this.group );
		this._buildLanterns();
		scene.add( this.group );

	}

	// ------------------------------------------------------------------ layout

	_layout() {

		const P = PASTELS, T = TRIMS, R = ROOFS;
		const houses = [
			// the two-storey house with the stone chimney above the plaza (enterable)
			{ name: 'L', interior: true, upstairs: true, layout: 'house', foundation: 'stone', stoneStyle: 0, curtain: CURTAINS[ 3 ], ...PLACES.house, w: 7.4, d: 5.6, stories: 2, roof: 'hip', roofMat: 'metal', roofColor: R.red, wall: P.white, trim: T.white, accent: T.green, siding: 1, porch: { depth: 2.3, rail: 'balusters' }, paint: 0.78, antenna: true, chimney: 1, doorGlass: true },
			// a small timber cabin near the top of the mountain, its porch looking south over the bay (enterable)
			{ name: 'C1', interior: true, layout: 'cabin', foundation: 'stone', stoneStyle: 1, curtain: CURTAINS[ 1 ], ...PLACES.cabin, w: 4.6, d: 4.0, roof: 'gable', roofMat: 'metal', roofColor: R.green, rust: 0.35, wall: lin( 0x8a6a4a ), trim: T.cream, accent: T.red, siding: 2, porch: { depth: 1.5, rail: 'x' }, paint: 0.4, weather: 0.8, shutters: 'board', fewWindows: true, chimney: 1, porchBench: true },
			// beach huts on the long west and east beaches (floor ~1.6 m above the sand on stilts, enterable)
			{ name: 'W1', interior: true, layout: 'hut', harbor: true, ...PLACES.hutW, w: 4.4, d: 4.2, floorY: 4.4, foundation: 'stilts', roof: 'gableFront', roofMat: 'thatch', thatchAge: 0.4, wall: P.turquoise, trim: T.white, accent: T.yellow, siding: 2, paint: 0.55, weather: 0.75, porch: { depth: 1.8, rail: 'x' }, shutters: 'board', fewWindows: true, rimRaw: true, buoys: 1, porchBench: true, curtain: CURTAINS[ 0 ] },
			{ name: 'E1', interior: true, layout: 'hut', harbor: true, ...PLACES.hutE, w: 4.0, d: 4.0, floorY: 4.4, foundation: 'stilts', roof: 'gable', roofMat: 'metal', roofColor: R.red, rust: 0.4, wall: P.yellow, trim: T.white, accent: T.blue, siding: 2, paint: 0.6, weather: 0.7, porch: { depth: 1.6, rail: 'x' }, shutters: 'board', fewWindows: true, rimRaw: true, porchBench: true, curtain: CURTAINS[ 1 ] },
		];

		const sheds = [
			{ name: 'shed4', x: 43.5, z: - 155.5, yaw: 0.0, wall: lin( 0xe8d8a8 ), door: TRIMS.blue },
		];

		return {
			houses,
			sheds,
			boathouse: { x: 92.5, z: - 57.5, yaw: - 0.08, wall: lin( 0x8fb3a8 ), paint: 0.58 },
		};

	}

	// carve gentle building pads into the heightmap (must happen before anything reads heights)
	_flattenPads( specs ) {

		const t = this.terrain;
		if ( typeof t.flatten !== 'function' ) return;
		for ( const s of specs.houses ) {

			if ( s.foundation === 'stilts' ) continue;
			const pd = s.porch ? s.porch.depth : 1.0;
			const cy = Math.cos( s.yaw ), sy = Math.sin( s.yaw );
			const cz = pd / 2;
			const cx = s.x + cz * sy, czw = s.z + cz * cy;
			let sum = 0, n = 0;
			for ( let i = - 2; i <= 2; i ++ ) for ( let j = - 2; j <= 2; j ++ ) {

				sum += t.heightAt( cx + i * s.w / 5, czw + j * ( s.d + pd ) / 5 );
				n ++;

			}

			const r = Math.hypot( s.w, s.d + pd ) / 2 + 0.3;
			t.flatten( cx, czw, r, sum / n, 3.5 );

		}

		// market plaza
		{

			const px = 41.5, pz = - 111.0;
			let sum = 0, n = 0;
			for ( let i = - 2; i <= 2; i ++ ) for ( let j = - 2; j <= 2; j ++ ) {

				sum += t.heightAt( px + i, pz + j );
				n ++;

			}

			t.flatten( px, pz, 5.5, sum / n, 4 );

		}

		// the hidden home dug into the mountain (village/HiddenHome.js)
		if ( typeof t.carveRect === 'function' ) carveHiddenHome( t );

		if ( typeof t.buildMinMax === 'function' ) t.buildMinMax();

	}

	// ------------------------------------------------------------------ meshes

	_assemble() {

		const B = this.B;
		const mats = this.materials;
		const take = ( key ) => {

			const b = B.batches[ key ];
			delete B.batches[ key ];
			return b;

		};

		// fold small emitter keys into bigger materials (fewer draw calls):
		//   glass -> wood (pattern 9), rope -> hard (vdata.w = 2 + radius), cloth / net / flag -> fabric
		const wood = B.batch( 'wood' ), hard = B.batch( 'hard' ), fabric = B.batch( 'fabric' );
		const glass = take( 'glass' ), rope = take( 'rope' ), cloth = take( 'cloth' ), net = take( 'net' ), flag = take( 'flag' );
		if ( glass ) wood.append( glass, ( d ) => [ d[ 0 ], d[ 1 ], 9, d[ 2 ] ] );
		if ( rope ) hard.append( rope, ( d ) => [ d[ 0 ], 0, 0, 2 + d[ 1 ] ] );
		if ( cloth ) fabric.append( cloth, ( d ) => [ d[ 0 ], d[ 1 ], 0, 0 ] );
		// nets get their own blended material (see createNetMaterial)
		const nets = new Batch();
		if ( net ) nets.append( net, ( d ) => [ d[ 0 ], d[ 1 ], Math.max( 0.02, d[ 2 ] ), 0 ] );
		if ( flag ) fabric.append( flag, ( d ) => [ d[ 0 ], d[ 1 ], d[ 2 ] + 10000, d[ 3 ] ] );

		// All opaque geometry lives in ONE set of vertex / index buffers. Each opaque material
		// draws its own index range; the wood mesh is the only shadow caster and widens its
		// range to cover everything during the shadow passes (1 shadow draw per cascade).
		const opaque = new Batch();
		const ranges = {};
		for ( const key of [ 'wood', 'hard', 'roofMetal', 'thatch', 'stone' ] ) {

			const b = B.batches[ key ];
			if ( ! b || b.vcount === 0 ) continue;
			const start = opaque.idx.length;
			opaque.append( b );
			ranges[ key ] = { start, count: opaque.idx.length - start };

		}

		const shared = opaque.build();
		const total = shared.index.count;
		this.meshes = [];
		for ( const key in ranges ) {

			const geo = new BufferGeometry();
			for ( const name in shared.attributes ) geo.setAttribute( name, shared.attributes[ name ] );
			geo.setIndex( shared.index );
			geo.boundingBox = shared.boundingBox;
			geo.boundingSphere = shared.boundingSphere;
			const r = ranges[ key ];
			geo.setDrawRange( r.start, r.count );
			const mesh = new Mesh( geo, mats[ key ] );
			mesh.name = 'village_' + key;
			mesh.receiveShadow = true;
			mesh.castShadow = key === 'wood';
			if ( key === 'wood' ) {

				// the engine has no onBeforeShadow / onAfterShadow: onBeforeRender runs per pass
				// (before the draw list is built) with that pass's camera; the sun shadow cascade
				// cameras (render/Shadows.js) are flagged isShadowCamera (and use standard depth)
				const range = geo.drawRange;
				mesh.onBeforeRender = ( renderer, scene, camera ) => {

					this.textures.bake();
					const shadow = !! camera && ( camera.isShadowCamera === true || camera.reversedDepth === false );
					range.start = shadow ? 0 : r.start;
					range.count = shadow ? total : r.count;

				};

			}

			this.meshes.push( mesh );

		}

		this.shadowTriangles = total / 3;

		if ( fabric.vcount > 0 ) {

			const mesh = new Mesh( fabric.build(), mats.fabric );
			mesh.name = 'village_fabric';
			mesh.receiveShadow = true;
			mesh.castShadow = false;
			this.meshes.push( mesh );

		}

		if ( nets.vcount > 0 ) {

			const mesh = new Mesh( nets.build(), mats.net );
			mesh.name = 'village_nets';
			mesh.receiveShadow = true;
			mesh.castShadow = false;
			this.meshes.push( mesh );

		}

		// fish, lobsters, ice and banana leaves (market stall, drying racks, cleaning tables): one
		// instanced mesh with the fish material (fish/FishProps.js)
		if ( B.fishProps ) this.group.add( B.fishProps.build() );

		// the texture bake is recorded by whichever village mesh is drawn first in a frame
		// (the TSL version's VillageBakeNode.updateBefore); bake() is a no-op afterwards
		const bake = () => this.textures.bake();
		for ( const mesh of this.meshes ) if ( ! mesh.onBeforeRender ) mesh.onBeforeRender = bake;

		for ( const mesh of this.meshes ) {

			// never culled: all pipelines compile during the app's loading-screen precompile and
			// the texture bake runs on the first frame
			mesh.frustumCulled = false;
			mesh.matrixAutoUpdate = false;
			mesh.updateMatrix();
			this.group.add( mesh );

		}

		// release the CPU-side builders
		this.B = this.harbor = this.town = null;
		this.inst = null;

	}

	// The painted fish sign hangs from the arch beam on two short chains: a pendulum about the
	// chain tops (info.signPivot), same materials as the rest of the village (no new pipelines).
	_buildSign() {

		const S = this.signB, pivot = this.pierInfo.signPivot;
		this.signB = null;
		if ( ! S || ! pivot ) return;
		this.sign = new Group();
		this.sign.name = 'village_sign';
		this.sign.position.copy( pivot );
		this.sign.rotation.order = 'YXZ';
		for ( const key of [ 'wood', 'hard' ] ) {

			const b = S.batches[ key ];
			if ( ! b || b.vcount === 0 ) continue;
			const geo = b.build();
			geo.translate( - pivot.x, - pivot.y, - pivot.z );
			const mesh = new Mesh( geo, this.materials[ key ] );
			mesh.name = 'village_sign_' + key;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.sign.add( mesh );

		}

		this.group.add( this.sign );
		this._swing = { t: 0, a: 0, av: 0, b: 0, bv: 0 };

	}

	// The pier's lanterns hang from their lamp-post arms (and the arch beam) on short chains: small
	// pendulums about the top of the chain, pushed by the wind with gusts. Same materials as the rest
	// of the village (no new pipelines); the light positions follow the lanterns.
	_buildLanterns() {

		const hung = this.pierInfo.hung || [];
		this.lanterns = [];
		const mats = this.materials;
		for ( const h of hung ) {

			const S = h.B;
			h.B = null;
			const g = new Group();
			g.name = 'village_lantern';
			g.position.copy( h.pivot );
			const glass = S.batches.glass;
			delete S.batches.glass;
			if ( glass ) S.batch( 'wood' ).append( glass, ( d ) => [ d[ 0 ], d[ 1 ], 9, d[ 2 ] ] );
			for ( const key of [ 'wood', 'hard' ] ) {

				const b = S.batches[ key ];
				if ( ! b || b.vcount === 0 ) continue;
				const geo = b.build();
				geo.translate( - h.pivot.x, - h.pivot.y, - h.pivot.z );
				geo.computeBoundingSphere();
				const mesh = new Mesh( geo, mats[ key ] );
				mesh.name = 'village_lantern_' + key;
				mesh.castShadow = false;
				mesh.receiveShadow = true;
				g.add( mesh );

			}

			this.group.add( g );
			this.lanterns.push( { obj: g, pivot: h.pivot, rest: h.rest, live: h.live, t: Math.random() * 50, ph: Math.random() * 6.28, x: 0, z: 0, vx: 0, vz: 0 } );

		}

	}

	_updateLanterns( dt ) {

		if ( ! this.lanterns || ! this.lanterns.length ) return;
		const v = G.windSpeed.value, wx = G.windDir.value.x, wz = G.windDir.value.y;
		const n = Math.max( 1, Math.ceil( Math.min( dt, 0.1 ) / ( 1 / 120 ) ) ), h = Math.min( dt, 0.1 ) / n;
		const W = 5.4, Z = 0.05; // rad/s (0.34 m pendulum), damping ratio
		for ( const l of this.lanterns ) {

			for ( let i = 0; i < n; i ++ ) {

				const t = l.t += h, p = l.ph;
				const gust = 1 + 0.4 * Math.sin( t * 0.73 + p ) * Math.sin( t * 0.31 + p * 0.5 ) + 0.25 * Math.sin( t * 2.3 + Math.sin( t * 0.9 + p ) * 1.5 );
				// lean the wind holds (tan ~ drag / weight, ~3 degrees at 7 m/s) plus buffeting
				const px = 0.0011 * v * v * gust * wx + 0.0012 * v * Math.sin( t * 1.9 + p + Math.sin( t * 0.53 ) * 2 );
				const pz = 0.0011 * v * v * gust * wz + 0.0012 * v * Math.sin( t * 1.6 + p * 1.7 + Math.sin( t * 0.41 ) * 2 );
				l.vx += ( W * W * ( px - l.x ) - 2 * Z * W * l.vx ) * h;
				l.x += l.vx * h;
				l.vz += ( W * W * ( pz - l.z ) - 2 * Z * W * l.vz ) * h;
				l.z += l.vz * h;

			}

			// bottom toward +x: +rotation about z; toward +z: -rotation about x
			l.obj.rotation.set( l.z, 0, - l.x );
			_lanternEuler.set( l.z, 0, - l.x );
			l.live.copy( l.rest ).sub( l.pivot ).applyEuler( _lanternEuler ).add( l.pivot );

		}

	}

	update( dt = 1 / 60 ) {

		this._updateLanterns( dt );
		updateDoors( this.doors, dt );

		// all other animation (flags, nets, laundry, lantern flicker) runs on the GPU from G.time / G.windDir / G.night
		const s = this._swing;
		if ( ! s ) return;
		// damped pendulum driven by the wind's push on the board (drag ~ v^2 on the face-on part of the
		// wind, with gusts), and a stiffer, smaller twist on the two chains
		const v = G.windSpeed.value, wx = G.windDir.value.x, wz = G.windDir.value.y;
		const n = Math.max( 1, Math.ceil( Math.min( dt, 0.1 ) / ( 1 / 120 ) ) ), h = Math.min( dt, 0.1 ) / n;
		const W = 4.9, WT = 10.5; // rad/s: swing (0.4 m to the board's centre) and twist (bifilar chains)
		for ( let i = 0; i < n; i ++ ) {

			const t = s.t += h;
			const gust = 1 + 0.35 * Math.sin( t * 0.73 + 1.3 ) * Math.sin( t * 0.31 ) + 0.22 * Math.sin( t * 2.1 + Math.sin( t * 0.9 ) ) + 0.1 * Math.sin( t * 5.3 + 2.0 );
			// tan of the lean the wind holds the board at (~9 degrees face-on at 7 m/s), plus turbulence
			// that keeps it moving when the wind is along the board
			const push = - 0.0033 * v * v * gust * wz * Math.abs( wz ) - 0.0009 * v * Math.sin( t * 1.7 + Math.sin( t * 0.43 ) * 2 );
			s.av += ( W * W * ( push * Math.cos( s.a ) - Math.sin( s.a ) ) - 2 * 0.07 * W * s.av ) * h;
			s.a += s.av * h;
			const twist = 0.004 * v * v * wx * wz * gust + 0.0015 * v * Math.sin( t * 2.9 + 1.1 );
			s.bv += ( WT * WT * ( twist - s.b ) - 2 * 0.12 * WT * s.bv ) * h;
			s.b += s.bv * h;

		}

		this.sign.rotation.set( s.a, s.b, 0 );

	}

	// 0..1: how far inside a room (x, y, z) is (1 well inside, fading over the last 0.4 m and the doorway)
	indoorAt( x, y, z ) {

		let best = 0;
		for ( const r of this.interiors ) {

			if ( y < r.floorY - 0.5 || y > r.ceilY + 0.3 ) continue;
			const c = Math.cos( r.yaw ), s = Math.sin( r.yaw );
			const dx = x - r.x, dz = z - r.z;
			const lx = dx * c - dz * s, lz = dx * s + dz * c;
			const ex = r.hx - Math.abs( lx ), ez = r.hz - Math.abs( lz );
			if ( ex < 0 || ez < 0 ) continue;
			best = Math.max( best, Math.min( 1, Math.min( ex, ez ) / 0.4 ) );

		}

		return best;

	}

	getLightSources() {

		return this.lights;

	}

	// circles { x, z, r } covered by buildings / big props (useful to keep vegetation out)
	getFootprints() {

		return this.footprints;

	}

	getStats() {

		let triangles = 0, drawCalls = 0;
		for ( const m of this.meshes ) {

			const total = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
			triangles += Math.min( total, m.geometry.drawRange.count ) / 3;
			drawCalls ++;

		}

		const shadowCasters = this.meshes.filter( ( m ) => m.castShadow ).length;
		return { triangles, drawCalls, shadowCasters, shadowTriangles: this.shadowTriangles, lights: this.lights.length, textureMB: this.textures.bytes / 1048576, bakeMs: this.textures.bakeMs, baked: this.textures.baked };

	}

	dispose() {

		for ( const m of this.meshes ) m.geometry.dispose();
		for ( const k in this.materials ) this.materials[ k ].dispose();
		this.textures.dispose();
		this.scene.remove( this.group );

	}

}

