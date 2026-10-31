// Stand-in renders of the buildings, inside and out, for reviewing layout changes without a GPU:
// the village is built in Node (a do-nothing WebGPU device stands in for the materials), the
// geometry around each place goes to a small WebGL viewer in headless Chromium (flat colours, one
// sun, the indoor lamps) and each view is written to snapshots/<name>.png. Not the game's look:
// shapes, layout, what is where. Run: node test/snapshots.mjs [outDir]   (CI uploads the folder)
import { mkdirSync, writeFileSync } from 'fs';
import { globals } from 'webgpu';
import { chromium } from 'playwright';
Object.assign( globalThis, globals );
globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.document = globalThis.document || { addEventListener() {}, pointerLockElement: null };

const { GPU } = await import( '../src/engine/gpu/GPU.js' );
const mock = () => new Proxy( function () {}, { get: ( t, k ) => k === Symbol.toPrimitive ? () => 0 : ( k === 'then' ? undefined : mock() ), apply: () => mock() } );
GPU.device = mock();
GPU.queue = mock();
GPU.limits = new Proxy( {}, { get: () => 1 << 20 } );

const { TerrainData } = await import( '../src/world/TerrainData.js' );
const { Colliders } = await import( '../src/world/Colliders.js' );
const { Village } = await import( '../src/world/Village.js' );
const { PLACES } = await import( '../src/world/Places.js' );

const out = process.argv[ 2 ] || 'snapshots';
mkdirSync( out, { recursive: true } );
const terrain = new TerrainData();
const village = new Village( { scene: { add() {} }, terrain, colliders: new Colliders() } );

// views: place (frame origin + yaw), radius of geometry to include, then [ name, eye, target, fov, cut ]
// with eye / target in the place's frame (x across, +z out of the door, y up from its floor) and cut =
// hide everything above this height (plans)
const room = ( p, up = false ) => village.interiors.filter( ( r ) => Math.hypot( r.x - p.x, r.z - p.z ) < 1.5 ).sort( ( a, b ) => up ? b.floorY - a.floorY : a.floorY - b.floorY )[ 0 ];
const H = PLACES.hiddenHome, house = room( PLACES.house ), cabin = room( PLACES.cabin );
const VIEWS = [
	{ at: { x: H.x, z: H.z, yaw: H.yaw, y: H.F }, R: 10, views: [
		[ 'hidden-home-front', [ 1.5, 2.2, 11 ], [ 0, 1.4, 0 ], 55 ],
		[ 'hidden-home-inside', [ 0.3, 1.6, 2.2 ], [ 0.4, 1.0, - 2.5 ], 75 ],
		[ 'hidden-home-plan', [ 0.2, 13, 4.5 ], [ 0, 0, 0 ], 50, 2.45 ],
	] },
	{ at: { x: house.x, z: house.z, yaw: house.yaw, y: house.floorY }, R: 9, views: [
		[ 'house-front', [ 0, 3, 13 ], [ 0, 1.5, 0 ], 55 ],
		[ 'house-ground-floor', [ 1.2, 1.6, 2.0 ], [ - 3.2, 1.2, - 0.5 ], 80 ],
		[ 'house-upstairs', [ - 1.4, 4.4, - 2.0 ], [ 1.5, 3.4, 1.0 ], 80 ],
		[ 'house-plan-ground', [ 0, 14, 4 ], [ 0, 0, 0 ], 55, 2.6 ],
		[ 'house-plan-upstairs', [ 0, 15, 4 ], [ 0, 2.7, 0 ], 55, 5.3 ],
	] },
	{ at: { x: cabin.x, z: cabin.z, yaw: cabin.yaw, y: cabin.floorY }, R: 10, views: [
		[ 'cabin-front', [ 2, 3.5, 12 ], [ 0, 1.2, 0 ], 55 ],
		[ 'cabin-inside', [ - 0.3, 1.5, 1.5 ], [ 0.5, 0.9, - 1.8 ], 80 ],
		[ 'cabin-plan', [ 0, 10, 3.5 ], [ 0, 0, 0 ], 55, 2.4 ],
	] },
	...[ [ 'hut-west', PLACES.hutW ], [ 'hut-east', PLACES.hutE ] ].map( ( [ name, p ] ) => {

		const r = room( p );
		return { at: { x: r.x, z: r.z, yaw: r.yaw, y: r.floorY }, R: 7, views: [
			[ name + '-front', [ 0, 3, 9 ], [ 0, 1.5, 0 ], 55 ],
			[ name + '-inside', [ 0.6, 1.6, 1.4 ], [ - 0.5, 0.8, - 1.8 ], 80 ],
			[ name + '-plan', [ 0, 9, 3 ], [ 0, 0, 0 ], 55, 2.4 ],
		] };

	} ),
	{ at: { x: - 24, z: - 476, yaw: 0, y: terrain.heightAt( - 24, - 476 ) }, R: 14, views: [
		[ 'cabin-trail-steps', [ - 8, 7, 12 ], [ 0, 0, - 3 ], 60 ],
	] },
];

