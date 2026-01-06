export type DocumentStatus = 'pending' | 'under_review' | 'verified' | 'rejected';

export interface UserDocument {
    id: string;
    user_id: string;
    storage_key: string;
    url: string;
    status: DocumentStatus;
    document_type: string | null;
    file_name: string | null;
    content_type: string | null;
    size_bytes: number | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserDocumentWithUrl extends UserDocument {
    downloadUrl: string;
}

export interface SignedUploadUrl {
    uploadUrl: string;
    objectKey: string;
    expiresIn: number;
    bucket: string;
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
}
