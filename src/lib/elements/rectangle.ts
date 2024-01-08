import { nanoid } from "nanoid";

import { getLibraryStoreValue, updateLibraryStoreValue } from "$stores/libraryStore";
import { showModalNameEdit, showModalRectangleSettings } from "$stores/modalStore";
import { getProjectStoreValue, projectStore } from "$stores/projectStore";
import type { RectangleData } from "$types/RectangleData";

export const addNewRectangle = async (source?: Omit<RectangleData, 'konvaConfig'>) => {
    const project = getProjectStoreValue();
    const rectangle: RectangleData = {
        depth: source?.depth || 5,

        id: nanoid(),
        x: project.panelSettings.width / 2,
        y: project.panelSettings.height / 2,
        width: source?.width || 10,
        height: source?.height || 5,

        fill: 'green',
        draggable: true,
        opacity: 0.75,
    };
    project.rectangles.push(rectangle);
    updateRectangleChanges(project.rectangles);

    if (!source) {
        const { confirmed, settings } = await showModalRectangleSettings(rectangle);
        if (confirmed) {
            rectangle.width = settings.width;
            rectangle.height = settings.height;
            rectangle.depth = settings.depth;
            updateRectangleChanges();
        }
    }
};
export const duplicateRectangle = (source: RectangleData) => addNewRectangle(source);
export const rotateRectangle = (rectangle: RectangleData) => {
    const oldWidth = rectangle.width;
    rectangle.width = rectangle.height;
    rectangle.height = oldWidth;
    updateRectangleChanges();
};
export const addRectangleToLibrary = async (source: RectangleData) => {
    const { confirmed, name } = await showModalNameEdit('rectangle');
    if (confirmed) {
        const library = getLibraryStoreValue();
        library.push({
            name,
            type: 'rectangle',
            width: source.width,
            height: source.height,
            depth: source.depth
        });
        updateLibraryStoreValue(library);
    }
};
export const modifyRectangle = async (rectangle: RectangleData) => {
    const { confirmed, settings } = await showModalRectangleSettings(rectangle);
    if (confirmed) {
        rectangle.width = settings.width;
        rectangle.height = settings.height;
        rectangle.depth = settings.depth;
        updateRectangleChanges();
    }
};
export const updateRectangleChanges = (rectangles?: RectangleData[]) =>
    projectStore.update((value) => {
        if (rectangles)
            value.rectangles = rectangles;
        return value;
    });