// the village's meshes, flattened to triangles in world space (each material's draw range)
const meshes = [];
village.group.traverse( ( o ) => o.isMesh && meshes.push( o ) );
const BASE = { wood: [ 0.5, 0.36, 0.24 ], thatch: [ 0.8, 0.75, 0.5 ] };
function sceneAround( cx, cz, R ) {

	const P = [], N = [], Cl = [];
	for ( const m of meshes ) {

		m.updateMatrixWorld?.( true );
		const g = m.geometry, pos = g.attributes.position, nrm = g.attributes.normal, tint = g.attributes.tint;
		if ( ! pos ) continue;
		const key = m.name.replace( 'village_', '' ).replace( 'door_', '' ).replace( 'sign_', '' ).replace( 'lantern_', '' );
		const e = m.matrixWorld.elements, ia = g.index ? g.index.array : null;
		const n = ia ? ia.length : pos.count, r = g.drawRange || { start: 0, count: Infinity };
		const k0 = r.start || 0, k1 = Math.min( n, k0 + ( Number.isFinite( r.count ) ? r.count : n ) );
		for ( let k = k0; k + 2 < k1; k += 3 ) {

			const tri = [ 0, 1, 2 ].map( ( j ) => ia ? ia[ k + j ] : k + j );
			const ps = tri.map( ( i ) => {

				const x = pos.array[ i * 3 ], y = pos.array[ i * 3 + 1 ], z = pos.array[ i * 3 + 2 ];
				return [ e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ], e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ], e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ];

			} );
			if ( ps.some( ( p ) => Math.hypot( p[ 0 ] - cx, p[ 2 ] - cz ) > R ) ) continue;
			for ( let j = 0; j < 3; j ++ ) {

				const i = tri[ j ];
				let t = tint ? [ tint.array[ i * 3 ], tint.array[ i * 3 + 1 ], tint.array[ i * 3 + 2 ] ] : [ 1, 1, 1 ];
				if ( key === 'wood' && t.every( ( v ) => v > 0.95 ) ) t = BASE.wood;
				else if ( key === 'thatch' ) t = t.map( ( v, c ) => v * BASE.thatch[ c ] );
				P.push( ...ps[ j ] );
				N.push( nrm ? nrm.array[ i * 3 ] : 0, nrm ? nrm.array[ i * 3 + 1 ] : 1, nrm ? nrm.array[ i * 3 + 2 ] : 0 );
				Cl.push( ...t.map( ( v ) => Math.pow( Math.max( 0, v ), 1 / 2.2 ) ) );

			}

		}

	}

	// the ground around it
	const S = R / 30, h = ( x, z ) => terrain.heightAt( x, z );
	for ( let j = - 30; j < 30; j ++ ) for ( let i = - 30; i < 30; i ++ ) {

		const q = ( a, b ) => [ cx + a * S, h( cx + a * S, cz + b * S ), cz + b * S ];
		const a = q( i, j ), b = q( i + 1, j ), c = q( i, j + 1 ), d = q( i + 1, j + 1 );
		for ( const tri of [ [ a, c, b ], [ b, c, d ] ] ) {

			const u = tri[ 1 ].map( ( v, k ) => v - tri[ 0 ][ k ] ), w = tri[ 2 ].map( ( v, k ) => v - tri[ 0 ][ k ] );
			let nn = [ u[ 1 ] * w[ 2 ] - u[ 2 ] * w[ 1 ], u[ 2 ] * w[ 0 ] - u[ 0 ] * w[ 2 ], u[ 0 ] * w[ 1 ] - u[ 1 ] * w[ 0 ] ];
			const l = Math.hypot( ...nn ) || 1;
			nn = nn.map( ( v ) => v / l * Math.sign( nn[ 1 ] || 1 ) );
			const col = nn[ 1 ] > 0.8 ? [ 0.42, 0.55, 0.28 ] : [ 0.5, 0.45, 0.35 ];
			for ( const p of tri ) {

				P.push( ...p );
				N.push( ...nn );
				Cl.push( ...col.map( ( v ) => Math.pow( v, 1 / 2.2 ) ) );

			}

		}

	}

	const lights = village.lights.filter( ( l ) => Math.hypot( l.position.x - cx, l.position.z - cz ) < R ).slice( 0, 4 ).map( ( l ) => [ l.position.x, l.position.y, l.position.z ] );
	return { P, N, Cl, lights };

}

