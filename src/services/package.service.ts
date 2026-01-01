import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { GeneratePackageRequest, PackageGenerationResult, CabType, DayPlan, PackageLeg, PriceBucket, ActivityWithPrice, UpdatePackageConfigurationRequest, BookingHistoryItem } from '../interfaces/package.interface';
import { AmadeusService } from './amadeus.service';
import { WeatherService } from './weather.service';
import { addUtcDays, toYmdUtc } from '../utils/date.util';
import { createHash } from 'crypto';

export class PackageService {
    private static readonly CACHE_TTL_MS = Number(process.env.PACKAGE_CACHE_TTL_MS || 15000);
    private static responseCache = new Map<string, { expiry: number; promise: Promise<PackageGenerationResult> }>();

    private static buildCacheKey(input: { destinations: string[]; startDate: string; people: number; bucket: PriceBucket }): string {
        const payload = JSON.stringify({
            d: input.destinations,
            s: input.startDate,
            p: input.people,
            b: input.bucket,
        });
        return createHash('sha256').update(payload).digest('hex');
    }

    private static withDedupe<R>(key: string, producer: () => Promise<R>): Promise<R> {
        const now = Date.now();
        // purge expired
        for (const [k, v] of PackageService.responseCache.entries()) {
            if (v.expiry <= now) PackageService.responseCache.delete(k);
        }
        const existing = PackageService.responseCache.get(key);
        if (existing && existing.expiry > now) {
            console.log(`[PackageService] Dedupe cache hit key=${key.slice(0,8)}...`);
            return existing.promise as Promise<R>;
        }
        const promise = producer();
        PackageService.responseCache.set(key, { expiry: now + PackageService.CACHE_TTL_MS, promise: promise as any });
        return promise;
    }
    private get db(): SupabaseClient {
        return getDB();
    }

    async generate(req: GeneratePackageRequest, userId?: string): Promise<PackageGenerationResult> {
        // Build cache key based on request params
        const destinationIds = (req.destinationIds || []).filter(Boolean);
        const people = Math.max(1, Number(req.people || 1));
        const startDate = this.resolveStartDate(req.startDate);
        
        // Ensure strictly ordered for cache key consistency
        const sortedIds = [...destinationIds].sort();

        const cacheKey = PackageService.buildCacheKey({ destinations: sortedIds, startDate, people, bucket: req.priceBucket });
        
        return await PackageService.withDedupe(cacheKey, async () => {
            const result = await this.generatePackageContent(req);
            
            // Persist the generated package for future retrieval
            try {
                const savedId = await this.persistPackage(result, req, userId);
                result.packageId = savedId;
            } catch (e: any) {
                console.error('[PackageService] Failed to persist package:', e?.message || e);
            }
            return result;
        });
    }

