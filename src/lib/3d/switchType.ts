/**
 * Type-safe pattern matching utility for class instance discrimination
 *
 * Provides a fluent API for exhaustive pattern matching based on instance types,
 * offering a more functional and type-safe alternative to traditional switch statements
 * or if-else chains when working with polymorphic objects.
 *
 * @remarks
 * This utility is particularly useful in the 3D mesh generation code where we need to
 * handle different Three.js geometry types (BoxGeometry, CylinderGeometry, TextGeometry)
 * with type-safe discrimination and transformation logic.
 *
 * **Why not use traditional switch/if-else?**
 * - Provides better type inference - TypeScript narrows the type within each case handler
 * - Chainable API makes code more readable and maintainable
 * - Eliminates the need for type assertions or type guards in every branch
 */

/**
 * Constructor type for class-based type discrimination
 * @template T The instance type that the constructor creates
 */
type Constructor<T> = new (...parameters: ReadonlyArray<never>) => T;

/**
 * Creates a pattern matching chain for type-safe instance discrimination
 *
 * @template T The union type of all possible instance types
 * @param instance The instance to match against
 * @returns A chainable object with `.case()` methods for each type branch
 */
export const switchType = <T>(instance: T) => {
	const actions = {
		/**
		 * Adds a case branch for a specific constructor type
		 *
		 * @template S The specific subtype to match (must extend T)
		 * @param Type The constructor function to match against using instanceof
		 * @param action The handler function called if instance matches Type
		 * @returns The actions object for method chaining
		 */
		case: <S extends T>(Type: Constructor<S>, action: (instance: S) => void) => {
			if (instance instanceof Type) action(instance);
			return actions;
		}
	};
	return actions;
};
