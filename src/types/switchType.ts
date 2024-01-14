type ConstructorOf<T> = new (...parameters: ReadonlyArray<never>) => T;

export const switchType = <T>(shape: T) => {
	const actions = {
		case: <S extends T>(ShapeType: ConstructorOf<S>) => ({
			do: (action: (shape: S) => void) => {
				if (shape instanceof ShapeType) action(shape);
				return actions;
			}
		})
	};
	return actions;
};
