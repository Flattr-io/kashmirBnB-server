import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { GeneratePackageRequest, PackageGenerationResult, CabType, DayPlan, PackageLeg, PriceBucket, ActivityWithPrice } from '../interfaces/package.interface';
import { AmadeusService } from './amadeus.service';
import { WeatherService } from './weather.service';

export class PackageService {
    private get db(): SupabaseClient {
        return getDB();
    }

    async generate(req: GeneratePackageRequest): Promise<PackageGenerationResult> {
        const destinationIds = (req.destinationIds || []).filter(Boolean);
        if (destinationIds.length === 0) {
            throw new Error('destinationIds must be non-empty');
        }

        const startDate = this.resolveStartDate(req.startDate);
        const cabType = this.presuggestCabType(req.people);

        const { data: destinations } = await this.db
            .from('vw_destinations_public')
            .select('id,name,slug,base_price,metadata,center_lat,center_lng')
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
        for (let i = 0; i < ordered.length; i++) {
            const id = ordered[i];
            const dayDate = new Date(startDate);
            dayDate.setDate(dayDate.getDate() + i);
            const dateISO = dayDate.toISOString().slice(0,10);
            const weather = await this.fetchWeatherForDate(weatherService, id, dateISO);

            // Hotel: check-in today, check-out next day, 2 per room
            const dest = idToDestination.get(id);
            const nextDate = new Date(dayDate);
            nextDate.setDate(nextDate.getDate() + 1);
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
                        checkOutDate: nextDate.toISOString().slice(0,10),
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
                checkOutDate: nextDate.toISOString().slice(0,10),
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

            days.push({
                date: dayDate.toISOString(),
                title: i === 0 ? 'Arrival & Check-in' : `Day ${i + 1} in ${idToDestination.get(id)?.name || 'Destination'}`,
                destinationId: id,
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

        return {
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
        };
    }

    private resolveStartDate(start?: string): string {
        if (start) return new Date(start).toISOString();
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString();
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
            const { data, error } = await this.db
                .from('weather_snapshots')
                .select('mapped,snapshot_date,is_final')
                .eq('destination_id', destinationId)
                .eq('snapshot_date', dateISO)
                .maybeSingle();
            if (data) return data.mapped;
            await weatherService.fetchAndStoreForDestinationDate(destinationId, dateISO, false);
            const { data: after } = await this.db
                .from('weather_snapshots')
                .select('mapped')
                .eq('destination_id', destinationId)
                .eq('snapshot_date', dateISO)
                .maybeSingle();
            return after?.mapped || null;
        } catch {
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
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dest = idToDestination.get(id);
            const title = i === 0 ? 'Arrival & Check-in' : `Day ${i + 1} in ${dest?.name || 'Destination'}`;
            days.push({
                date: date.toISOString(),
                title,
                destinationId: id,
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
}