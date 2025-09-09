export enum POIFeatureType {
    Amenity = 'amenity',
    Activity = 'activity',
    Accessibility = 'accessibility',
    Safety = 'safety',
    Seasonal = 'seasonal',
}

export enum EntityType {
    POI = 'poi',
    Package = 'package',
}

export enum ModerationStatus {
    Pending = 'pending',
    Approved = 'approved',
    Rejected = 'rejected',
    Flagged = 'flagged',
}

export enum POISort {
    Distance = 'distance',
    Rating = 'rating',
    Name = 'name',
    CreatedAt = 'created_at',
}

export enum Order {
    Asc = 'asc',
    Desc = 'desc',
}
