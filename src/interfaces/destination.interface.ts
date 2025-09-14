/**
 * GeoJSON geometry types for API representation
 */
export interface IGeoJSONPoint {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
}

export interface IGeoJSONPolygon {
    type: 'Polygon';
    coordinates: [number, number][][]; // array of linear rings
}

/**
 * Destination entity (read model aligned to DB)
 */
export interface IDestination {
    id: string;
    name: string;
    slug: string;

    // Geometry fields (optional for cases where PostGIS is not available)
    area?: IGeoJSONPolygon | null;
    center?: IGeoJSONPoint | null;
    center_lat: number;
    center_lng: number;

    // Extensibility
    metadata?: Record<string, any>;

    // Auditing
    created_by?: string | null;
    created_at: string; // ISO timestamp
    updated_at: string; // ISO timestamp
}

export interface ICreateDestinationRequest {
    name: string;
    slug: string;

    center: IGeoJSONPoint;
    center_lat: number;
    center_lng: number;

    area: IGeoJSONPolygon;

    metadata?: Record<string, any>;
}

export interface IUpdateDestinationRequest {
    name?: string;
    slug?: string;

    center?: IGeoJSONPoint;
    center_lat?: number;
    center_lng?: number;

    area?: IGeoJSONPolygon;

    metadata?: Record<string, any>;
}

export type RowWithGeoJSON = {
    id: string;
    name: string;
    slug: string;
    metadata: Record<string, any> | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    center_lat: number;
    center_lng: number;
    area_geojson: string | null;
    center_geojson: string | null;
};