const browser = await chromium.launch( { args: [ '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist' ] } );
const page = await browser.newPage( { viewport: { width: 960, height: 600 } } );
await page.setContent( '<body style="margin:0"><canvas id=c width=960 height=600></canvas></body>' );
let shots = 0;
for ( const g of VIEWS ) {

	const sc = sceneAround( g.at.x, g.at.z, g.R );
	await page.evaluate( viewer, { sc, at: g.at } );
	for ( const [ name, eye, target, fov, cut ] of g.views ) {

		await page.evaluate( ( a ) => window.__draw( ...a ), [ eye, target, fov, cut ?? 999 ] );
		writeFileSync( `${ out }/${ name }.png`, await page.screenshot() );
		shots ++;

	}

}

await browser.close();
// a page that shows them all
const names = VIEWS.flatMap( ( g ) => g.views.map( ( v ) => v[ 0 ] ) );
writeFileSync( `${ out }/index.html`, `<!doctype html><meta charset="utf-8"><title>Building snapshots</title>
<style>body{margin:0;padding:16px;background:#111;color:#ddd;font:14px system-ui}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}
figure{margin:0}img{width:100%;border-radius:6px}figcaption{padding:4px 2px}</style>
<h1>Building snapshots</h1><p>Stand-in renders (flat colours, not the game's lighting): shapes, layout, what is where.</p>
<div>${ names.map( ( n ) => `<figure><img src="${ n }.png" alt="${ n }"><figcaption>${ n }</figcaption></figure>` ).join( '' ) }</div>` );
console.log( `${ shots } snapshots in ${ out }/` );