    private async generatePackageContent(req: GeneratePackageRequest): Promise<PackageGenerationResult> {
        const destinationIds = (req.destinationIds || []).filter(Boolean);
        if (destinationIds.length === 0) {
            throw new Error('destinationIds must be non-empty');
        }

        const startDate = this.resolveStartDate(req.startDate);
        const cabType = this.presuggestCabType(req.people);

        const { data: destinations } = await this.db
            .from('vw_destinations_public')
            .select('id,name,slug,base_price,metadata,center_lat,center_lng,altitude_m')
            .in('id', destinationIds);

        const idToDestination = new Map((destinations || []).map((d: any) => [d.id, d]));
        let ordered = destinationIds.filter((id) => idToDestination.has(id));

        // Ensure Srinagar (if present) is first in sequence
        const srinagarId = ordered.find((id) => (idToDestination.get(id)?.slug || '').toLowerCase() === 'srinagar');
        if (srinagarId && ordered[0] !== srinagarId) {
            ordered = [srinagarId, ...ordered.filter((id) => id !== srinagarId)];
        }

        // Price bucket components
        const pricingRows = await this.fetchPricingBuckets(ordered, req.priceBucket);
        const pricingMap = new Map<string, { accommodation_price: number; transport_price: number }>();
        for (const r of pricingRows) {
            // destination_id key
            const id = (r as any).destination_id;
            pricingMap.set(id, { accommodation_price: Number((r as any).accommodation_price || 0), transport_price: Number((r as any).transport_price || 0) });
        }
        const people = Math.max(1, Number(req.people || 1));

        // Request meta log
        const rangeStart = toYmdUtc(new Date(startDate));
        const rangeEnd = toYmdUtc(addUtcDays(new Date(startDate), Math.max(0, ordered.length - 1)));
        console.log(`[PackageService] Generate: startDate=${rangeStart}, range=${rangeStart}..${rangeEnd}, destinations=${ordered.length}, people=${people}, bucket=${req.priceBucket}`);

        const legs: PackageLeg[] = await this.buildLegs(ordered);
        // Prepare containers
        const amadeus = new AmadeusService();
        const hotelSuggestionsByDay: Record<string, any[]> = {};
        const accommodationCostsByDay: Record<string, number> = {};

        // Restaurants top 3 by rating per destination and aligned with bucket
        const restaurantsByDest = await this.fetchTopRestaurants(ordered, req.priceBucket);

        // Common attractions
        const { autoAddedAttractions, optionalAttractions } = req.includeCommonAttractions
            ? await this.fetchAttractions(ordered)
            : { autoAddedAttractions: {}, optionalAttractions: {} } as any;

        // Weather per day
        const weatherService = new WeatherService();
        const days: DayPlan[] = [];
        let activitiesTotal = 0;
        let accommodationTotal = 0;
        let transportDailyTotal = 0;
        const weatherNullDays: Array<{ date: string; destinationId: string; reason: string }> = [];
        for (let i = 0; i < ordered.length; i++) {
            const id = ordered[i];
            const dayDate = addUtcDays(new Date(startDate), i);
            const dateISO = toYmdUtc(dayDate);
            const weather = await this.fetchWeatherForDate(weatherService, id, dateISO);
            if (weather == null) {
                weatherNullDays.push({ date: dateISO, destinationId: id, reason: 'outside_5_day_forecast' });
            }

            // Hotel: check-in today, check-out next day, 2 per room
            const dest = idToDestination.get(id);
            const nextDate = addUtcDays(dayDate, 1);
            const roomQuantity = Math.ceil(people / 2);
            // Geocode-based hotels near destination center - try expanding radius if needed
            const lat = Number(dest?.center_lat);
            const lng = Number(dest?.center_lng);
            const ratings = this.mapBucketToRatings(req.priceBucket);
            
            // First try 5km radius with rating filter
            let nearby = await amadeus.searchHotelsByGeocode({ latitude: lat, longitude: lng, radius: 10, radiusUnit: 'KM', ratings, hotelSource: 'ALL' });
            
            // If few hotels found (less than 3), expand to 15km radius with same ratings
            if (!nearby || nearby.length < 3) {
                console.log(`[PackageService] Only ${nearby?.length || 0} hotels found in 5km, expanding to 15km`);
                const expanded = await amadeus.searchHotelsByGeocode({ latitude: lat, longitude: lng, radius: 15, radiusUnit: 'KM', ratings, hotelSource: 'ALL' });
                nearby = [...(nearby || []), ...(expanded || [])];
            }
            
            // If still few hotels, try without rating filter in 15km radius
            if (!nearby || nearby.length < 5) {
                console.log(`[PackageService] Only ${nearby?.length || 0} hotels found with ratings, removing rating filter`);
                const unfiltered = await amadeus.searchHotelsByGeocode({ latitude: lat, longitude: lng, radius: 15, radiusUnit: 'KM', ratings: [], hotelSource: 'ALL' });
                nearby = [...(nearby || []), ...(unfiltered || [])];
            }
            
            // Remove duplicates based on hotelId
            const uniqueHotels = nearby?.filter((hotel, index, self) => 
                index === self.findIndex(h => h.hotelId === hotel.hotelId)
            ) || [];
            
            const sortedNearby = uniqueHotels.sort((a: any, b: any) => (a.distanceKm || 0) - (b.distanceKm || 0));
            const topHotelIds = sortedNearby.slice(0, 15).map((h: any) => h.hotelId).filter(Boolean);
            
            console.log(`[PackageService] Found ${topHotelIds.length} hotels for ${dest?.name}: ${topHotelIds.join(', ')}`);

            // Fetch offers for the shortlist - try in batches if needed
            const boardType = req.priceBucket === 'budget_conscious' ? 'ROOM_ONLY' : 'BREAKFAST';
            const priceCap = pricingMap.get(id)?.accommodation_price || 0;
            const priceRange = this.buildPriceRangeForBucket(req.priceBucket, priceCap);
            
            let offers: any[] = [];
            if (topHotelIds.length > 0) {
                // Try hotels in batches of 5 to avoid overwhelming the API
                for (let batchStart = 0; batchStart < topHotelIds.length && offers.length === 0; batchStart += 5) {
                    const batchIds = topHotelIds.slice(batchStart, batchStart + 5);
                    console.log(`[PackageService] Trying hotel batch: ${batchIds.join(', ')}`);
                    
                    const batchOffers = await amadeus.getHotelOffers({
                        hotelIds: batchIds,
                        adults: people,
                        checkInDate: dateISO,
                        checkOutDate: toYmdUtc(nextDate),
                        roomQuantity: 1,
                        priceRange,
                        currency: 'INR',
                        boardType: boardType as any,
                        includeClosed: false,
                        bestRateOnly: true,
                        lang: 'EN'
                    });
                    
                    if (batchOffers && batchOffers.length > 0) {
                        offers = batchOffers;
                        console.log(`[PackageService] Found ${offers.length} offers in batch`);
                        break;
                    }
                }
            }

            hotelSuggestionsByDay[dateISO + ':' + id] = offers; // raw return as requested
            // pick cheapest across hotels
            const pick = (offers || []).map((o: any) => ({
                offer: o,
                price: Number(o?.offers?.[0]?.price?.total || o?.offers?.[0]?.price?.base || 0)
            }))
            .filter((x: any) => x.price > 0)
            .sort((a: any, b: any) => a.price - b.price)[0];
            const accommodationCost = pick?.price || 0;
            const selectedHotel = pick?.offer ? {
                name: pick.offer?.hotel?.name,
                rating: undefined,
                address: undefined,
                price: accommodationCost,
                currency: pick.offer?.offers?.[0]?.price?.currency,
                checkInDate: dateISO,
                checkOutDate: toYmdUtc(nextDate),
                roomQuantity: 1,
                hotelId: pick.offer?.hotel?.hotelId,
                latitude: pick.offer?.hotel?.latitude,
                longitude: pick.offer?.hotel?.longitude,
            } : null;
            accommodationCostsByDay[dateISO + ':' + id] = accommodationCost;
            accommodationTotal += accommodationCost;

            // Restaurants enriched
            const richRestaurants = (restaurantsByDest[id] || []).map((r: any) => ({ id: r.id, name: r.name, price_range: r.price_range, special_delicacies: r.special_delicacies, average_rating: r.average_rating, veg_non_veg: r.veg_non_veg, cuisine_types: r.cuisine_types, description: r.description }));

            // Activities enriched
            const actObjs: any[] = (autoAddedAttractions[id] || []).map((a: any) => ({ poiId: a.id, name: a.name, pricing_type: a.poi_pricing?.pricing_type, base_price: a.poi_pricing?.base_price ? Number(a.poi_pricing.base_price) : undefined, metadata: a.poi_pricing?.metadata }));
            const activitiesCost = actObjs.reduce((s, a) => {
                if (!a.base_price || a.pricing_type === 'free') return s;
                if (a.pricing_type === 'per_person') return s + a.base_price * people;
                return s + a.base_price;
            }, 0);
            activitiesTotal += activitiesCost;

            // Daily local transport cost from bucket
            const transportCost = (pricingMap.get(id)?.transport_price || 0) * people;
            transportDailyTotal += transportCost;

            const destinationName = dest?.name || 'Unknown Destination';
            days.push({
                date: dayDate.toISOString(),
                title: i === 0 ? 'Arrival & Check-in' : `Day ${i + 1} in ${destinationName}`,
                destinationId: id,
                destinationName,
                destinationAltitudeM: dest?.altitude_m ?? undefined,
                activities: actObjs,
                activitiesCost,
                hotel: selectedHotel || undefined,
                hotelOptions: hotelSuggestionsByDay[dateISO + ':' + id] || [],
                restaurantSuggestions: richRestaurants,
                transportCost,
                weather,
            });
        }

        // cab costs on legs using selected cab
        const cabSelection = await this.selectCab(req.priceBucket, people);
        let cabTotal = 0;
        for (const leg of legs) {
            const km = Number(leg.distanceKm || 0);
            const legCost = km * Number((cabSelection as any)?.base_price_per_km || 0);
            leg.cabCost = legCost;
            cabTotal += legCost;
        }

        // Available cabs for UI switching (capacity >= people, available)
        const availableCabs = await this.fetchAvailableCabs(people);

        const result: PackageGenerationResult = {
            title: this.buildTitle(ordered, idToDestination),
            startDate,
            people: req.people,
            cabType,
            totalBasePrice: accommodationTotal + transportDailyTotal + activitiesTotal + cabTotal,
            perPersonPrice: (accommodationTotal + transportDailyTotal + activitiesTotal + cabTotal) / people,
            days,
            legs,
            currency: 'INR',
            cabSelection: cabSelection ? { id: (cabSelection as any).id, type: cabType, estimatedCost: cabTotal } : { type: cabType, estimatedCost: cabTotal },
            optionalAttractions: Object.values(optionalAttractions).flat().map((a: any) => ({ poiId: a.id, name: a.name, price: a.poi_pricing?.base_price ? Number(a.poi_pricing.base_price) : undefined })),
            breakdown: { accommodation: accommodationTotal, transport: transportDailyTotal, activities: activitiesTotal, cab: cabTotal },
            meta: { weatherNullDays },
            availableCabs,
        };
        
        return result;
    }

