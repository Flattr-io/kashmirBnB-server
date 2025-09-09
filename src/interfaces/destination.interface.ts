/**
 * Destination entity
 */
export interface IDestination {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    latitude: number;
    longitude: number;
    location?: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };
    timezone: string;
    address?: Record<string, any>;
    metadata?: Record<string, any>;
    is_active: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Create destination request DTO
 */
export interface ICreateDestinationRequest {
    name: string;
    slug?: string;
    description?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
    address?: Record<string, any>;
    metadata?: Record<string, any>;
    is_active?: boolean;
}

/**
 * Update destination request DTO
 */
export interface IUpdateDestinationRequest {
    name?: string;
    slug?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    address?: Record<string, any>;
    metadata?: Record<string, any>;
    is_active?: boolean;
}
