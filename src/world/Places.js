import { HIDDEN_HOME } from './village/HiddenHome.js';

// Where the places you can visit are: one list for the village builder (Village.js) and the minimap.
// x, z in metres (world), yaw as the village builder uses it (local +z faces (sin yaw, cos yaw)).
export const PLACES = {
	house: { x: 30.5, z: - 149.0, yaw: 0.04 }, // the two-storey house above the plaza
	lookout: { x: 4, z: - 318, yaw: 0.15 }, // timber platform at the end of the hiking trail
	hutW: { x: - 236, z: - 196, yaw: - Math.PI / 2 + 0.1 }, // beach hut on the long west beach
	hutE: { x: 226, z: - 172, yaw: Math.PI / 2 - 0.12 }, // beach hut on the long east beach
	jetty: { x0: 262, x1: 326, z: - 200 }, // off the east beach
	hiddenHome: HIDDEN_HOME, // dug into the west flank (village/HiddenHome.js)
};
