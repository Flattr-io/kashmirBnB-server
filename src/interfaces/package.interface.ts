export interface GeneratePackageRequest {
    destinationIds: string[];
    people: number;
    priceBucket: PriceBucket; // replaces budget
    activities?: string[];
    startDate?: string; // ISO; default now + 3 days
    includeCommonAttractions?: boolean;
}

export type PriceBucket = 'budget_conscious' | 'optimal' | 'go_crazy';
export type CabType = 'sedan' | 'suv' | 'tempo';

export interface PackageLeg {
    originId: string;
    destinationId: string;
    distanceKm?: number;
    durationMinutes?: number;
    cabCost?: number;
}

export interface ActivityWithPrice {
    poiId: string;
    name: string;
    pricing_type?: 'one_time' | 'per_person' | 'rental' | 'free';
    base_price?: number;
    metadata?: any;
}

export interface HotelOption {
    name: string;
    rating?: number;
    address?: string;
    price?: number;
    currency?: string;
    checkInDate?: string;
    checkOutDate?: string;
    roomQuantity?: number;
    hotelId?: string;
    distanceKm?: number;
    latitude?: number;
    longitude?: number;
}

export interface RestaurantSuggestion {
    id: string;
    name: string;
    price_range?: 'budget' | 'mid_range' | 'premium';
    special_delicacies?: any[];
    average_rating?: number;
    veg_non_veg?: 'veg' | 'non_veg' | 'both';
    cuisine_types?: string[];
    description?: string;
}

export interface DayPlan {
    date: string; // ISO
    title: string;
    destinationId: string;
    activities: ActivityWithPrice[];
    activitiesCost?: number;
    hotel?: HotelOption;
    hotelOptions?: any[];
    restaurantSuggestions?: RestaurantSuggestion[];
    transportCost?: number;
    legTransportCost?: number;
    weather?: any;
}

export interface PackageGenerationResult {
    title: string;
    startDate: string;
    people: number;
    cabType: CabType;
    totalBasePrice: number;
    perPersonPrice: number;
    days: DayPlan[];
    legs: PackageLeg[];
    currency: string;
    cabSelection?: {
        id?: string;
        type: CabType;
        estimatedCost?: number;
    };
    optionalAttractions?: Array<{ poiId: string; name: string; price?: number }>;
    breakdown?: { accommodation: number; transport: number; activities: number; cab: number };
}

