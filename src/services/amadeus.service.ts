import axios from 'axios';
import { AmadeusAuthService } from './amadeus-auth.service';

export type HotelSuggestion = {
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
};

export class AmadeusService {
    private auth = new AmadeusAuthService();
    private get baseUrl() {
        const host = (process.env.AMADEUS_HOSTNAME as string) || 'test';
        return host === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
    }
    private get verbose() {
        return String(process.env.VERBOSE_LOGGING || '').toLowerCase() === 'true';
    }

    // Deprecated: keep for backward compat if needed; returns []
    async searchHotelsByCityCode(): Promise<HotelSuggestion[]> { return []; }

    async searchHotelsByGeocode(params: { latitude: number; longitude: number; radius?: number; radiusUnit?: 'KM' | 'MILE'; ratings?: string[]; hotelSource?: 'BEDBANK' | 'DIRECTCHAIN' | 'ALL'; }): Promise<HotelSuggestion[]> {
        const { latitude, longitude, radius = 5, radiusUnit = 'KM', ratings = [], hotelSource = 'ALL' } = params;
        try {
            console.log('[Amadeus] byGeocode request params:', { latitude, longitude, radius, radiusUnit, ratings, hotelSource });
            const token = await this.auth.getAccessToken();
            console.log('[Amadeus] Using token:', token ? 'TOKEN_PRESENT' : 'NO_TOKEN');
            console.log('[Amadeus] Base URL:', this.baseUrl);
            const resp = await axios.get(`${this.baseUrl}/v1/reference-data/locations/hotels/by-geocode`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    latitude,
                    longitude,
                    radius,
                    radiusUnit,
                    ratings: ratings.length ? ratings.join(',') : undefined,
                    hotelSource,
                }
            });
            console.log('[Amadeus] byGeocode raw response:', { status: resp.status, dataLength: resp.data?.data?.length || 0, meta: resp.data?.meta });
            console.log('[Amadeus] byGeocode hotel data sample:', resp.data?.data?.[0]);
            const hotels: HotelSuggestion[] = (resp.data?.data || []).map((h: any) => ({
                name: h.name,
                hotelId: h.hotelId,
                distanceKm: h.distance?.value ? Number(h.distance.value) : undefined,
                latitude: h.geoCode?.latitude,
                longitude: h.geoCode?.longitude,
                address: h.address?.countryCode,
            }));
            if (this.verbose) {
                const sample = hotels.slice(0, 3).map((h: HotelSuggestion) => ({ hotelId: h.hotelId, distanceKm: h.distanceKm }));
                console.log('[Amadeus] byGeocode result', { count: hotels.length, sample });
            }
            return hotels;
        } catch (e) {
            console.error('[Amadeus] byGeocode error', { 
                message: (e as any)?.message, 
                status: (e as any)?.response?.status,
                data: (e as any)?.response?.data,
                config: {
                    url: (e as any)?.config?.url,
                    params: (e as any)?.config?.params
                }
            });
            return [];
        }
    }

    async getHotelOffers(params: { hotelIds: string[]; adults: number; checkInDate: string; checkOutDate: string; roomQuantity?: number; priceRange?: string; currency?: string; boardType?: 'ROOM_ONLY' | 'BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD' | 'ALL_INCLUSIVE'; includeClosed?: boolean; bestRateOnly?: boolean; lang?: string; }): Promise<any[]> {
        const {
            hotelIds, adults, checkInDate, checkOutDate,
            roomQuantity = 1, priceRange,
            currency = 'INR', boardType, includeClosed = false,
            bestRateOnly = true, lang = 'EN'
        } = params;
        try {
            const token = await this.auth.getAccessToken();
            
            // Build params object, only including defined values
            const requestParams: any = {
                hotelIds: hotelIds.join(','),
                adults,
                checkInDate,
                checkOutDate,
                roomQuantity,
                currency,
                includeClosed,
                bestRateOnly,
                lang,
            };
            
            // Only add optional params if they have valid values
            if (priceRange) {
                requestParams.priceRange = priceRange;
            }
            if (boardType) {
                requestParams.boardType = boardType;
            }
            
            const resp = await axios.get(`${this.baseUrl}/v3/shopping/hotel-offers`, {
                headers: { Authorization: `Bearer ${token}` },
                params: requestParams
            });
            console.log('[Amadeus] hotel-offers raw response:', { status: resp.status, dataLength: resp.data?.data?.length || 0 });
            const data = resp.data?.data || [];
            if (this.verbose) {
                const sample = data.slice(0, 2).map((d: any) => ({ hotelId: d?.hotel?.hotelId, offerId: d?.offers?.[0]?.id, price: d?.offers?.[0]?.price?.total, currency: d?.offers?.[0]?.price?.currency }));
                console.log('[Amadeus] hotel-offers result', { count: data.length, sample, priceRange, boardType });
            }
            return data;
        } catch (e) {
            console.error('[Amadeus] hotel-offers error', { 
                message: (e as any)?.message,
                status: (e as any)?.response?.status,
                data: (e as any)?.response?.data,
                errors: (e as any)?.response?.data?.errors,
                requestParams: {
                    hotelIds: hotelIds.join(','),
                    adults,
                    checkInDate,
                    checkOutDate,
                    priceRange,
                    boardType
                }
            });
            return [];
        }
    }
}


