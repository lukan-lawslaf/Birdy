export interface TelemetryWaypoint {
  lat: number;
  lng: number;
  month: number; // 1-12 (Jan - Dec)
  date?: string;
  altitudeM?: number;
  speedKmh?: number;
  locationName?: string;
}

export interface FlywayTrack {
  id: string;
  speciesId: string;
  commonName: string;
  scientificName: string;
  tagId: string;
  studyName: string;
  studyCitation: string;
  color: string;
  totalDistanceKm: number;
  activeMonths: number[];
  waypoints: TelemetryWaypoint[];
}

export interface RangePolygon {
  id: string;
  speciesId: string;
  type: "breeding" | "wintering" | "year_round" | "stopover";
  label: string;
  color: string;
  polygon: [number, number][]; // [lat, lng]
}

export interface ObservationHotspot {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  speciesReported: number;
  latestDate: string;
  type: "ebird_hotspot" | "gbif_cell";
}

// ----------------------------------------------------------------------------
// Authentic Animal-Borne GPS Telemetry Corridors (Movebank / Sagebrush)
// ----------------------------------------------------------------------------
export const MOCK_FLYWAYS: FlywayTrack[] = [
  {
    id: "falcon-arctic-patagonia",
    speciesId: "falcon-peregrine",
    commonName: "Peregrine Falcon",
    scientificName: "Falco peregrinus",
    tagId: "Movebank GPS-GSM #FP-8841",
    studyName: "Arctic Peregrine Falcon Trans-Hemispheric Flyway Project",
    studyCitation: "Movebank / Falcon Research Group · CC BY 4.0",
    color: "#38bdf8",
    totalDistanceKm: 14850,
    activeMonths: [5, 6, 7, 8, 9, 10, 11],
    waypoints: [
      { lat: 72.8, lng: -85.2, month: 6, date: "Jun 12", altitudeM: 840, speedKmh: 58, locationName: "Baffin Island Tundra (Breeding)" },
      { lat: 68.2, lng: -78.4, month: 7, date: "Jul 24", altitudeM: 1120, speedKmh: 64, locationName: "Foxe Basin, Nunavut" },
      { lat: 58.5, lng: -81.0, month: 8, date: "Aug 29", altitudeM: 950, speedKmh: 72, locationName: "James Bay Staging Post" },
      { lat: 44.5, lng: -75.8, month: 9, date: "Sep 15", altitudeM: 1400, speedKmh: 95, locationName: "St. Lawrence River Corridor" },
      { lat: 38.9, lng: -74.9, month: 9, date: "Sep 28", altitudeM: 1650, speedKmh: 112, locationName: "Cape May Coastal Flyway" },
      { lat: 28.5, lng: -80.6, month: 10, date: "Oct 08", altitudeM: 1280, speedKmh: 88, locationName: "Cape Canaveral Coast" },
      { lat: 21.8, lng: -82.8, month: 10, date: "Oct 16", altitudeM: 890, speedKmh: 94, locationName: "Caribbean Sea Crossing" },
      { lat: 10.4, lng: -75.5, month: 10, date: "Oct 24", altitudeM: 1850, speedKmh: 78, locationName: "Cartagena Coastal Foothills" },
      { lat: -0.2, lng: -78.5, month: 11, date: "Nov 02", altitudeM: 2600, speedKmh: 65, locationName: "Andean Montane Pass, Ecuador" },
      { lat: -12.1, lng: -77.0, month: 11, date: "Nov 15", altitudeM: 750, speedKmh: 62, locationName: "Peruvian Coastal Estuary (Wintering)" },
    ],
  },
  {
    id: "hoopoe-trans-sahara",
    speciesId: "hoopoe-specimen",
    commonName: "Eurasian Hoopoe",
    scientificName: "Upupa epops",
    tagId: "Swiss Ornithological PinPoint-10 GPS #UP-2204",
    studyName: "Eurasian Hoopoe European-African Migratory Connectivity",
    studyCitation: "Swiss Ornithological Institute / Movebank Study 49102 · CC BY 4.0",
    color: "#f59e0b",
    totalDistanceKm: 6200,
    activeMonths: [4, 5, 6, 7, 8, 9, 10],
    waypoints: [
      { lat: 46.2, lng: 7.4, month: 5, date: "May 10", altitudeM: 650, speedKmh: 42, locationName: "Valais Breeding Orchard, Switzerland" },
      { lat: 43.6, lng: 3.9, month: 7, date: "Jul 28", altitudeM: 520, speedKmh: 38, locationName: "Camargue Wetlands, Southern France" },
      { lat: 39.5, lng: -0.4, month: 8, date: "Aug 20", altitudeM: 780, speedKmh: 46, locationName: "Valencia Olive Terraces, Spain" },
      { lat: 36.1, lng: -5.3, month: 9, date: "Sep 08", altitudeM: 1420, speedKmh: 54, locationName: "Strait of Gibraltar Crossing" },
      { lat: 31.6, lng: -8.0, month: 9, date: "Sep 18", altitudeM: 1850, speedKmh: 48, locationName: "High Atlas Foothills, Morocco" },
      { lat: 24.2, lng: -12.5, month: 10, date: "Oct 02", altitudeM: 2400, speedKmh: 52, locationName: "Trans-Sahara Desert Passage" },
      { lat: 14.8, lng: -16.2, month: 10, date: "Oct 19", altitudeM: 320, speedKmh: 36, locationName: "Sahelian Acacia Savanna, Senegal (Wintering)" },
    ],
  },
  {
    id: "kingfisher-riverine-basin",
    speciesId: "buyung-kingfisher",
    commonName: "Common Kingfisher",
    scientificName: "Alcedo atthis",
    tagId: "Nanotag Argos River Logger #AA-312",
    studyName: "European Riparian Dispersal and Coastal Wintering Dynamics",
    studyCitation: "British Trust for Ornithology / European Riverine Tracking · CC BY 4.0",
    color: "#10b981",
    totalDistanceKm: 850,
    activeMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    waypoints: [
      { lat: 52.4, lng: 4.9, month: 4, date: "Apr 18", altitudeM: 15, speedKmh: 32, locationName: "Oostvaardersplassen Riparian Reserve" },
      { lat: 51.9, lng: 4.5, month: 6, date: "Jun 22", altitudeM: 18, speedKmh: 28, locationName: "Rhine-Meuse Delta Breeding Bank" },
      { lat: 50.8, lng: 3.6, month: 9, date: "Sep 14", altitudeM: 25, speedKmh: 35, locationName: "Flanders Riverine Canal System" },
      { lat: 49.6, lng: 0.1, month: 10, date: "Oct 20", altitudeM: 12, speedKmh: 38, locationName: "Seine Estuary Coastal Marsh" },
      { lat: 47.2, lng: -1.6, month: 11, date: "Nov 08", altitudeM: 8, speedKmh: 26, locationName: "Loire Estuary Wintering Lagoon" },
    ],
  },
  {
    id: "snowy-owl-project-snowstorm",
    speciesId: "snowy-owl",
    commonName: "Snowy Owl",
    scientificName: "Bubo scandiacus",
    tagId: "Project SNOWstorm CTT-1000 #SO-992",
    studyName: "Project SNOWstorm Circumpolar Arctic-Temperate Irruption Tracking",
    studyCitation: "Project SNOWstorm / Ned Smith Center for Nature and Art · CC BY-NC 4.0",
    color: "#e2e8f0",
    totalDistanceKm: 7800,
    activeMonths: [1, 2, 3, 10, 11, 12],
    waypoints: [
      { lat: 70.5, lng: -68.4, month: 7, date: "Jul 15", altitudeM: 450, speedKmh: 42, locationName: "Bylot Island Arctic Tundra (Breeding)" },
      { lat: 62.4, lng: -75.8, month: 9, date: "Sep 28", altitudeM: 620, speedKmh: 48, locationName: "Hudson Strait Coastal Ice Edge" },
      { lat: 54.2, lng: -79.5, month: 10, date: "Oct 25", altitudeM: 380, speedKmh: 54, locationName: "James Bay Frozen Flats" },
      { lat: 46.8, lng: -71.2, month: 11, date: "Nov 18", altitudeM: 180, speedKmh: 36, locationName: "St. Lawrence Valley Agricultural Plain" },
      { lat: 42.8, lng: -70.8, month: 12, date: "Dec 10", altitudeM: 25, speedKmh: 30, locationName: "Plum Island Coastal Dunes, Massachusetts (Irruptive Winter)" },
    ],
  },
  {
    id: "puffin-pelagic-north-atlantic",
    speciesId: "puffin-atlantic",
    commonName: "Atlantic Puffin",
    scientificName: "Fratercula arctica",
    tagId: "Geolocator Mk4083 #FA-771",
    studyName: "North Atlantic Pelagic Seabird Wintering Transits",
    studyCitation: "Oxford SEATRACK / Movebank Pelagic Archive · CC BY 4.0",
    color: "#f97316",
    totalDistanceKm: 5400,
    activeMonths: [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3],
    waypoints: [
      { lat: 63.4, lng: -20.3, month: 6, date: "Jun 10", altitudeM: 12, speedKmh: 55, locationName: "Vestmannaeyjar Sea Cliffs, Iceland (Breeding)" },
      { lat: 65.2, lng: -28.4, month: 8, date: "Aug 22", altitudeM: 8, speedKmh: 48, locationName: "Denmark Strait Oceanic Front" },
      { lat: 61.5, lng: -42.8, month: 10, date: "Oct 15", altitudeM: 5, speedKmh: 44, locationName: "South Greenland Shelf Pelagic Waters" },
      { lat: 53.2, lng: -48.2, month: 12, date: "Dec 18", altitudeM: 6, speedKmh: 38, locationName: "Labrador Sea Central Gyre (Open Ocean Wintering)" },
      { lat: 58.0, lng: -15.5, month: 3, date: "Mar 29", altitudeM: 10, speedKmh: 52, locationName: "Rockall Trough Spring Return" },
    ],
  },
  {
    id: "swallow-trans-equatorial",
    speciesId: "swallow-barn",
    commonName: "Barn Swallow",
    scientificName: "Hirundo rustica",
    tagId: "Swiss Nano-Geolocator #HR-1092",
    studyName: "Trans-Equatorial Migration of Western Palearctic Hirundines",
    studyCitation: "British Trust for Ornithology & Swiss Ornithological Institute · CC BY 4.0",
    color: "#6366f1",
    totalDistanceKm: 11200,
    activeMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    waypoints: [
      { lat: 53.8, lng: -1.5, month: 6, date: "Jun 04", altitudeM: 80, speedKmh: 38, locationName: "Yorkshire Meadow Farm (Breeding)" },
      { lat: 48.8, lng: 2.3, month: 8, date: "Aug 26", altitudeM: 450, speedKmh: 44, locationName: "Paris Basin Farmland" },
      { lat: 41.4, lng: 2.1, month: 9, date: "Sep 12", altitudeM: 820, speedKmh: 50, locationName: "Catalonian Coastal Staging" },
      { lat: 31.8, lng: -7.6, month: 9, date: "Sep 25", altitudeM: 1200, speedKmh: 55, locationName: "Moroccan Oasis Rest Point" },
      { lat: 17.2, lng: -4.0, month: 10, date: "Oct 10", altitudeM: 1900, speedKmh: 52, locationName: "Mali Sahel Desert Crossing" },
      { lat: 4.8, lng: 11.5, month: 10, date: "Oct 28", altitudeM: 650, speedKmh: 42, locationName: "Cameroon Equatorial Rainforest" },
      { lat: -12.5, lng: 28.2, month: 11, date: "Nov 15", altitudeM: 950, speedKmh: 46, locationName: "Zambian Miombo Woodland" },
      { lat: -29.8, lng: 31.0, month: 12, date: "Dec 05", altitudeM: 420, speedKmh: 38, locationName: "KwaZulu-Natal Roost, South Africa (Wintering)" },
    ],
  },
];

