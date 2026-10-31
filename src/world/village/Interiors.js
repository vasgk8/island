import { lin } from '../Props.js';
import { furnitureKit } from './Furniture.js';

// Furnishing for the enterable houses (Buildings.js buildHouse with s.interior): `room` is what
// buildHouse returns ({ x, z, yaw, floorY, ceilY, hx, hz, doorX }: inner half sizes, the door on the
// +z wall). Layouts are in the room frame (x across, +z toward the door).

export function furnishRoom( ctx, room, layout ) {

	const { B } = ctx;
	const kit = furnitureKit( ctx, room.yaw );
	const { hx, hz } = room;
	const ceil = room.ceilY - room.floorY;
	B.pushAt( room.x, room.floorY, room.z, room.yaw );

	if ( layout === 'house' ) {

		// a living room with a fireplace on the chimney wall (right), a bed in the back-left corner
		kit.place( - hx + 0.72, - hz + 1.02, 0, () => kit.bed() );
		kit.place( - hx + 0.37, - hz + 2.37, 0, () => kit.sideTable() );
		kit.place( - hx + 0.42, - hz + 3.0, 0, () => kit.chest() );
		kit.place( - 0.9, - hz + 0.19, 0, () => kit.bookshelf( { len: 1.2, top: Math.min( 2.0, ceil - 0.3 ) } ) );
		kit.place( 1.25, - hz + 0.3, 0, () => kit.counter( { len: 2.0 } ) );
		kit.place( hx, 0, - Math.PI / 2, () => kit.fireplace( { w: 1.5, ceilY: ceil, breast: lin( 0xeee4d0 ) } ) );
		kit.place( - 0.4, 0.45, 0, () => kit.rug( { w: 3.0, d: 2.2, colors: [ 0x2f5f7a, 0xd8b45a, 0x8a3b2e ] } ) );
		kit.place( - 0.4, 0.45, 0, () => kit.table( { w: 1.3, d: 0.85, stools: 4 } ) );
		kit.place( hx - 1.2, hz - 0.27, Math.PI, () => kit.desk() );
		kit.hangingLantern( - 0.4, 0.45, ceil );
		kit.hangingLantern( 1.3, - hz + 1.3, ceil, 2.2 );

	} else {

		// a beach hut: single bed, a small shelf, a table for two, a chest
		kit.place( - hx + 0.53, - hz + 1.0, 0, () => kit.bed( { w: 1.0, l: 1.9, blanket: lin( 0xd8b45a ), throwTint: lin( 0x2f5f7a ) } ) );
		kit.place( - hx + 0.4, - hz + 2.35, 0, () => kit.chest() );
		kit.place( hx - 0.19, - hz + 0.7, - Math.PI / 2, () => kit.bookshelf( { len: 1.0, top: 1.5, rows: 3 } ) );
		kit.place( 0.45, 0.25, 0, () => kit.rug( { w: 1.9, d: 1.4, colors: [ 0x3f7f86, 0xf1ebdf, 0x2f5f7a ] } ) );
		kit.place( 0.55, 0.45, 0, () => kit.table( { w: 0.8, d: 0.6, stools: 2 } ) );
		kit.place( - hx, - hz + 1.0, Math.PI / 2, () => kit.painting( { w: 0.7, h: 0.5, y: 1.45, canvas: lin( 0x6aa7c0 ) } ) );
		kit.hangingLantern( 0.4, 0.1, ceil, 2.4 );

	}

	B.pop();
	if ( ctx.interior ) ctx.interior( { x: room.x, z: room.z, yaw: room.yaw, hx, hz, floorY: room.floorY, ceilY: room.ceilY } );

}