    private resolveStartDate(start?: string): string {
        if (start) return new Date(start).toISOString();
        return addUtcDays(new Date(), 3).toISOString();
    }

    private presuggestCabType(people: number): CabType {
        if (people >= 7) return 'tempo';
        if (people >= 4) return 'suv';
        return 'sedan';
    }

    private async fetchPricingBuckets(ids: string[], bucket: PriceBucket) {
        const { data, error } = await this.db
            .from('destination_pricing_buckets')
            .select('destination_id, accommodation_price, transport_price, bucket_type')
            .eq('bucket_type', bucket)
            .in('destination_id', ids);
        if (error) return [];
        return data || [];
    }

    private async buildLegs(ordered: string[]): Promise<PackageLeg[]> {
        const legs: PackageLeg[] = [];
        for (let i = 0; i < ordered.length - 1; i++) {
            const origin = ordered[i];
            const dest = ordered[i + 1];
            const { data } = await this.db
                .from('destination_distance_matrix')
                .select('distance_km,duration_minutes')
                .eq('origin_id', origin)
                .eq('destination_id', dest)
                .maybeSingle();
            legs.push({
                originId: origin,
                destinationId: dest,
                distanceKm: data?.distance_km ? Number(data.distance_km) : undefined,
                durationMinutes: data?.duration_minutes || undefined,
            });
        }
        return legs;
    }

    private async fetchTopRestaurants(ids: string[], bucket: PriceBucket) {
        const priceMap: Record<PriceBucket, string> = {
            budget_conscious: 'budget',
            optimal: 'mid_range',
            go_crazy: 'premium',
        };
        const out: Record<string, any[]> = {};
        for (const id of ids) {
            const { data } = await this.db
                .from('restaurants')
                .select('id,name,average_rating,total_ratings,price_range,special_delicacies,veg_non_veg,cuisine_types,description')
                .eq('destination_id', id)
                .eq('price_range', priceMap[bucket])
                .order('average_rating', { ascending: false })
                .order('total_ratings', { ascending: false })
                .limit(3);
            out[id] = data || [];
        }
        return out;
    }

    private async fetchAttractions(ids: string[]) {
        const autoAdded: Record<string, any[]> = {};
        const optional: Record<string, any[]> = {};
        for (const id of ids) {
            const { data } = await this.db
                .from('pois')
                .select('id,name,average_rating,poi_pricing:poi_pricing(base_price,is_purchasable,pricing_type,metadata)')
                .eq('destination_id', id);
            const purchasable = (data || []).filter((p: any) => p.poi_pricing?.is_purchasable);
            autoAdded[id] = purchasable.sort((a: any, b: any) => (b.average_rating || 0) - (a.average_rating || 0)).slice(0, 3);
            optional[id] = purchasable.filter((p: any) => !autoAdded[id].find((a: any) => a.id === p.id));
        }
        return { autoAddedAttractions: autoAdded, optionalAttractions: optional };
    }

    private async fetchWeatherForDate(weatherService: WeatherService, destinationId: string, dateISO: string) {
        try {
            console.log(`[PackageService] Checking weather cache for ${dateISO}...`);
            
            // First, check what dates exist in the database for this destination
            const { data: allSnapshots } = await this.db
                .from('weather_snapshots')
                .select('snapshot_date')
                .eq('destination_id', destinationId)
                .order('snapshot_date', { ascending: true });
            
            if (allSnapshots && allSnapshots.length > 0) {
                const dates = allSnapshots.map((s: any) => s.snapshot_date).join(', ');
                console.log(`[PackageService] Existing weather snapshots for destination: ${dates}`);
            } else {
                console.log(`[PackageService] No weather snapshots found in database for this destination`);
            }
            
            const { data, error } = await this.db
                .from('weather_snapshots')
                .select('mapped,snapshot_date,is_final')
                .eq('destination_id', destinationId)
                .eq('snapshot_date', dateISO)
                .maybeSingle();
            
            if (error) {
                console.error(`[PackageService] Error fetching weather for ${dateISO}:`, error);
            }
            
            if (data && (data as any).mapped?.daily?.length) {
                console.log(`[PackageService] ✓ Weather data found in cache for ${dateISO}`);
                return (data as any).mapped.daily[0] || null;
            }
            
            // Populate efficiently using full forecast window (saves next ~5 days in one call)
            console.log(`[PackageService] Weather data not found for ${dateISO}, fetching full forecast window...`);
            await weatherService.fetchAndStoreForDestination(destinationId, false);
            
            const { data: after, error: afterError } = await this.db
                .from('weather_snapshots')
                .select('mapped')
                .eq('destination_id', destinationId)
                .eq('snapshot_date', dateISO)
                .maybeSingle();
            
            if (afterError) {
                console.error(`[PackageService] Error fetching weather after save for ${dateISO}:`, afterError);
            } else if (after) {
                console.log(`[PackageService] ✓ Weather data saved and retrieved for ${dateISO}`);
            } else {
                console.warn(`[PackageService] ⚠ Weather data not found after save for ${dateISO}`);
            }
            
            return (after as any)?.mapped?.daily?.[0] || null;
        } catch (err: any) {
            console.error(`[PackageService] Error in fetchWeatherForDate for ${dateISO}:`, err.message, err);
            return null;
        }
    }

