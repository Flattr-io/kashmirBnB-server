export interface MapboxFeature {
    center: [number, number];
    place_name: string;
}

export interface MapboxResponse {
    features: MapboxFeature[];
}