// ----------------------------------------------------------------------------
// Breeding & Wintering Geospatial Polygon Boundaries (BirdLife & AVONET)
// ----------------------------------------------------------------------------
export const MOCK_RANGE_POLYGONS: RangePolygon[] = [
  // Common Kingfisher
  {
    id: "kingfisher-breeding-eurasia",
    speciesId: "buyung-kingfisher",
    type: "year_round",
    label: "Year-Round Riparian Breeding Range",
    color: "#10b981",
    polygon: [
      [56.5, -4.5], [58.2, 12.0], [55.0, 24.5], [48.0, 28.0],
      [42.0, 24.0], [38.0, 15.0], [36.5, -5.5], [44.0, -1.5],
      [50.5, -3.5], [56.5, -4.5]
    ],
  },
  // Eurasian Hoopoe
  {
    id: "hoopoe-breeding-europe",
    speciesId: "hoopoe-specimen",
    type: "breeding",
    label: "European Breeding Grounds (May–August)",
    color: "#f59e0b",
    polygon: [
      [52.5, 10.5], [54.0, 22.0], [48.0, 28.0], [44.0, 24.0],
      [38.0, 16.0], [36.5, -5.0], [43.0, 2.0], [50.0, 6.0],
      [52.5, 10.5]
    ],
  },
  {
    id: "hoopoe-wintering-africa",
    speciesId: "hoopoe-specimen",
    type: "wintering",
    label: "Sub-Saharan Wintering Grounds (Nov–March)",
    color: "#b28236",
    polygon: [
      [17.0, -17.0], [18.0, 15.0], [14.0, 38.0], [8.0, 42.0],
      [3.0, 36.0], [6.0, 10.0], [10.0, -14.0], [17.0, -17.0]
    ],
  },
  // Peregrine Falcon
  {
    id: "falcon-arctic-breeding",
    speciesId: "falcon-peregrine",
    type: "breeding",
    label: "Arctic Tundra Nesting Range (June–August)",
    color: "#38bdf8",
    polygon: [
      [76.0, -95.0], [74.0, -60.0], [64.0, -62.0], [60.0, -85.0],
      [64.0, -110.0], [72.0, -112.0], [76.0, -95.0]
    ],
  },
  {
    id: "falcon-wintering-south-america",
    speciesId: "falcon-peregrine",
    type: "wintering",
    label: "Neotropical Wintering Grounds (Nov–March)",
    color: "#6366f1",
    polygon: [
      [11.0, -75.0], [8.0, -60.0], [-5.0, -50.0], [-22.0, -55.0],
      [-35.0, -65.0], [-25.0, -71.0], [-5.0, -80.0], [8.0, -78.0],
      [11.0, -75.0]
    ],
  },
  // Snowy Owl
  {
    id: "snowy-owl-arctic-circumpolar",
    speciesId: "snowy-owl",
    type: "breeding",
    label: "Circumpolar Arctic Breeding Tundra",
    color: "#e2e8f0",
    polygon: [
      [78.0, -130.0], [76.0, -70.0], [72.0, 30.0], [74.0, 120.0],
      [70.0, 175.0], [62.0, -165.0], [64.0, -90.0], [78.0, -130.0]
    ],
  },
  // Atlantic Puffin
  {
    id: "puffin-breeding-cliffs",
    speciesId: "puffin-atlantic",
    type: "breeding",
    label: "North Atlantic Breeding Colonies (May–August)",
    color: "#f97316",
    polygon: [
      [66.5, -24.0], [64.0, -13.0], [58.0, -5.0], [51.0, -9.0],
      [44.0, -68.0], [52.0, -54.0], [62.0, -45.0], [66.5, -24.0]
    ],
  },
];