    private filterHotelsByBucket(hotels: any[], bucket: PriceBucket) {
        if (!hotels || !hotels.length) return [];
        // Not used for geocode search (ratings sent as filter); keep as fallback
        if (bucket === 'budget_conscious') return hotels.filter((h) => (h.rating || 0) <= 3.5);
        if (bucket === 'optimal') return hotels.filter((h) => Math.round(h.rating || 0) === 4);
        return hotels.filter((h) => Math.round(h.rating || 0) >= 5);
    }

    private async selectCab(bucket: PriceBucket, people: number) {
        const typeOrder: CabType[] = people >= 7 ? ['tempo', 'suv', 'sedan'] : people >= 4 ? ['suv', 'sedan'] : ['sedan'];
        const { data } = await this.db
            .from('cab_inventory')
            .select('id,cab_type,base_price_per_km,per_day_charge,capacity,model_year')
            .gte('capacity', people)
            .eq('is_available', true);
        if (!data || !data.length) return null as any;
        let sorted = data.filter((c: any) => typeOrder.includes(c.cab_type));
        if (bucket === 'budget_conscious') sorted = sorted.sort((a: any, b: any) => a.base_price_per_km - b.base_price_per_km);
        if (bucket === 'optimal') sorted = sorted.sort((a: any, b: any) => a.base_price_per_km - b.base_price_per_km || b.model_year - a.model_year);
        if (bucket === 'go_crazy') sorted = sorted.sort((a: any, b: any) => b.model_year - a.model_year || a.base_price_per_km - b.base_price_per_km);
        return sorted[0];
    }

    private async fetchAvailableCabs(people: number) {
        const { data, error } = await this.db
            .from('cab_inventory')
            .select('id,cab_type,make,model,per_day_charge,capacity,is_available')
            .gte('capacity', people)
            .eq('is_available', true);
        if (error || !data) return [];
        // Sort by cab_type then by per_day_charge asc
        const orderIndex: Record<CabType, number> = { hatchback: 0, sedan: 1, suv: 2, tempo: 3 };
        const sorted = [...data].sort((a: any, b: any) => {
            const t = (orderIndex[a.cab_type as CabType] ?? 99) - (orderIndex[b.cab_type as CabType] ?? 99);
            if (t !== 0) return t;
            return Number(a.per_day_charge || 0) - Number(b.per_day_charge || 0);
        });
        return sorted.map((c: any) => ({
            id: c.id,
            type: c.cab_type as CabType,
            make: c.make,
            model: c.model,
            pricePerDay: c.per_day_charge ? Number(c.per_day_charge) : undefined,
            capacity: Number(c.capacity || 0),
        }));
    }

    private mapBucketToRatings(bucket: PriceBucket): string[] {
        if (bucket === 'budget_conscious') return ['2', '3'];
        if (bucket === 'optimal') return ['4'];
        return ['5'];
    }

    private buildPriceRangeForBucket(bucket: PriceBucket, cap: number): string | undefined {
        const rounded = Math.max(0, Math.round(Number(cap || 0)));
        if (rounded <= 0) return undefined;
        
        // Amadeus expects priceRange in format "min-max" or just "min" for lower bound
        if (bucket === 'budget_conscious') {
            // Budget: 0 to cap (e.g., "0-2000")
            return `0-${rounded}`;
        } else if (bucket === 'optimal') {
            // Optimal: 0 to cap (e.g., "0-3500") 
            return `0-${rounded}`;
        } else {
            // go_crazy: minimum bound only (e.g., "3500" means 3500+)
            return String(rounded);
        }
    }
    private buildDays(startDateISO: string, ordered: string[], idToDestination: Map<string, any>, activities: ActivityWithPrice[]): DayPlan[] {
        const start = new Date(startDateISO);
        const days: DayPlan[] = [];
        for (let i = 0; i < ordered.length; i++) {
            const id = ordered[i];
            const date = addUtcDays(start, i);
            const dest = idToDestination.get(id);
            const destinationName = dest?.name || 'Unknown Destination';
            const title = i === 0 ? 'Arrival & Check-in' : `Day ${i + 1} in ${destinationName}`;
            days.push({
                date: date.toISOString(),
                title,
                destinationId: id,
                destinationName,
                destinationAltitudeM: dest?.altitude_m ?? undefined,
                activities: [...activities],
                restaurantSuggestions: [],
            });
        }
        return days;
    }

    private buildTitle(ordered: string[], idToDestination: Map<string, any>): string {
        const names = ordered.map((id) => idToDestination.get(id)?.name).filter(Boolean);
        return names.length ? `${names.join(' • ')} Getaway` : 'Kashmir Getaway';
    }

