/**
 * Destination
 */
export interface IDestination {
    id: string;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

/**
 * Create Destination request DTO
 */
export interface ICreateDestinationRequest {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    created_by: string;
}

/**
 * Update Destination request DTO
 */
export interface IUpdateDestinationRequest {
    name?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
}
