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
 * Destination video metadata
 * Videos are stored in Supabase Storage (destination-videos bucket)
 * Format: MP4 (H.264), recommended: 1080p max, 30-60 seconds, <10MB
 */
export interface IDestinationVideo {
    url: string; // Public URL to the video file in Supabase Storage
    thumbnail?: string; // Optional: URL to video thumbnail image
    duration?: number; // Optional: Duration in seconds
    format?: string; // Optional: Video format (default: 'mp4')
    title?: string; // Optional: Video title/description
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
    metadata?: Record<string, any> & {
        images?: string[]; // Array of image URLs
        videos?: IDestinationVideo[]; // Array of video metadata (accessible via metadata->videos)
        elevation?: string; // Optional: Elevation information (e.g., "2730m")
        description?: string; // Optional: Destination description
        best_time_to_visit?: string; // Optional: Best time to visit information
    };
    base_price?: number;
    altitude_m?: number;
    // View fields (from vw_destinations_public)
    images?: string[]; // Extracted from metadata->images

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
    base_price?: number;
    altitude_m?: number;
}

export interface IUpdateDestinationRequest {
    name?: string;
    slug?: string;

    center?: IGeoJSONPoint;
    center_lat?: number;
    center_lng?: number;

    area?: IGeoJSONPolygon;

    metadata?: Record<string, any>;
    base_price?: number;
    altitude_m?: number;
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
    base_price: number;
    altitude_m: number | null;
    area_geojson: string | null;
    center_geojson: string | null;
};

export type PricingBucketType = 'budget_conscious' | 'optimal' | 'go_crazy';

export interface IDestinationPricingBucket {
    destination_id: string;
    bucket_type: PricingBucketType;
    accommodation_price: number;
    transport_price: number;
}
