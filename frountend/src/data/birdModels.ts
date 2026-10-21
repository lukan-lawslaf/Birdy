import models from "./birdModels.json";

export const BIRD_MODELS = models;
export const SKETCHFAB_BY_SPECIES = new Map(models.map((model) => [model.scientificName, model]));
