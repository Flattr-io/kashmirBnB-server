export interface IUserProfile {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    dob?: string | null;
    gender?: 'male' | 'female' | 'other' | string | null;
    verification_status?: string | null;
    kyc_status?: string | null;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}

