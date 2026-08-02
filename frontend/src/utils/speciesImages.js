// Every image dropped into src/assets/animals/ is picked up here automatically at build time - adding
// or replacing a species photo never requires touching this file or any component that uses it.
const imageModules = import.meta.glob("../assets/animals/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP}", {
  eager: true,
  import: "default",
});

const slugify = (value) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const SPECIES_IMAGES = {};
for (const path in imageModules) {
  const fileName = path.split("/").pop().replace(/\.[^.]+$/, "");
  SPECIES_IMAGES[slugify(fileName)] = imageModules[path];
}

// True if `word` appears as a whole hyphen-delimited segment (or the whole string) inside `slug`, e.g.
// "pangolin" matches "sunda-pangolin" but "ant" does not match "plantain-squirrel".
const matchesSlugWord = (slug, word) => slug === word || new RegExp(`(^|-)${word}(-|$)`).test(slug);

// Looks up a species' image by Common Name first, then Scientific Name, then falls back to a partial
// match (e.g. an image named "pangolin.png" still matches "Sunda Pangolin"), then a shared default image.
export function getSpeciesImage(commonName, scientificName) {
  const commonSlug = slugify(commonName);
  const scientificSlug = slugify(scientificName);

  if (SPECIES_IMAGES[commonSlug]) return SPECIES_IMAGES[commonSlug];
  if (SPECIES_IMAGES[scientificSlug]) return SPECIES_IMAGES[scientificSlug];

  const partialMatch = Object.keys(SPECIES_IMAGES).find(
    (key) => matchesSlugWord(commonSlug, key) || matchesSlugWord(scientificSlug, key)
  );
  if (partialMatch) return SPECIES_IMAGES[partialMatch];

  return SPECIES_IMAGES.default ?? null;
}