    /**
     * Persist the generated package in normalized tables with FKs to original entities.
     */
    private async persistPackage(pkg: PackageGenerationResult, req: GeneratePackageRequest, userId?: string): Promise<string> {
        // Build denormalized references from the generated response
        const destinationIds = Array.from(new Set((pkg.days || []).map((d) => d.destinationId)));
        const activitiesRefs = (pkg.days || []).flatMap((d, idx) =>
            (d.activities || [])
                .filter((a) => !!a.poiId)
                .map((a) => ({
                    day_index: idx,
                    destination_id: d.destinationId,
                    poi_id: a.poiId,
                    name: a.name,
                }))
        );
        const restaurantRefs = (pkg.days || []).flatMap((d, idx) =>
            (d.restaurantSuggestions || [])
                .filter((r: any) => !!r.id)
                .map((r: any) => ({
                    day_index: idx,
                    destination_id: d.destinationId,
                    restaurant_id: r.id,
                    name: r.name,
                }))
        );

        // 1) Save packages row
        const { data: pkgRow, error: pkgErr } = await this.db
            .from('packages')
            .insert({
                title: pkg.title,
                start_date: pkg.startDate,
                people: pkg.people,
                cab_type: pkg.cabType,
                total_base_price: pkg.totalBasePrice,
                per_person_price: pkg.perPersonPrice,
                currency: pkg.currency,
                user_id: userId || null, // Save user_id if user is authenticated (even if not verified)
                request: {
                    destinationIds: req.destinationIds,
                    people: req.people,
                    priceBucket: req.priceBucket,
                    activities: req.activities,
                    includeCommonAttractions: req.includeCommonAttractions,
                    startDate: req.startDate,
                },
                breakdown: pkg.breakdown || {},
                meta: {
                    ...(pkg.meta || {}),
                    ...(req.clonedFrom ? { clonedFrom: req.clonedFrom } : {})
                },
                available_cabs: pkg.availableCabs || [],
                destination_ids: destinationIds,
                activities_refs: activitiesRefs,
                restaurant_refs: restaurantRefs,
            })
            .select('id')
            .maybeSingle();
        if (pkgErr || !pkgRow) throw new Error(pkgErr?.message || 'Failed to insert package');
        const packageId: string = (pkgRow as any).id;

        // 2) Save legs
        if (pkg.legs && pkg.legs.length) {
            const legRows = pkg.legs.map((l) => ({
                package_id: packageId,
                origin_id: l.originId,
                destination_id: l.destinationId,
                distance_km: l.distanceKm ?? null,
                duration_minutes: l.durationMinutes ?? null,
                cab_cost: (l as any).cabCost ?? null,
            }));
            const { error: legsErr } = await this.db.from('package_legs').insert(legRows);
            if (legsErr) console.error('[PackageService] Failed to insert package legs:', legsErr.message);
        }

        // Helper to lookup weather snapshot id for a given day/destination
        const getWeatherSnapshotId = async (destinationId: string, isoDate: string): Promise<string | null> => {
            const ymd = isoDate.slice(0, 10);
            const { data, error } = await this.db
                .from('weather_snapshots')
                .select('id')
                .eq('destination_id', destinationId)
                .eq('snapshot_date', ymd)
                .maybeSingle();
            if (error) return null;
            return (data as any)?.id ?? null;
        };

        // 3) Save days and their nested entities
        const weatherSnapshotIds: string[] = [];
        for (let i = 0; i < (pkg.days || []).length; i++) {
            const d = pkg.days[i];
            const ymd = d.date.slice(0, 10);
            const weatherSnapshotId = d.weather ? await getWeatherSnapshotId(d.destinationId, d.date) : null;
            if (weatherSnapshotId) weatherSnapshotIds.push(weatherSnapshotId);
            const { data: dayRow, error: dayErr } = await this.db
                .from('package_days')
                .insert({
                    package_id: packageId,
                    day_index: i,
                    date: ymd,
                    title: d.title,
                    destination_id: d.destinationId,
                    destination_name: d.destinationName,
                    destination_altitude_m: d.destinationAltitudeM ?? null,
                    activities_cost: d.activitiesCost ?? null,
                    transport_cost: d.transportCost ?? null,
                    leg_transport_cost: d.legTransportCost ?? null,
                    hotel: d.hotel ? (d.hotel as any) : null,
                    hotel_options: d.hotelOptions ? (d.hotelOptions as any) : null,
                    weather_snapshot_id: weatherSnapshotId,
                    weather_daily: d.weather ? (d.weather as any) : null,
                })
                .select('id')
                .maybeSingle();
            if (dayErr || !dayRow) {
                console.error('[PackageService] Failed to insert package day:', dayErr?.message || 'unknown');
                continue;
            }
            const packageDayId: string = (dayRow as any).id;

            // 3.0) Join package_destinations for strict FK per day
            await this.db
                .from('package_destinations')
                .upsert({
                    package_id: packageId,
                    day_index: i,
                    destination_id: d.destinationId,
                });

            // 3.a) Activities
            if (d.activities && d.activities.length) {
                const activityRows = d.activities
                    .filter((a) => !!a.poiId)
                    .map((a) => ({
                        package_day_id: packageDayId,
                        poi_id: a.poiId,
                        name: a.name,
                        pricing_type: a.pricing_type ?? null,
                        base_price: a.base_price ?? null,
                        metadata: a.metadata ?? {},
                    }));
                const { error: actErr } = await this.db.from('package_day_activities').insert(activityRows);
                if (actErr) console.error('[PackageService] Failed to insert day activities:', actErr.message);
            }

            // 3.b) Restaurants (suggestions)
            if (d.restaurantSuggestions && d.restaurantSuggestions.length) {
                const restRows = d.restaurantSuggestions
                    .filter((r: any) => !!r.id)
                    .map((r: any) => ({
                        package_day_id: packageDayId,
                        restaurant_id: r.id,
                        name: r.name,
                        price_range: r.price_range ?? null,
                        suggestion: r,
                    }));
                const { error: restErr } = await this.db.from('package_day_restaurants').insert(restRows);
                if (restErr) console.error('[PackageService] Failed to insert day restaurants:', restErr.message);
            }
        }

        // 4) Update packages with aggregated weather snapshot ids (deduplicated)
        if (weatherSnapshotIds.length) {
            const distinctWeatherIds = Array.from(new Set(weatherSnapshotIds));
            await this.db.from('packages').update({ weather_snapshot_ids: distinctWeatherIds }).eq('id', packageId);
        }

        return packageId;
    }

