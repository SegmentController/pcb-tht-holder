/**
 * Three.js mesh output types for 3D holder generation
 *
 * These types represent the processed mesh data returned from the CSG (Constructive
 * Solid Geometry) operations in `generateMeshLazy()`. Each mesh is stored as a
 * flat Float32Array of vertices that can be:
 * - Rendered in the 3D preview using @threlte/core
 * - Exported to STL format for 3D printing
 *
 * @remarks
 * **Vertex Array Format:**
 * The vertexArray is a flat array of vertex coordinates in groups of 9 values per triangle:
 * `[x1, y1, z1, x2, y2, z2, x3, y3, z3, ...]`
 *
 * Three.js BufferGeometry stores positions as flat Float32Array for performance,
 * avoiding object allocation overhead.
 */

/**
 * Physical dimensions of a generated 3D mesh in millimeters
 *
 * Represents the bounding box of the mesh, used for:
 * - Calculating STL file metadata
 * - Positioning meshes in the 3D scene
 * - Displaying size information to the user
 */
export type MeshDimensionInfo = {
	/** Width (X-axis) in millimeters */
	width: number;
	/** Height (Y-axis) in millimeters */
	height: number;
	/** Depth (Z-axis) in millimeters */
	depth: number;
};

/**
 * Single mesh with its vertex data and dimensional metadata
 *
 * Combines the raw vertex array (for rendering/export) with dimensional information
 * (for UI display and positioning).
 */
export type MeshInfo = {
	/**
	 * Flat array of vertex coordinates from Three.js BufferGeometry
	 * Format: [x1, y1, z1, x2, y2, z2, x3, y3, z3, ...] for each triangle
	 */
	vertexArray: Float32Array;

	/** Physical dimensions of the mesh bounding box */
	dimensions: MeshDimensionInfo;
};

/**
 * Complete set of generated meshes for a PCB holder
 *
 * Contains three mesh variants generated from a single project:
 *
 * - **main**: Full-depth holder - Uses the maximum component depth for full coverage
 * - **hollow**: Shallow holder - Only covers the top layer (SMD height), saves material
 * - **positive**: PCB visualization - Inverted design showing components as pillars
 *
 * @remarks
 * **Mesh Variants Explained:**
 *
 * 1. **Main Mesh** (default):
 *    - Full depth coverage based on tallest component
 *    - Best for components of varying heights
 *    - More material usage, stronger structure
 *
 * 2. **Hollow Mesh** (material-saving option):
 *    - Only covers PCB + SMD height
 *    - Faster printing, less material cost
 *    - Suitable when all THT components have similar depths
 *
 * 3. **Positive Mesh** (visualization/optional):
 *    - Shows components as pillars on a thin base
 *    - Useful for visualizing component placement
 *    - Can be printed separately as a PCB mockup
 *    - Optional field (may be undefined)
 */
export type MeshInfoTuple = { main: MeshInfo; hollow: MeshInfo; positive?: MeshInfo };
