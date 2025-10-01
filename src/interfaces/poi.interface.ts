import type { Feature, FeatureCollection, Point } from 'geojson';
import { Order, POIFeatureType, POISort } from '../enums/poi.enum';

/**
 * Points of Interest (POI)
 */
export interface IPOI {
    id: string;
    destination_id: string; // Link to destination
    name: string;
    description?: string;
    category_id: string;
    category_name: string; // denormalized for quick filtering/display
    category?: IPOICategory;
    latitude: number;
    longitude: number;
    elevation?: number;
    images: string[];
    features: IPOIFeature[];
    is_active: boolean;

    // Map visibility controls
    min_zoom: number;
    max_zoom: number;
    priority: number;

    created_by: string;
    created_at: string;
    updated_at: string;

    // Computed fields
    distance?: number; // Distance from user in km
    average_rating?: number;
    total_ratings?: number;
    is_wishlisted?: boolean;
}

/**
 * POI Category
 */
export interface IPOICategory {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    description?: string;
    created_at: string;
}

/**
 * POI Feature
 */
export interface IPOIFeature {
    type: POIFeatureType;
    name: string;
    icon?: string;
    description?: string;
}

/**
 * POI Rating
 */
export interface IPOIRating {
    id: string;
    poi_id: string;
    user_id: string;
    rating: number; // 1–5 scale
    review?: string;
    images?: string[];
    visit_date?: string;
    created_at: string;
    updated_at: string;

    // Relations (reference only)
    user?: {
        id: string;
        full_name: string;
        avatar_url?: string;
    };
}

/**
 * Create POI request DTO
 */
export interface ICreatePOIRequest {
    destination_id: string;
    name: string;
    description?: string;
    category_id: string;
    latitude: number;
    longitude: number;
    elevation?: number;
    images?: string[];
    features?: IPOIFeature[];
    min_zoom?: number;
    max_zoom?: number;
    priority?: number;
}

/**
 * Update POI request DTO
 */
export interface IUpdatePOIRequest {
    destination_id?: string;
    name?: string;
    description?: string;
    category_id?: string;
    latitude?: number;
    longitude?: number;
    elevation?: number;
    images?: string[];
    features?: IPOIFeature[];
    is_active?: boolean;
    min_zoom?: number;
    max_zoom?: number;
    priority?: number;
}

/**
 * POI Search Parameters
 */
export interface IPOISearchParams {
    query?: string;
    category_id?: string;
    destination_id?: string;
    latitude?: number;
    longitude?: number;
    radius?: number; // in km
    min_rating?: number;
    features?: string[];
    sort?: POISort;
    order?: Order;
    zoom?: number; // new: client-side zoom filtering
}

/**
 * Map bounds for POI search
 */
export interface IPOILocationBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

/**
 * POI Statistics DTO
 */
export interface IPOIStatistics {
    total_visits: number;
    average_rating: number;
    rating_distribution: Record<number, number>; // rating -> count
    monthly_visits: Array<{
        month: string;
        visits: number;
    }>;
    popular_times: Array<{
        hour: number;
        visits: number;
    }>;
}

/**
 * Map marker representation of POI
 */
export interface IPOIMarker {
    id: string;
    latitude: number;
    longitude: number;
    category: IPOICategory;
    name: string;
    rating?: number;
    starting_price?: {
        currency: string;
        amount: number;
    };
    priority: number; // for rendering decisions
}

/**
 * POI Cluster for map views
 */
export interface IPOICluster {
    id: string;
    latitude: number;
    longitude: number;
    point_count: number;
    pois: IPOIMarker[];
}

export type IPOIGeoJSONFeature = Feature<Point, IPOIMarker>;
export type IPOIGeoJSONCollection = FeatureCollection<Point, IPOIMarker>;