// ---- in the page: a minimal WebGL2 viewer (Lambert + ambient + the lamps, optional cut height)
function viewer( { sc, at } ) {

	const gl = window.__gl || ( window.__gl = document.getElementById( 'c' ).getContext( 'webgl2', { antialias: true } ) );
	const c = Math.cos( at.yaw ), s = Math.sin( at.yaw );
	const toW = ( lx, ly, lz ) => [ at.x + lx * c + lz * s, at.y + ly, at.z - lx * s + lz * c ];
	if ( ! window.__prog ) {

		const vs = `#version 300 es
		in vec3 p; in vec3 n; in vec3 col; uniform mat4 M; out vec3 vn; out vec3 vc; out vec3 vp;
		void main(){ vn = n; vc = col; vp = p; gl_Position = M * vec4( p, 1.0 ); }`;
		const fs = `#version 300 es
		precision highp float; in vec3 vn; in vec3 vc; in vec3 vp; uniform float cut; uniform float baseY; uniform vec3 lp[ 4 ]; out vec4 o;
		void main(){ if ( vp.y - baseY > cut ) discard; vec3 N = normalize( vn ); if ( ! gl_FrontFacing ) N = - N;
			float d = max( dot( N, normalize( vec3( - 0.5, 0.8, 0.3 ) ) ), 0.0 ); vec3 col = vc * ( 0.38 + 0.7 * d );
			for ( int i = 0; i < 4; i ++ ) { vec3 L = lp[ i ] - vp; float r = length( L ); col += vc * vec3( 1.0, 0.7, 0.4 ) * max( dot( N, L / r ), 0.0 ) * 0.6 / ( 1.0 + r * r * 0.25 ); }
			o = vec4( col, 1.0 ); }`;
		const sh = ( t, src ) => {

			const x = gl.createShader( t );
			gl.shaderSource( x, src );
			gl.compileShader( x );
			return x;

		};

		const pr = window.__prog = gl.createProgram();
		gl.attachShader( pr, sh( gl.VERTEX_SHADER, vs ) );
		gl.attachShader( pr, sh( gl.FRAGMENT_SHADER, fs ) );
		gl.linkProgram( pr );
		gl.useProgram( pr );

	}

	const pr = window.__prog;
	const buf = ( arr, name, size ) => {

		const b = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, b );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( arr ), gl.STATIC_DRAW );
		const loc = gl.getAttribLocation( pr, name );
		gl.enableVertexAttribArray( loc );
		gl.vertexAttribPointer( loc, size, gl.FLOAT, false, 0, 0 );

	};

	buf( sc.P, 'p', 3 );
	buf( sc.N, 'n', 3 );
	buf( sc.Cl, 'col', 3 );
	const lp = sc.lights.flat();
	while ( lp.length < 12 ) lp.push( 0, - 999, 0 );
	gl.uniform3fv( gl.getUniformLocation( pr, 'lp' ), lp );
	gl.uniform1f( gl.getUniformLocation( pr, 'baseY' ), at.y );
	const count = sc.P.length / 3;
	window.__draw = ( eye, target, fov, cut ) => {

		const E = toW( ...eye ), A = toW( ...target );
		const f = A.map( ( v, i ) => v - E[ i ] ), fl = Math.hypot( ...f );
		f.forEach( ( v, i ) => f[ i ] = v / fl );
		let r = [ - f[ 2 ], 0, f[ 0 ] ];
		const rl = Math.hypot( ...r );
		r = r.map( ( v ) => v / rl );
		const u = [ r[ 1 ] * f[ 2 ] - r[ 2 ] * f[ 1 ], r[ 2 ] * f[ 0 ] - r[ 0 ] * f[ 2 ], r[ 0 ] * f[ 1 ] - r[ 1 ] * f[ 0 ] ];
		const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
		const V = [ r[ 0 ], u[ 0 ], - f[ 0 ], 0, r[ 1 ], u[ 1 ], - f[ 1 ], 0, r[ 2 ], u[ 2 ], - f[ 2 ], 0, - dot( r, E ), - dot( u, E ), dot( f, E ), 1 ];
		const asp = 960 / 600, nn = 0.05, ff = 400, t = 1 / Math.tan( fov * Math.PI / 360 );
		const Pm = [ t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, ( ff + nn ) / ( nn - ff ), - 1, 0, 0, 2 * ff * nn / ( nn - ff ), 0 ];
		const M = new Array( 16 ).fill( 0 );
		for ( let i = 0; i < 4; i ++ ) for ( let j = 0; j < 4; j ++ ) for ( let k = 0; k < 4; k ++ ) M[ j * 4 + i ] += Pm[ k * 4 + i ] * V[ j * 4 + k ];
		gl.uniformMatrix4fv( gl.getUniformLocation( pr, 'M' ), false, M );
		gl.uniform1f( gl.getUniformLocation( pr, 'cut' ), cut );
		gl.viewport( 0, 0, 960, 600 );
		gl.clearColor( 0.6, 0.78, 0.85, 1 );
		gl.enable( gl.DEPTH_TEST );
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		gl.drawArrays( gl.TRIANGLES, 0, count );

	};

}
