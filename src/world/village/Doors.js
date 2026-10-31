import { Group, Mesh } from '../../engine/index.js';
import { Builder } from './GeoBuilder.js';

// Hinged doors (the interiors' front doors). makeDoor() returns a record whose builder (D.B) takes
// the leaf's geometry in door-local space: the hinge at the origin, the leaf along +x, facing +z.
// buildDoorMeshes() turns the builders into meshes in the village materials, updateDoors() swings
// them toward their target (yaw + angle about the hinge). spec.blocker (a collider) is solid while
// the door is shut, so it never pushes you out of the doorway while swinging.

export function makeDoor( spec ) {

	const D = {
		B: new Builder(), hinge: spec.hinge, yaw: spec.yaw, openAngle: spec.openAngle ?? 1.6,
		blocker: spec.blocker || null, target: spec.open ? 1 : 0, t: spec.open ? 1 : 0, group: null,
		onToggle: null, // ( opening ) for sound
		toggle() {

			this.target = this.target > 0.5 ? 0 : 1;
			if ( this.onToggle ) this.onToggle( this.target > 0.5, this );

		},
	};
	if ( D.blocker ) D.blocker.solid = D.t < 0.5;
	return D;

}

export function buildDoorMeshes( doors, materials, parent ) {

	for ( const D of doors ) {

		const g = new Group();
		g.name = 'village_door';
		g.position.copy( D.hinge );
		for ( const key of [ 'wood', 'hard' ] ) {

			const b = D.B.batches[ key ];
			if ( ! b || b.vcount === 0 ) continue;
			const mesh = new Mesh( b.build(), materials[ key ] );
			mesh.name = 'village_door_' + key;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			g.add( mesh );

		}

		D.B = null;
		D.group = g;
		g.rotation.y = D.yaw + D.openAngle * D.t;
		parent.add( g );

	}

}

export function updateDoors( doors, dt ) {

	for ( const D of doors ) {

		if ( D.t === D.target ) continue;
		const step = dt / 0.7;
		D.t = D.target > D.t ? Math.min( D.target, D.t + step ) : Math.max( D.target, D.t - step );
		const e = D.t * D.t * ( 3 - 2 * D.t );
		if ( D.group ) D.group.rotation.y = D.yaw + D.openAngle * e;
		if ( D.blocker ) D.blocker.solid = D.t < 0.15;

	}

}