    /**
     * Update package configuration (Cab, Hotels) and recalculate prices
     */
    async updateConfiguration(packageId: string, config: UpdatePackageConfigurationRequest): Promise<PackageGenerationResult> {
        const { startDate, cabId, dayConfigurations, is_public } = config;

        // 1. Fetch package and verify status
        const { data: pkg, error: pkgErr } = await this.db
            .from('packages')
            .select('*')
            .eq('id', packageId)
            .single();

        if (pkgErr || !pkg) throw new Error('Package not found');
        if (pkg.booking_status === 'booked') throw new Error('Cannot modify a booked package');

        // Handle simple is_public update if no other structural changes are requested
        if (is_public !== undefined && !startDate && !cabId && (!dayConfigurations || dayConfigurations.length === 0)) {
            const { error: updateErr } = await this.db
                .from('packages')
                .update({ is_public })
                .eq('id', packageId);
            
            if (updateErr) throw new Error(updateErr.message);
            
            // Return updated structure
            const updated = await this.getById(packageId);
            return updated;
        }

        // If structural changes (startDate) cause regeneration, ensure is_public update is also applied if present.
        if (is_public !== undefined) {
             const { error: pubErr } = await this.db
                .from('packages')
                .update({ is_public })
                .eq('id', packageId);
             if (pubErr) throw new Error(pubErr.message);
        }

        // 2. Fetch legs and days for updating
        const { data: legs, error: legsErr } = await this.db
            .from('package_legs')
            .select('*')
            .eq('package_id', packageId)
            .order('origin_id');

        const { data: days, error: daysErr } = await this.db
            .from('package_days')
            .select('*')
            .eq('package_id', packageId)
            .order('day_index', { ascending: true });

        if (legsErr || daysErr) throw new Error('Failed to load package details');

        let updated = false;

        // 0. Handle Reschedule (Date Change) - Major Update
        if (config.startDate) {
            // Restore original request parameters
            const originalReq = (pkg.request as any) || {};
            // If request definition is missing, we can't faithfully regenerate. 
            // Fallback to simple properties if necessary, but 'request' column is reliable in new packages.
            
            const regenerateReq: GeneratePackageRequest = {
                destinationIds: originalReq.destinationIds || [],
                people: originalReq.people || pkg.people || 1,
                priceBucket: originalReq.priceBucket || 'optimal',
                activities: originalReq.activities || [],
                includeCommonAttractions: originalReq.includeCommonAttractions ?? true,
                startDate: config.startDate, // Apply new date
            };

            console.log(`[PackageService] Rescheduling package ${packageId} to ${config.startDate}`);

            // Regenerate content
            const newContent = await this.generatePackageContent(regenerateReq);

            // Re-Persist (Overwrite) Logic
            // 1. Update Package Header
            await this.db.from('packages').update({
                title: newContent.title,
                start_date: newContent.startDate,
                people: newContent.people,
                cab_type: newContent.cabType,
                total_base_price: newContent.totalBasePrice,
                per_person_price: newContent.perPersonPrice,
                currency: newContent.currency,
                request: regenerateReq, // update request with new date
                breakdown: newContent.breakdown || {},
                meta: newContent.meta || {},
                available_cabs: newContent.availableCabs || [],
                // Re-calculate refs
                // We'll trust trigger/logic, or we could update activities_refs here too for completeness
            }).eq('id', packageId);

            // 2. Overwrite Legs (Delete & Insert)
            await this.db.from('package_legs').delete().eq('package_id', packageId);
            if (newContent.legs && newContent.legs.length) {
                const legRows = newContent.legs.map((l) => ({
                    package_id: packageId,
                    origin_id: l.originId,
                    destination_id: l.destinationId,
                    distance_km: l.distanceKm ?? null,
                    duration_minutes: l.durationMinutes ?? null,
                    cab_cost: (l as any).cabCost ?? null,
                }));
                await this.db.from('package_legs').insert(legRows);
            }

            // 3. Overwrite Days (Delete & Insert - Cascades to activities/restaurants)
            await this.db.from('package_days').delete().eq('package_id', packageId);
            await this.db.from('package_destinations').delete().eq('package_id', packageId);

            for (let i = 0; i < (newContent.days || []).length; i++) {
                const d = newContent.days[i];
                const ymd = d.date.slice(0, 10);
                
                // Helper to lookup weather snapshot id for a given day/destination
                const getWeatherSnapshotId = async (destinationId: string, isoDate: string): Promise<string | null> => {
                    const ymd = isoDate.slice(0, 10);
                    const { data, error } = await this.db.from('weather_snapshots').select('id').eq('destination_id', destinationId).eq('snapshot_date', ymd).maybeSingle();
                    return (data as any)?.id ?? null;
                };

                const weatherSnapshotId = d.weather ? await getWeatherSnapshotId(d.destinationId, d.date) : null;
                
                const { data: dayRow } = await this.db
                    .from('package_days')
                    .insert({
                        package_id: packageId,
                        day_index: i,
                        date: ymd,
                        title: d.title,
                        destination_id: d.destinationId,
                        destination_name: d.destinationName,
                        destination_altitude_m: d.destinationAltitudeM ?? null,
                        activities_cost: d.activitiesCost ?? null,
                        transport_cost: d.transportCost ?? null,
                        leg_transport_cost: d.legTransportCost ?? null,
                        hotel: d.hotel ? (d.hotel as any) : null,
                        hotel_options: d.hotelOptions ? (d.hotelOptions as any) : null,
                        weather_snapshot_id: weatherSnapshotId,
                        weather_daily: d.weather ? (d.weather as any) : null,
                    })
                    .select('id')
                    .single();
                
                if (dayRow) {
                    const packageDayId = (dayRow as any).id;
                    // destinations join
                    await this.db.from('package_destinations').insert({ package_id: packageId, day_index: i, destination_id: d.destinationId });
                    
                    // Activities
                    if (d.activities && d.activities.length) {
                        const activityRows = d.activities
                            .filter((a) => !!a.poiId)
                            .map((a) => ({
                                package_day_id: packageDayId,
                                poi_id: a.poiId,
                                name: a.name,
                                pricing_type: a.pricing_type,
                                base_price: a.base_price,
                                metadata: a.metadata,
                            }));
                        if (activityRows.length) await this.db.from('package_day_activities').insert(activityRows);
                    }
                    // Restaurants
                    if (d.restaurantSuggestions && d.restaurantSuggestions.length) {
                         const restaurantRows = d.restaurantSuggestions
                            .filter((r: any) => !!r.id)
                            .map((r: any) => ({
                                package_day_id: packageDayId,
                                restaurant_id: r.id,
                                name: r.name,
                                suggestion: r,
                            }));
                        if (restaurantRows.length) await this.db.from('package_day_restaurants').insert(restaurantRows);
                    }
                }
            }
            
            // Sync refs (duplicating logic for robustness)
            const activitiesRefs = (newContent.days || []).flatMap((d, idx) =>
                (d.activities || []).filter((a) => !!a.poiId).map((a) => ({ day_index: idx, destination_id: d.destinationId, poi_id: a.poiId, name: a.name }))
            );
             const restaurantRefs = (newContent.days || []).flatMap((d, idx) =>
                (d.restaurantSuggestions || []).filter((r: any) => !!r.id).map((r: any) => ({ day_index: idx, destination_id: d.destinationId, restaurant_id: r.id, name: r.name }))
            );
            await this.db.from('packages').update({ activities_refs: activitiesRefs, restaurant_refs: restaurantRefs }).eq('id', packageId);

            // Since we completely regenerated, we can return early or allow further minor tweaks? 
            // Usually valid to return here as subsequent tweaks (e.g. specific hotel swap) 
            // would be overwritten by default logic if passed in same request, 
            // BUT if user passed { startDate: '...', dayConfigurations: [...] }, they expect both.
            // Complex! Let's assume for now Reschedule is a primary action. 
            // If we want to support both, we must reload 'days/legs' variables...
            
            // Reload context for potential further updates
            const { data: freshLegs } = await this.db.from('package_legs').select('*').eq('package_id', packageId).order('origin_id');
            const { data: freshDays } = await this.db.from('package_days').select('*').eq('package_id', packageId).order('day_index', { ascending: true });
            if (freshLegs) legs.splice(0, legs.length, ...freshLegs);
            if (freshDays) days.splice(0, days.length, ...freshDays);
            
            // Update local pkg object for subsequent logic
            pkg.available_cabs = newContent.availableCabs;
            pkg.breakdown = newContent.breakdown;
            pkg.people = newContent.people;
            pkg.total_base_price = newContent.totalBasePrice;
            pkg.cab_type = newContent.cabType;
            updated = true;
        }



        // 3. Handle Cab Update
        if (config.cabId) {
            const availableCabs: any[] = pkg.available_cabs || [];
            const selectedCab = availableCabs.find((c) => c.id === config.cabId);

            if (selectedCab) {
                // Fetch fresh cab details for pricing (base_price_per_km)
                // We need to look up the inventory to get the per-km rate which might not be in the JSON snapshot
                // Or we can rely on availableCabs if we trust it, but availableCabs usually only has per_day_charge?
                // `fetchAvailableCabs` selects `per_day_charge`.
                // `selectCab` uses `base_price_per_km`.
                // We need `base_price_per_km` to recalc leg costs.
                const { data: cabInventory } = await this.db
                    .from('cab_inventory')
                    .select('base_price_per_km')
                    .eq('id', config.cabId)
                    .single();

                if (cabInventory) {
                    pkg.cab_type = selectedCab.type;
                    
                    let newCabTotal = 0;
                    for (const leg of legs || []) {
                        const legCost = (Number(leg.distance_km) || 0) * Number(cabInventory.base_price_per_km);
                        leg.cab_cost = legCost;
                        newCabTotal += legCost;
                        // Update leg in DB
                        await this.db.from('package_legs').update({ cab_cost: legCost }).eq('id', leg.id);
                    }
                    pkg.breakdown.cab = newCabTotal;
                    updated = true;
                }
            }
        }

        // 4. Handle Hotel Update
        if (config.dayConfigurations && config.dayConfigurations.length > 0) {
            let accommodationTotal = 0;

            for (const day of days || []) {
                const dayConfig = config.dayConfigurations.find((d) => d.dayIndex === day.day_index);

                if (dayConfig && dayConfig.hotelId) {
                    const options = day.hotel_options || [];
                    const targetOffer = options.find((o: any) => o.hotel?.hotelId === dayConfig.hotelId);

                    if (targetOffer) {
                        const price = Number(targetOffer.offers?.[0]?.price?.total || targetOffer.offers?.[0]?.price?.base || 0);
                        const newHotel = {
                            name: targetOffer.hotel?.name,
                            // Preserve extra fields if needed or take from offer
                            currency: targetOffer.offers?.[0]?.price?.currency,
                            price: price,
                            checkInDate: day.hotel?.checkInDate,
                            checkOutDate: day.hotel?.checkOutDate,
                            roomQuantity: day.hotel?.roomQuantity,
                            hotelId: targetOffer.hotel?.hotelId,
                            latitude: targetOffer.hotel?.latitude,
                            longitude: targetOffer.hotel?.longitude,
                        };
                        day.hotel = newHotel;
                        // Update day in DB
                        await this.db.from('package_days').update({ hotel: newHotel }).eq('id', day.id);
                    }
                }
                // Recalculate total from current (potentially updated) hotel
                accommodationTotal += Number(day.hotel?.price || 0);
            }
            pkg.breakdown.accommodation = accommodationTotal;
            updated = true;
        }

        // 5. Handle Activities Update
        if (config.dayConfigurations && config.dayConfigurations.length > 0) {
            let activitiesTotal = 0;
            const packageId = pkg.id;

            for (const day of days || []) {
                const dayConfig = config.dayConfigurations.find((d) => d.dayIndex === day.day_index);

                if (dayConfig && dayConfig.activityIds !== undefined && Array.isArray(dayConfig.activityIds)) {
                     // 5.1. Delete existing activities for this day
                    await this.db
                        .from('package_day_activities')
                        .delete()
                        .eq('package_day_id', day.id);

                    // 5.2. Insert new activities
                    const newActivities: any[] = [];
                    let dailyActivitiesCost = 0;

                    if (dayConfig.activityIds.length > 0) {
                        const { data: pois } = await this.db
                            .from('pois')
                            .select('id,name,poi_pricing:poi_pricing(base_price,pricing_type,metadata)')
                            .in('id', dayConfig.activityIds);
                        
                        const poiMap = new Map((pois || []).map((p: any) => [p.id, p]));

                        for (const poiId of dayConfig.activityIds) {
                            const poi = poiMap.get(poiId);
                            if (poi) {
                                const pricing = (poi.poi_pricing as any);
                                const basePrice = pricing?.base_price ? Number(pricing.base_price) : 0;
                                const pricingType = pricing?.pricing_type || 'one_time';
                                let cost = 0;
                                if (pricingType === 'per_person') {
                                    cost = basePrice * Number(pkg.people || 1);
                                } else if (pricingType !== 'free') {
                                    cost = basePrice; // one_time, rental, etc.
                                }
                                
                                dailyActivitiesCost += cost;

                                newActivities.push({
                                    package_day_id: day.id,
                                    poi_id: poi.id,
                                    name: poi.name,
                                    pricing_type: pricingType,
                                    base_price: basePrice,
                                    metadata: pricing?.metadata
                                });
                            }
                        }

                        if (newActivities.length > 0) {
                            await this.db.from('package_day_activities').insert(newActivities);
                        }
                    }

                    // 5.3. Update day cost
                    day.activities_cost = dailyActivitiesCost;
                    await this.db.from('package_days').update({ activities_cost: dailyActivitiesCost }).eq('id', day.id);
                }
                
                // Recalculate total loop (either updated or existing value)
                activitiesTotal += Number(day.activities_cost || 0);
            }
            pkg.breakdown.activities = activitiesTotal;
            updated = true;

            // 5.4 Sync activities_refs (denormalized column)
            const { data: allActivities } = await this.db
                .from('package_day_activities')
                .select('package_day_id, poi_id, name')
                .in('package_day_id', days.map(d => d.id));
            
            if (allActivities) {
                const dayIdMap = new Map(days.map(d => [d.id, d]));
                const newRefs = allActivities.map(a => {
                    const d = dayIdMap.get(a.package_day_id);
                    return {
                        day_index: d?.day_index,
                        destination_id: d?.destination_id,
                        poi_id: a.poi_id,
                        name: a.name
                    };
                });
                await this.db.from('packages').update({ activities_refs: newRefs }).eq('id', packageId);
            }
        }

        if (updated) {
            const total =
                Number(pkg.breakdown.accommodation || 0) +
                Number(pkg.breakdown.transport || 0) +
                Number(pkg.breakdown.activities || 0) +
                Number(pkg.breakdown.cab || 0);

            pkg.total_base_price = total;
            pkg.per_person_price = total / Number(pkg.people || 1);

            await this.db
                .from('packages')
                .update({
                    cab_type: pkg.cab_type,
                    breakdown: pkg.breakdown,
                    total_base_price: pkg.total_base_price,
                    per_person_price: pkg.per_person_price,
                })
                .eq('id', packageId);
        }

        // Return fresh full object
        return this.getById(packageId);
    }


