// Plain-node checks of the world (no GPU): the island's shape, the hidden home, the village interiors
// (rooms, doors, things to use, fires) and the movement input. Run: node test/world-logic.mjs
// The village builds its materials up front, so a do-nothing WebGPU device stands in for the real one.
import { globals } from 'webgpu';
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
const { HIDDEN_HOME } = await import( '../src/world/village/HiddenHome.js' );
const { PLACES } = await import( '../src/world/Places.js' );
const { Input } = await import( '../src/core/Input.js' );
const { updateDoors } = await import( '../src/world/village/Doors.js' );

let failed = 0, passed = 0;
const check = ( name, ok, detail = '' ) => {

	if ( ok ) passed ++;
	else {

		failed ++;
		console.log( 'FAIL', name, detail );

	}

};

// ---------------------------------------------------------------- island shape
const t0 = performance.now();
const terrain = new TerrainData();
const colliders = new Colliders();
const village = new Village( { scene: { add() {} }, terrain, colliders } );
console.log( `terrain + village built in ${ ( ( performance.now() - t0 ) / 1000 ).toFixed( 1 ) } s` );
const h = ( x, z ) => terrain.heightAt( x, z );

check( 'open sea west of the island', h( - 360, - 300 ) < - 1.5, h( - 360, - 300 ).toFixed( 2 ) );
check( 'open sea east of the island', h( 320, - 300 ) < - 1.5, h( 320, - 300 ).toFixed( 2 ) );
check( 'no west headland', h( - 272, - 25 ) < 0, h( - 272, - 25 ).toFixed( 2 ) );
check( 'no east headland', h( 288, - 12 ) < 0, h( 288, - 12 ).toFixed( 2 ) );
for ( const z of [ - 400, - 300, - 200 ] ) {

	// the long beaches: low sand shelves running down to the water, no wall of rock
	const w = [ - 300, - 280, - 260, - 240 ].map( ( x ) => h( x, z ) );
	check( `west beach is a gentle shelf at z ${ z }`, w.every( ( v, i ) => v < 8 && ( i === 0 || v >= w[ i - 1 ] - 0.3 ) ), w.map( ( v ) => v.toFixed( 1 ) ).join( ' ' ) );

}

check( 'no stray rock tower on the west beach', h( - 224, - 460 ) < 8, h( - 224, - 460 ).toFixed( 2 ) );
check( 'the plaza and the bay beach are still land', h( 41.5, - 111 ) > 2 && h( 20, - 60 ) > 0 && h( 20, - 60 ) < 3, `${ h( 41.5, - 111 ).toFixed( 2 ) } ${ h( 20, - 60 ).toFixed( 2 ) }` );

// ---------------------------------------------------------------- hidden home
{

	const { x, z, yaw, F } = HIDDEN_HOME;
	check( 'hidden home was carved', Number.isFinite( F ) );
	const c = Math.cos( yaw ), s = Math.sin( yaw );
	const at = ( lx, lz ) => h( x + lx * c + lz * s, z - lx * s + lz * c );
	let flat = true;
	for ( const [ lx, lz ] of [ [ 0, 0 ], [ - 2.5, - 2 ], [ 2.5, 2 ], [ 2.8, - 2.2 ], [ - 2.8, 2.2 ] ] ) flat = flat && Math.abs( at( lx, lz ) - ( F - 0.04 ) ) < 0.06;
	check( 'hidden home floor is flat (no ground poking through)', flat );
	check( 'hidden home is dug into the slope', at( 0, - 4.5 ) - F > 2.5, ( at( 0, - 4.5 ) - F ).toFixed( 2 ) );
	check( 'hidden home is in the shared places list', PLACES.hiddenHome === HIDDEN_HOME );
	check( 'hidden home has a smoking chimney and a fire', village.hiddenHome && village.hiddenHome.chimneyTop && village.hiddenHome.fire );

}

