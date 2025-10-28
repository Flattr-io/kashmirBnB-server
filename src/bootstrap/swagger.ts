import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const getServerConfig = () => {
    const port = process.env.PORT || 3000;
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
        return [
            { url: `https://kashmirbnbserver-4vgs.onrender.com/api`, description: 'Production server' },
            { url: `http://localhost:${port}/api`, description: 'Local server' }
        ];
    }
    
    return [{ url: `http://localhost:${port}/api`, description: 'Local server' }];
};

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kashmir BnB API',
            version: '1.0.0',
            description: 'Comprehensive API for Kashmir BnB application - A tourism platform for discovering destinations, points of interest, weather information, and user management in Kashmir region.',
            contact: {
                name: 'Kashmir BnB Team',
                email: 'support@kashmirbnb.com',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
        },
        servers: getServerConfig(),
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token obtained from the /auth/login endpoint',
                },
            },
            schemas: {
                GeneratePackageRequest: {
                    type: 'object',
                    properties: {
                        destinationIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                        people: { type: 'integer', minimum: 1, example: 2 },
                        priceBucket: { type: 'string', enum: ['budget_conscious','optimal','go_crazy'] },
                        activities: { type: 'array', items: { type: 'string' } },
                        includeCommonAttractions: { type: 'boolean', description: 'Auto-add top purchasable attractions and return the rest as suggestions' },
                        startDate: { type: 'string', format: 'date-time', description: 'Optional start date; defaults to now + 3 days' },
                    },
                    required: ['destinationIds', 'people', 'priceBucket']
                },
                PackageLeg: {
                    type: 'object',
                    properties: {
                        originId: { type: 'string', format: 'uuid' },
                        destinationId: { type: 'string', format: 'uuid' },
                        distanceKm: { type: 'number', nullable: true },
                        durationMinutes: { type: 'integer', nullable: true },
                    }
                },
                DayPlan: {
                    type: 'object',
                    properties: {
                        date: { type: 'string', format: 'date-time' },
                        title: { type: 'string' },
                        destinationId: { type: 'string', format: 'uuid' },
                        activities: { type: 'array', items: { type: 'string' } },
                        hotelSuggestion: { type: 'string', nullable: true },
                        restaurantSuggestions: { type: 'array', items: { type: 'string' }, nullable: true },
                    },
                    required: ['date', 'title', 'destinationId', 'activities']
                },
                PackageGenerationResult: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        startDate: { type: 'string', format: 'date-time' },
                        people: { type: 'integer' },
                        cabType: { type: 'string', enum: ['sedan','suv','tempo'] },
                        totalBasePrice: { type: 'number' },
                        perPersonPrice: { type: 'number' },
                        days: { type: 'array', items: { $ref: '#/components/schemas/DayPlan' } },
                        legs: { type: 'array', items: { $ref: '#/components/schemas/PackageLeg' } },
                        currency: { type: 'string', example: 'INR' },
                        cabSelection: { $ref: '#/components/schemas/CabSelection' },
                        optionalAttractions: { type: 'array', items: { $ref: '#/components/schemas/OptionalAttraction' } },
                        breakdown: {
                            type: 'object',
                            properties: {
                                accommodation: { type: 'number' },
                                transport: { type: 'number' },
                                activities: { type: 'number' },
                                cab: { type: 'number' },
                            }
                        }
                    },
                    required: ['title','startDate','people','cabType','totalBasePrice','perPersonPrice','days','legs','currency']
                },
                CabSelection: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', nullable: true },
                        type: { type: 'string', enum: ['sedan','suv','tempo'] },
                        estimatedCost: { type: 'number', nullable: true }
                    },
                    required: ['type']
                },
                OptionalAttraction: {
                    type: 'object',
                    properties: {
                        poiId: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        price: { type: 'number', nullable: true }
                    },
                    required: ['poiId','name']
                },
                DestinationPricingBucket: {
                    type: 'object',
                    properties: {
                        destination_id: { type: 'string', format: 'uuid' },
                        bucket_type: { type: 'string', enum: ['budget_conscious','optimal','go_crazy'] },
                        accommodation_price: { type: 'number' },
                        transport_price: { type: 'number' }
                    },
                    required: ['destination_id','bucket_type','accommodation_price','transport_price']
                },
                ChatMessage: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        text: { type: 'string' },
                        author: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        isRigged: { type: 'boolean' },
                    },
                    required: ['id', 'text', 'author', 'timestamp', 'isRigged'],
                },
                ChatResponse: {
                    type: 'object',
                    properties: {
                        userState: { type: 'string', enum: ['UNAUTHENTICATED', 'PHONE_VERIFIED', 'KYC_VERIFIED'] },
                        canSend: { type: 'boolean' },
                        messagesAvailable: { type: 'number' },
                        messages: { type: 'array', items: { $ref: '#/components/schemas/ChatMessage' } },
                        error: { type: 'string', nullable: true },
                    },
                    required: ['userState', 'canSend', 'messagesAvailable', 'messages'],
                },
                // User Schemas
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique user identifier',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        name: {
                            type: 'string',
                            description: 'Full name of the user',
                            example: 'John Doe',
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'john.doe@example.com',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'User creation timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['id', 'name', 'email'],
                },
                CreateUserRequest: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Full name of the user',
                            example: 'John Doe',
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'john.doe@example.com',
                        },
                        password: {
                            type: 'string',
                            format: 'password',
                            minLength: 8,
                            description: 'User password (minimum 8 characters)',
                            example: 'StrongPass#123',
                        },
                    },
                    required: ['name', 'email', 'password'],
                },
                // Auth Schemas
                AuthSignupRequest: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'testuser@example.com',
                        },
                        password: {
                            type: 'string',
                            format: 'password',
                            minLength: 8,
                            description: 'User password (minimum 8 characters)',
                            example: 'StrongPass#123',
                        },
                        name: {
                            type: 'string',
                            description: 'Full name of the user',
                            example: 'John Doe',
                        },
                        phone: {
                            type: 'string',
                            description: 'User phone number',
                            example: '+91-9876543210',
                        },
                    },
                    required: ['email', 'password', 'name', 'phone'],
                },
                AuthLoginRequest: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'testuser@example.com',
                        },
                        password: {
                            type: 'string',
                            format: 'password',
                            description: 'User password',
                            example: 'StrongPass#123',
                        },
                    },
                    required: ['email', 'password'],
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        user: {
                            $ref: '#/components/schemas/User',
                        },
                        access_token: {
                            type: 'string',
                            description: 'JWT access token for API authentication',
                            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        },
                        refresh_token: {
                            type: 'string',
                            description: 'JWT refresh token for token renewal',
                            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        },
                    },
                },
                // Destination Schemas
                GeoJSONPoint: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['Point'],
                            example: 'Point',
                        },
                        coordinates: {
                            type: 'array',
                            items: {
                                type: 'number',
                            },
                            minItems: 2,
                            maxItems: 2,
                            description: 'Longitude and latitude coordinates',
                            example: [74.7973, 34.0837],
                        },
                    },
                    required: ['type', 'coordinates'],
                },
                GeoJSONPolygon: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['Polygon'],
                            example: 'Polygon',
                        },
                        coordinates: {
                            type: 'array',
                            items: {
                                type: 'array',
                                items: {
                                    type: 'array',
                                    items: {
                                        type: 'number',
                                    },
                                    minItems: 2,
                                    maxItems: 2,
                                },
                            },
                            description: 'Array of linear rings defining the polygon boundary',
                        },
                    },
                    required: ['type', 'coordinates'],
                },
                Destination: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique destination identifier',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        name: {
                            type: 'string',
                            description: 'Destination name',
                            example: 'Srinagar',
                        },
                        slug: {
                            type: 'string',
                            description: 'URL-friendly destination identifier',
                            example: 'srinagar',
                        },
                        area: {
                            $ref: '#/components/schemas/GeoJSONPolygon',
                        },
                        center: {
                            $ref: '#/components/schemas/GeoJSONPoint',
                        },
                        center_lat: {
                            type: 'number',
                            format: 'float',
                            description: 'Center latitude coordinate',
                            example: 34.0837,
                        },
                        center_lng: {
                            type: 'number',
                            format: 'float',
                            description: 'Center longitude coordinate',
                            example: 74.7973,
                        },
                        metadata: {
                            type: 'object',
                            description: 'Additional destination metadata',
                            example: {
                                population: 1200000,
                                elevation: 1585,
                                timezone: 'Asia/Kolkata',
                            },
                        },
                        base_price: {
                            type: 'number',
                            format: 'float',
                            description: 'Base price contribution for this destination',
                            example: 2500.00,
                        },
                        created_by: {
                            type: 'string',
                            format: 'uuid',
                            nullable: true,
                            description: 'ID of the user who created this destination',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Destination creation timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Destination last update timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['id', 'name', 'slug', 'area', 'center', 'center_lat', 'center_lng', 'created_at', 'updated_at'],
                },
                CreateDestinationRequest: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Destination name',
                            example: 'Srinagar',
                        },
                        slug: {
                            type: 'string',
                            description: 'URL-friendly destination identifier',
                            example: 'srinagar',
                        },
                        area: {
                            $ref: '#/components/schemas/GeoJSONPolygon',
                        },
                        center: {
                            $ref: '#/components/schemas/GeoJSONPoint',
                        },
                        metadata: {
                            type: 'object',
                            description: 'Additional destination metadata',
                            example: {
                                population: 1200000,
                                elevation: 1585,
                                timezone: 'Asia/Kolkata',
                            },
                        },
                        base_price: {
                            type: 'number',
                            format: 'float',
                            description: 'Base price contribution for this destination',
                            example: 2500.00,
                        },
                    },
                    required: ['name', 'slug', 'area', 'center'],
                },
                // POI Schemas
                POICategory: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique category identifier',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        name: {
                            type: 'string',
                            description: 'Category name',
                            example: 'Historical Site',
                        },
                        icon: {
                            type: 'string',
                            description: 'Icon identifier for the category',
                            example: 'landmark',
                        },
                        color: {
                            type: 'string',
                            pattern: '^#[0-9A-Fa-f]{6}$',
                            description: 'Hex color code for the category',
                            example: '#FF5733',
                        },
                        description: {
                            type: 'string',
                            description: 'Category description',
                            example: 'Ancient monuments and heritage sites',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Category creation timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['id', 'name', 'icon', 'color'],
                },
                POIFeature: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['amenity', 'activity', 'accessibility', 'safety', 'seasonal'],
                            description: 'Type of POI feature',
                            example: 'amenity',
                        },
                        name: {
                            type: 'string',
                            description: 'Feature name',
                            example: 'Parking Available',
                        },
                        icon: {
                            type: 'string',
                            description: 'Icon identifier for the feature',
                            example: 'parking',
                        },
                        description: {
                            type: 'string',
                            description: 'Feature description',
                            example: 'Free parking available for visitors',
                        },
                    },
                    required: ['type', 'name'],
                },
                POI: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique POI identifier',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        destination_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the destination this POI belongs to',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        name: {
                            type: 'string',
                            description: 'POI name',
                            example: 'Dal Lake',
                        },
                        description: {
                            type: 'string',
                            description: 'POI description',
                            example: 'Famous lake in Srinagar known for its houseboats and shikaras',
                        },
                        category_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the POI category',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        category_name: {
                            type: 'string',
                            description: 'Denormalized category name corresponding to category_id',
                            example: 'Gardens & Parks',
                        },
                        category: {
                            $ref: '#/components/schemas/POICategory',
                        },
                        latitude: {
                            type: 'number',
                            format: 'float',
                            description: 'POI latitude coordinate',
                            example: 34.0837,
                        },
                        longitude: {
                            type: 'number',
                            format: 'float',
                            description: 'POI longitude coordinate',
                            example: 74.7973,
                        },
                        elevation: {
                            type: 'number',
                            format: 'float',
                            description: 'POI elevation in meters',
                            example: 1585,
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                            description: 'Array of image URLs',
                            example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
                        },
                        features: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/POIFeature',
                            },
                            description: 'Array of POI features',
                        },
                        is_active: {
                            type: 'boolean',
                            description: 'Whether the POI is active and visible',
                            example: true,
                        },
                        min_zoom: {
                            type: 'number',
                            description: 'Minimum zoom level for map visibility',
                            example: 10,
                        },
                        max_zoom: {
                            type: 'number',
                            description: 'Maximum zoom level for map visibility',
                            example: 18,
                        },
                        priority: {
                            type: 'number',
                            description: 'Display priority (higher numbers appear first)',
                            example: 5,
                        },
                        created_by: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the user who created this POI',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'POI creation timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'POI last update timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                        distance: {
                            type: 'number',
                            format: 'float',
                            description: 'Distance from user in kilometers (computed field)',
                            example: 2.5,
                        },
                        average_rating: {
                            type: 'number',
                            format: 'float',
                            minimum: 1,
                            maximum: 5,
                            description: 'Average rating across all reviews (computed field)',
                            example: 4.2,
                        },
                        total_ratings: {
                            type: 'number',
                            description: 'Total number of ratings (computed field)',
                            example: 150,
                        },
                        is_wishlisted: {
                            type: 'boolean',
                            description: 'Whether the POI is in user\'s wishlist (computed field)',
                            example: false,
                        },
                    },
                    required: ['id', 'destination_id', 'name', 'category_id', 'latitude', 'longitude', 'images', 'features', 'is_active', 'min_zoom', 'max_zoom', 'priority', 'created_by', 'created_at', 'updated_at'],
                },
                CreatePOIRequest: {
                    type: 'object',
                    properties: {
                        destination_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the destination this POI belongs to',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        name: {
                            type: 'string',
                            description: 'POI name',
                            example: 'Dal Lake',
                        },
                        description: {
                            type: 'string',
                            description: 'POI description',
                            example: 'Famous lake in Srinagar known for its houseboats and shikaras',
                        },
                        category_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the POI category',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        latitude: {
                            type: 'number',
                            format: 'float',
                            description: 'POI latitude coordinate',
                            example: 34.0837,
                        },
                        longitude: {
                            type: 'number',
                            format: 'float',
                            description: 'POI longitude coordinate',
                            example: 74.7973,
                        },
                        elevation: {
                            type: 'number',
                            format: 'float',
                            description: 'POI elevation in meters',
                            example: 1585,
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                            description: 'Array of image URLs',
                            example: ['https://example.com/image1.jpg'],
                        },
                        features: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/POIFeature',
                            },
                            description: 'Array of POI features',
                        },
                        min_zoom: {
                            type: 'number',
                            description: 'Minimum zoom level for map visibility',
                            example: 10,
                        },
                        max_zoom: {
                            type: 'number',
                            description: 'Maximum zoom level for map visibility',
                            example: 18,
                        },
                        priority: {
                            type: 'number',
                            description: 'Display priority (higher numbers appear first)',
                            example: 5,
                        },
                    },
                    required: ['destination_id', 'name', 'category_id', 'latitude', 'longitude', 'images', 'features'],
                },
                // Alias for compatibility with route annotations
                ICreatePOIRequest: {
                    $ref: '#/components/schemas/CreatePOIRequest',
                },
                // Update POI request schema
                IUpdatePOIRequest: {
                    type: 'object',
                    properties: {
                        destination_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the destination this POI belongs to',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        name: {
                            type: 'string',
                            description: 'POI name',
                            example: 'Dal Lake',
                        },
                        description: {
                            type: 'string',
                            description: 'POI description',
                            example: 'Famous lake in Srinagar known for its houseboats and shikaras',
                        },
                        category_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the POI category',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        latitude: {
                            type: 'number',
                            format: 'float',
                            description: 'POI latitude coordinate',
                            example: 34.0837,
                        },
                        longitude: {
                            type: 'number',
                            format: 'float',
                            description: 'POI longitude coordinate',
                            example: 74.7973,
                        },
                        elevation: {
                            type: 'number',
                            format: 'float',
                            description: 'POI elevation in meters',
                            example: 1585,
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                            description: 'Array of image URLs',
                            example: ['https://example.com/image1.jpg'],
                        },
                        features: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/POIFeature',
                            },
                            description: 'Array of POI features',
                        },
                        is_active: {
                            type: 'boolean',
                            description: 'Whether the POI is active and visible',
                            example: true,
                        },
                        min_zoom: {
                            type: 'number',
                            description: 'Minimum zoom level for map visibility',
                            example: 10,
                        },
                        max_zoom: {
                            type: 'number',
                            description: 'Maximum zoom level for map visibility',
                            example: 18,
                        },
                        priority: {
                            type: 'number',
                            description: 'Display priority (higher numbers appear first)',
                            example: 5,
                        },
                    },
                    // All properties are optional for updates
                },
                // POI Rating Schemas
                POIRating: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique rating identifier',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        poi_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the POI being rated',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        user_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the user who created the rating',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        rating: {
                            type: 'number',
                            minimum: 1,
                            maximum: 5,
                            description: 'Rating value (1-5 scale)',
                            example: 4,
                        },
                        review: {
                            type: 'string',
                            description: 'Text review of the POI',
                            example: 'Beautiful place, must visit! The shikara ride was amazing.',
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                            description: 'Array of review image URLs',
                            example: ['https://example.com/review1.jpg'],
                        },
                        visit_date: {
                            type: 'string',
                            format: 'date',
                            description: 'Date when the user visited the POI',
                            example: '2024-01-15',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Rating creation timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Rating last update timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                        user: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    format: 'uuid',
                                    description: 'User ID',
                                },
                                full_name: {
                                    type: 'string',
                                    description: 'User full name',
                                    example: 'John Doe',
                                },
                                avatar_url: {
                                    type: 'string',
                                    format: 'uri',
                                    description: 'User avatar URL',
                                    example: 'https://example.com/avatar.jpg',
                                },
                            },
                            description: 'User information (when included in response)',
                        },
                    },
                    required: ['id', 'poi_id', 'user_id', 'rating', 'created_at', 'updated_at'],
                },
                CreatePOIRatingRequest: {
                    type: 'object',
                    properties: {
                        poi_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the POI being rated',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        user_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the user who created the rating',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        rating: {
                            type: 'number',
                            minimum: 1,
                            maximum: 5,
                            description: 'Rating value (1-5 scale)',
                            example: 4,
                        },
                        review: {
                            type: 'string',
                            description: 'Text review of the POI',
                            example: 'Beautiful place, must visit!',
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                            description: 'Array of review image URLs',
                            example: ['https://example.com/review1.jpg'],
                        },
                        visit_date: {
                            type: 'string',
                            format: 'date',
                            description: 'Date when the user visited the POI',
                            example: '2024-01-15',
                        },
                    },
                    required: ['poi_id', 'user_id', 'rating'],
                },
                // Weather Schemas
                HourlyForecast: {
                    type: 'object',
                    properties: {
                        time: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Forecast time',
                            example: '2024-01-15T12:00:00Z',
                        },
                        temperature: {
                            type: 'number',
                            format: 'float',
                            description: 'Temperature in Celsius',
                            example: 15.5,
                        },
                        humidity: {
                            type: 'number',
                            format: 'float',
                            description: 'Humidity percentage',
                            example: 65.0,
                        },
                        precipitation: {
                            type: 'number',
                            format: 'float',
                            description: 'Precipitation in mm',
                            example: 2.5,
                        },
                        windSpeed: {
                            type: 'number',
                            format: 'float',
                            description: 'Wind speed in km/h',
                            example: 12.3,
                        },
                        weatherCode: {
                            type: 'number',
                            description: 'Weather condition code',
                            example: 1001,
                        },
                    },
                    required: ['time', 'temperature', 'humidity', 'precipitation', 'windSpeed', 'weatherCode'],
                },
                DailyForecast: {
                    type: 'object',
                    properties: {
                        date: {
                            type: 'string',
                            format: 'date',
                            description: 'Forecast date',
                            example: '2024-01-15',
                        },
                        temperatureMin: {
                            type: 'number',
                            format: 'float',
                            description: 'Minimum temperature in Celsius',
                            example: 8.5,
                        },
                        temperatureMax: {
                            type: 'number',
                            format: 'float',
                            description: 'Maximum temperature in Celsius',
                            example: 18.2,
                        },
                        humidity: {
                            type: 'number',
                            format: 'float',
                            description: 'Average humidity percentage',
                            example: 70.0,
                        },
                        precipitation: {
                            type: 'number',
                            format: 'float',
                            description: 'Total precipitation in mm',
                            example: 5.2,
                        },
                        windSpeed: {
                            type: 'number',
                            format: 'float',
                            description: 'Average wind speed in km/h',
                            example: 15.8,
                        },
                        weatherCode: {
                            type: 'number',
                            description: 'Weather condition code',
                            example: 1001,
                        },
                        hourly: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/HourlyForecast',
                            },
                            description: 'Hourly forecast data',
                        },
                    },
                    required: ['date', 'temperatureMin', 'temperatureMax', 'humidity', 'precipitation', 'windSpeed', 'weatherCode'],
                },
                DestinationWeather: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique weather record identifier',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        destination_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the destination',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                        daily: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/DailyForecast',
                            },
                            description: 'Daily weather forecast',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Weather data creation timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['id', 'destination_id', 'daily', 'created_at'],
                },
                CreateWeatherRequest: {
                    type: 'object',
                    properties: {
                        destination_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'ID of the destination',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                        },
                    },
                    required: ['destination_id'],
                },
                // Map Schemas
                MapboxFeature: {
                    type: 'object',
                    properties: {
                        center: {
                            type: 'array',
                            items: {
                                type: 'number',
                            },
                            minItems: 2,
                            maxItems: 2,
                            description: 'Longitude and latitude coordinates',
                            example: [74.7973, 34.0837],
                        },
                        place_name: {
                            type: 'string',
                            description: 'Full place name',
                            example: 'Srinagar, Jammu and Kashmir, India',
                        },
                    },
                    required: ['center', 'place_name'],
                },
                MapboxResponse: {
                    type: 'object',
                    properties: {
                        features: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/MapboxFeature',
                            },
                            description: 'Array of place features',
                        },
                    },
                    required: ['features'],
                },
                // Error Schemas
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Invalid request parameters',
                        },
                        message: {
                            type: 'string',
                            description: 'Detailed error message',
                            example: 'The provided email address is not valid',
                        },
                        statusCode: {
                            type: 'number',
                            description: 'HTTP status code',
                            example: 400,
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Error timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['error', 'statusCode', 'timestamp'],
                },
                ValidationError: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error type',
                            example: 'Validation Error',
                        },
                        message: {
                            type: 'string',
                            description: 'Validation error message',
                            example: 'Invalid input data',
                        },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    field: {
                                        type: 'string',
                                        description: 'Field name that failed validation',
                                        example: 'email',
                                    },
                                    message: {
                                        type: 'string',
                                        description: 'Field-specific error message',
                                        example: 'Email must be a valid email address',
                                    },
                                },
                            },
                            description: 'Array of field-specific validation errors',
                        },
                        statusCode: {
                            type: 'number',
                            description: 'HTTP status code',
                            example: 422,
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Error timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['error', 'message', 'statusCode', 'timestamp'],
                },
                // Success Response Schemas
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Indicates if the operation was successful',
                            example: true,
                        },
                        message: {
                            type: 'string',
                            description: 'Success message',
                            example: 'Operation completed successfully',
                        },
                        data: {
                            type: 'object',
                            description: 'Response data',
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Response timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['success', 'timestamp'],
                },
                // Health Check Schema
                HealthCheck: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['healthy', 'unhealthy'],
                            description: 'Overall health status',
                            example: 'healthy',
                        },
                        uptime: {
                            type: 'number',
                            description: 'Server uptime in seconds',
                            example: 3600,
                        },
                        memory: {
                            type: 'object',
                            properties: {
                                used: {
                                    type: 'number',
                                    description: 'Used memory in MB',
                                    example: 45.2,
                                },
                                total: {
                                    type: 'number',
                                    description: 'Total memory in MB',
                                    example: 512,
                                },
                                percentage: {
                                    type: 'number',
                                    description: 'Memory usage percentage',
                                    example: 8.8,
                                },
                            },
                            description: 'Memory usage information',
                        },
                        database: {
                            type: 'object',
                            properties: {
                                status: {
                                    type: 'string',
                                    enum: ['connected', 'disconnected', 'error'],
                                    description: 'Database connection status',
                                    example: 'connected',
                                },
                                responseTime: {
                                    type: 'number',
                                    description: 'Database response time in ms',
                                    example: 25,
                                },
                            },
                            description: 'Database connection information',
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Health check timestamp',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                    required: ['status', 'uptime', 'memory', 'database', 'timestamp'],
                },
            },
        },
        tags: [
            {
                name: 'Chat',
                description: 'Global chat endpoints',
            },
            {
                name: 'Auth',
                description: 'Authentication and user management endpoints',
            },
            {
                name: 'Users',
                description: 'User management and profile operations',
            },
            {
                name: 'Destinations',
                description: 'Destination management and geographic data',
            },
            {
                name: 'Packages',
                description: 'Travel package generation and recommendations',
            },
            {
                name: 'POIs',
                description: 'Points of Interest management and operations',
            },
            {
                name: 'POI Categories',
                description: 'POI category management and classification',
            },
            {
                name: 'POI Ratings',
                description: 'POI rating and review system',
            },
            {
                name: 'POI Wishlist',
                description: 'User wishlist management for POIs',
            },
            {
                name: 'Weather',
                description: 'Weather forecast and climate data',
            },
            {
                name: 'Health',
                description: 'System health and monitoring endpoints',
            },
        ],
        security: [{ bearerAuth: [] }],
    },
    apis: [
        process.env.NODE_ENV === 'production' 
            ? './build/src/routes/*.js'  // Production: compiled JS files in build directory
            : './src/routes/*.ts'   // Development: TypeScript files
    ]
};

export const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
    // Serve the raw swagger spec JSON
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Kashmir BnB API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
            deepLinking: true, // Enable deep linking to operations
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tryItOutEnabled: true,
            docExpansion: 'full', // Expand all operations and schemas by default
            defaultModelsExpandDepth: 2, // Show schema details by default
            defaultModelExpandDepth: 2,
            showRequestHeaders: true,
            requestSnippetsEnabled: true,
            requestSnippets: {
                generators: {
                    curl_bash: {
                        title: 'cURL (bash)',
                        syntax: 'bash'
                    },
                    curl_powershell: {
                        title: 'cURL (PowerShell)',
                        syntax: 'powershell'
                    },
                    curl_cmd: {
                        title: 'cURL (CMD)',
                        syntax: 'bash'
                    }
                },
                defaultExpanded: false,
                languages: null // null for all languages
            },
            requestInterceptor: (req: any) => {
                // Add any custom request headers or modifications here
                return req;
            },
            responseInterceptor: (res: any) => {
                // Add any custom response handling here
                return res;
            },
        },
        explorer: true,
    }));
};