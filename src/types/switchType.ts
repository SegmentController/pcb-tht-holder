type Constructor<T> = new (...parameters: ReadonlyArray<never>) => T;

/*
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
*/

export const switchType = <T>(instance: T) => {
	const actions = {
		case: <S extends T>(Type: Constructor<S>, action: (instance: S) => void) => {
			if (instance instanceof Type) action(instance);
			return actions;
		}
	};
	return actions;
};