    /**
     * Clone an existing package with a new start date
     */
    async clonePackage(sourcePackageId: string, cloneDate: string, userId?: string): Promise<PackageGenerationResult> {
        // 1. Fetch source package
        const { data: pkg, error } = await this.db
            .from('packages')
            .select('*')
            .eq('id', sourcePackageId)
            .single();

        if (error || !pkg) throw new Error('Source package not found');

        // 2. Access control is handled in controller, but here we just need the data.
        // The controller should verify if user can access this package (is_public or owner).
        
        // 3. Construct new generation request
        const originalReq = (pkg.request as any) || {};
        const newReq: GeneratePackageRequest = {
            destinationIds: originalReq.destinationIds || [],
            people: originalReq.people || pkg.people || 1,
            priceBucket: originalReq.priceBucket || 'optimal',
            activities: originalReq.activities || [],
            includeCommonAttractions: originalReq.includeCommonAttractions ?? true,
            startDate: cloneDate,
            clonedFrom: sourcePackageId,
        };

        // 4. Generate new package (this handles persistence)
        // Use userId from parameter (cloning user) or fallback to source package user_id
        return this.generate(newReq, userId || (pkg as any).user_id || undefined);
    }

    async getUserBookings(userId: string, limit: number = 5): Promise<BookingHistoryItem[]> {
        // 1. Fetch user's packages
        const { data: packages, error } = await this.db
            .from('packages')
            .select(`
                id, 
                title, 
                start_date, 
                people, 
                total_base_price, 
                currency, 
                booking_status, 
                destination_ids,
                package_days(id)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw new Error(`Failed to fetch bookings: ${error.message}`);
        if (!packages || packages.length === 0) return [];

        // 2. Fetch destination images (batch)
        const firstDestinationIds = packages
            .map((p) => (p.destination_ids && p.destination_ids.length > 0 ? p.destination_ids[0] : null))
            .filter(Boolean) as string[];

        const uniqueDestIds = Array.from(new Set(firstDestinationIds));
        const destImageMap = new Map<string, string>();

        if (uniqueDestIds.length > 0) {
            const { data: dests } = await this.db
                .from('vw_destinations_public') // Use public view as in generate
                .select('id, images')
                .in('id', uniqueDestIds);
            
            dests?.forEach((d: any) => {
                if (d.images && Array.isArray(d.images) && d.images.length > 0) {
                    destImageMap.set(d.id, d.images[0]);
                }
            });
        }

        // 3. Map to BookingHistoryItem
        return packages.map((pkg: any) => {
             // Calculate end date rough estimate based on package_days count or just return start_date relative
             // Let's infer duration from package_days count
             const duration = pkg.package_days ? pkg.package_days.length : 1; 
             const start = new Date(pkg.start_date);
             const end = addUtcDays(start, duration - 1); // 4 days means start + 3

             return {
                 packageId: pkg.id,
                 title: pkg.title,
                 startDate: pkg.start_date,
                 endDate: end.toISOString(),
                 status: pkg.booking_status,
                 totalPrice: pkg.total_base_price,
                 currency: pkg.currency || 'INR',
                 people: pkg.people,
                 destinationImage: pkg.destination_ids && pkg.destination_ids.length > 0 ? destImageMap.get(pkg.destination_ids[0]) : undefined
             };
        });
    }

    async getById(packageId: string): Promise<PackageGenerationResult> {
        const { data: pkg, error } = await this.db
            .from('packages')
            .select(`
                *,
                package_legs(*),
                package_days(
                    *,
                    package_day_activities(*),
                    package_day_restaurants(*)
                )
            `)
            .eq('id', packageId)
            .single();

        if (error || !pkg) throw new Error('Package not found');

        const days: DayPlan[] = (pkg.package_days || [])
            .map((pd: any) => ({
                date: pd.date,
                title: pd.title,
                destinationId: pd.destination_id,
                destinationName: pd.destination_name,
                destinationAltitudeM: pd.destination_altitude_m,
                activities: (pd.package_day_activities || []).map((a: any) => ({
                    poiId: a.poi_id,
                    name: a.name,
                    pricing_type: a.pricing_type,
                    base_price: a.base_price,
                    metadata: a.metadata,
                })),
                activitiesCost: pd.activities_cost,
                hotel: pd.hotel,
                hotelOptions: pd.hotel_options,
                restaurantSuggestions: (pd.package_day_restaurants || []).map((r: any) => r.suggestion),
                transportCost: pd.transport_cost,
                legTransportCost: pd.leg_transport_cost,
                weather: pd.weather_daily,
            }))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const legs: PackageLeg[] = (pkg.package_legs || []).map((pl: any) => ({
            originId: pl.origin_id,
            destinationId: pl.destination_id,
            distanceKm: pl.distance_km,
            durationMinutes: pl.duration_minutes,
            cabCost: pl.cab_cost,
        }));

        // Calculate clone stats
        // Note: Querying JSONB for count might be slow on large datasets without an index.
        const { count, error: countErr } = await this.db
             .from('packages')
             .select('id', { count: 'exact', head: true })
             .eq('meta->>clonedFrom', packageId);

        const clonedCount = count || 0;
        const isPopular = clonedCount >= 5; // Threshold for popularity

        return {
            packageId: pkg.id,
            title: pkg.title,
            startDate: pkg.start_date,
            people: pkg.people,
            cabType: pkg.cab_type,
            totalBasePrice: pkg.total_base_price,
            perPersonPrice: pkg.per_person_price,
            currency: pkg.currency,
            days,
            legs,
            cabSelection: { type: pkg.cab_type, estimatedCost: pkg.breakdown?.cab },
            availableCabs: pkg.available_cabs,
            meta: pkg.meta,
            breakdown: pkg.breakdown,
            optionalAttractions: [], // Omitted
            is_public: pkg.is_public,
            stats: {
                clonedCount,
                isPopular
            }
        };
    }
}