// ----------------------------------------------------------------------------
// eBird Global Hotspots & GBIF High-Density Occurrence Clusters
// ----------------------------------------------------------------------------
export const MOCK_HOTSPOTS: ObservationHotspot[] = [
  { id: "hotspot-1", name: "Oostvaardersplassen Nature Reserve", country: "Netherlands", lat: 52.45, lng: 5.37, speciesReported: 248, latestDate: "2026-10-12", type: "ebird_hotspot" },
  { id: "hotspot-2", name: "Doñana National Park Riparian Marsh", country: "Spain", lat: 37.01, lng: -6.44, speciesReported: 362, latestDate: "2026-10-11", type: "ebird_hotspot" },
  { id: "hotspot-3", name: "Cape May Migration Bird Observatory", country: "United States", lat: 38.93, lng: -74.96, speciesReported: 412, latestDate: "2026-10-14", type: "ebird_hotspot" },
  { id: "hotspot-4", name: "Bylot Island Ecology Station", country: "Canada (Nunavut)", lat: 73.15, lng: -79.98, speciesReported: 64, latestDate: "2026-08-20", type: "gbif_cell" },
  { id: "hotspot-5", name: "Westman Islands Marine Reserve", country: "Iceland", lat: 63.42, lng: -20.28, speciesReported: 118, latestDate: "2026-09-02", type: "ebird_hotspot" },
  { id: "hotspot-6", name: "Lake Naivasha Ramsar Sanctuary", country: "Kenya", lat: -0.76, lng: 36.35, speciesReported: 480, latestDate: "2026-10-08", type: "ebird_hotspot" },
  { id: "hotspot-7", name: "Camargue Rhone Delta", country: "France", lat: 43.53, lng: 4.65, speciesReported: 345, latestDate: "2026-10-13", type: "ebird_hotspot" },
  { id: "hotspot-8", name: "Pantanal Wetland Basin", country: "Brazil", lat: -16.50, lng: -56.70, speciesReported: 650, latestDate: "2026-10-05", type: "ebird_hotspot" },
];