// ---------------------------------------------------------------- village interiors
{

	check( 'five rooms (hidden home, house, mountain cabin, two beach huts)', village.interiors.length === 5, village.interiors.length );
	for ( const r of village.interiors ) {

		check( `room at ${ r.x.toFixed( 0 ) },${ r.z.toFixed( 0 ) }: floor above the ground`, r.floorY > h( r.x, r.z ) - 0.1, `${ r.floorY.toFixed( 2 ) } vs ${ h( r.x, r.z ).toFixed( 2 ) }` );
		check( `room at ${ r.x.toFixed( 0 ) },${ r.z.toFixed( 0 ) }: head room`, r.ceilY - r.floorY > 2.3 );
		check( `room at ${ r.x.toFixed( 0 ) },${ r.z.toFixed( 0 ) }: indoor in the middle`, village.indoorAt( r.x, r.floorY + 1.6, r.z ) === 1 );
		const g = colliders.groundHeightAt( r.x + 0.3, r.z + 0.3, r.floorY + 0.5 );
		check( `room at ${ r.x.toFixed( 0 ) },${ r.z.toFixed( 0 ) }: walkable floor`, Math.abs( g - r.floorY ) < 0.12, `${ g.toFixed( 2 ) } vs ${ r.floorY.toFixed( 2 ) }` );

	}

	check( 'outside is not indoor', village.indoorAt( PLACES.house.x, 8, PLACES.house.z + 9 ) === 0 );
	check( 'three fireplaces', village.fires.length === 3, village.fires.length );
	check( 'three smoking chimneys', village.chimneys.length === 3, village.chimneys.length );
	const texts = village.interactables.map( ( it ) => typeof it.text === 'function' ? it.text() : it.text );
	check( 'a bed to sleep in in every room', texts.filter( ( s ) => s === 'Sleep until morning' ).length === 5 );
	check( 'seats to sit on', texts.filter( ( s ) => s === 'Sit down' ).length >= 8 );
	check( 'a door to every room', village.doors.length === 5 && texts.filter( ( s ) => /door/.test( s ) ).length === 5 );
	{

		const c = village.interiors.find( ( r ) => Math.hypot( r.x - PLACES.cabin.x, r.z - PLACES.cabin.z ) < 1 );
		check( 'the mountain cabin stands near the top', c && c.floorY > 170, c && c.floorY.toFixed( 1 ) );

	}

	// a door blocks the doorway only while shut
	const D = village.doors[ 0 ];
	check( 'doors start open (not blocking)', D.t === 1 && D.blocker && D.blocker.solid === false );
	D.toggle();
	for ( let i = 0; i < 60; i ++ ) updateDoors( village.doors, 1 / 30 );
	check( 'a shut door blocks the doorway', D.t === 0 && D.blocker.solid === true );
	D.toggle();
	for ( let i = 0; i < 60; i ++ ) updateDoors( village.doors, 1 / 30 );
	check( 'an opened door clears it again', D.t === 1 && D.blocker.solid === false );

	// every thing to use stands inside or by a room, at floor level
	check( 'interactions sit near a room', village.interactables.every( ( it ) => village.interiors.some( ( r ) => Math.hypot( it.pos.x - r.x, it.pos.z - r.z ) < Math.hypot( r.hx, r.hz ) + 1.5 && it.pos.y > r.floorY - 0.5 && it.pos.y < r.ceilY ) ) );

}

// ---------------------------------------------------------------- movement input (keys + touch stick)
{

	const inp = new Input( { addEventListener() {} } );
	inp.keys.add( 'KeyW' );
	inp.keys.add( 'KeyD' );
	let m = inp.move();
	check( 'diagonal keys move at full speed, not faster', Math.abs( Math.hypot( m.x, m.y ) - 1 ) < 1e-6 );
	inp.keys.clear();
	inp.stick.x = 0;
	inp.stick.y = 0.5;
	m = inp.move();
	check( 'half a stick push walks at half speed', Math.abs( m.y - 0.5 ) < 1e-6 && m.x === 0 );
	inp.stick.x = 1;
	inp.stick.y = 1;
	m = inp.move();
	check( 'the stick is clamped to full speed', Math.abs( Math.hypot( m.x, m.y ) - 1 ) < 1e-6 );
	inp.lookScale = 2;
	inp.look.x = 10;
	check( 'look speed scales the view', inp.consumeLook().x === 20 );

}

console.log( `${ passed } passed, ${ failed } failed` );
process.exit( failed ? 1 : 0 );
