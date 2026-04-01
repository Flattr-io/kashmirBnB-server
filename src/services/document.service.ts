import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SupabaseClient } from '@supabase/supabase-js';
import { BadRequestError } from '@hyperflake/http-errors';
import { getDB } from '../configuration/database.config';
import { DocumentStatus, SignedUploadUrl, UserDocument, UserDocumentWithUrl } from '../interfaces/document.interface';

export class DocumentService {
    private s3: S3Client | null = null;
    /** When false, upload/confirm/presigned download are unavailable; list uses stored `url` only. */
    private readonly s3Enabled: boolean;
    private bucket: string;
    private region: string;
    private uploadUrlTtl: number;
    private downloadUrlTtl: number;
    private publicBaseUrl: string;

    private get db(): SupabaseClient {
        return getDB();
    }

    constructor() {
        this.bucket = process.env.AWS_S3_BUCKET || '';
        this.region = process.env.AWS_S3_REGION || process.env.AWS_REGION || '';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
        this.uploadUrlTtl = Number(process.env.AWS_S3_UPLOAD_TTL_SECONDS || 900);
        this.downloadUrlTtl = Number(
            process.env.AWS_S3_DOWNLOAD_TTL_SECONDS || process.env.AWS_S3_UPLOAD_TTL_SECONDS || 900
        );

        const disabledByEnv = ['true', '1', 'yes'].includes(
            (process.env.AWS_S3_DISABLED || '').toLowerCase().trim()
        );
        const placeholderCreds =
            accessKeyId === 'changeme' ||
            secretAccessKey === 'changeme' ||
            this.bucket === 'your-bucket-name';

        const hasAll = Boolean(this.bucket && this.region && accessKeyId && secretAccessKey);
        this.s3Enabled = !disabledByEnv && hasAll && !placeholderCreds;

        this.publicBaseUrl =
            process.env.AWS_S3_PUBLIC_BASE_URL ||
            (this.bucket && this.region
                ? `https://${this.bucket}.s3.${this.region}.amazonaws.com`
                : '');

        if (this.s3Enabled) {
            this.s3 = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
        }
    }

    private ensureS3(): void {
        if (!this.s3Enabled || !this.s3) {
            throw new BadRequestError(
                'Document storage (S3) is not active. Use real AWS credentials (not placeholders), or set AWS_S3_DISABLED=true to run without S3. Upload and presigned URLs require a configured bucket.'
            );
        }
    }

    private sanitizeFileName(fileName: string): string {
        const trimmed = fileName?.trim() || 'document';
        return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    private buildObjectKey(userId: string, fileName: string): string {
        const safeName = this.sanitizeFileName(fileName);
        const timestamp = Date.now();
        return `user-documents/${userId}/${timestamp}-${safeName}`;
    }

    private buildPublicUrl(objectKey: string): string {
        return `${this.publicBaseUrl}/${objectKey}`;
    }

    private async buildDownloadUrl(objectKey: string): Promise<string> {
        this.ensureS3();
        if (!objectKey) {
            throw new BadRequestError('Missing object key for download URL generation');
        }

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
        });

        return getSignedUrl(this.s3!, command, { expiresIn: this.downloadUrlTtl });
    }

    async generateUploadUrl(params: {
        userId: string;
        fileName: string;
        contentType: string;
        documentType?: string;
    }): Promise<SignedUploadUrl> {
        const { userId, fileName, contentType, documentType } = params;

        if (!fileName || !contentType) {
            throw new BadRequestError('fileName and contentType are required');
        }

        this.ensureS3();

        const objectKey = this.buildObjectKey(userId, fileName);
        const putCommand = new PutObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
            ContentType: contentType,
            Metadata: {
                user_id: userId,
                document_type: documentType || 'generic',
            },
        });

        const uploadUrl = await getSignedUrl(this.s3!, putCommand, { expiresIn: this.uploadUrlTtl });

        return {
            uploadUrl,
            objectKey,
            expiresIn: this.uploadUrlTtl,
            bucket: this.bucket,
            url: this.buildPublicUrl(objectKey),
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
            },
        };
    }

    async confirmUpload(params: {
        userId: string;
        objectKey: string;
        documentType?: string;
        fileName?: string;
        contentType?: string;
        status?: DocumentStatus;
    }): Promise<UserDocument> {
        const { userId, objectKey, documentType, fileName, contentType } = params;

        if (!objectKey) {
            throw new BadRequestError('objectKey is required to confirm upload');
        }

        this.ensureS3();

        try {
            const head = await this.s3!.send(
                new HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: objectKey,
                })
            );

            const resolvedContentType = contentType || head.ContentType || null;
            const size = head.ContentLength ?? null;

            const { data, error } = await this.db
                .from('user_documents')
                .upsert(
                    [
                        {
                            user_id: userId,
                            storage_key: objectKey,
                            url: this.buildPublicUrl(objectKey),
                            document_type: documentType || 'generic',
                            status: 'pending' as DocumentStatus,
                            file_name: fileName || objectKey.split('/').pop() || 'document',
                            content_type: resolvedContentType,
                            size_bytes: size,
                        },
                    ],
                    { onConflict: 'user_id,storage_key' }
                )
                .select('*')
                .single();

            if (error) {
                throw new BadRequestError(error.message);
            }

            return data as UserDocument;
        } catch (error: any) {
            if (error?.$metadata?.httpStatusCode === 404) {
                throw new BadRequestError('Uploaded object not found in S3. Upload the file before confirming.');
            }

            if (error?.message) {
                throw new BadRequestError(error.message);
            }

            throw error;
        }
    }

    async getDocumentsForUser(userId: string): Promise<UserDocumentWithUrl[]> {
        const { data, error } = await this.db
            .from('user_documents')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new BadRequestError(error.message);
        }

        const documents = (data || []) as UserDocument[];

        const documentsWithUrls = await Promise.all(
            documents.map(async (doc) => {
                const downloadUrl =
                    this.s3Enabled && this.s3
                        ? await this.buildDownloadUrl(doc.storage_key)
                        : doc.url;
                return { ...doc, downloadUrl } as UserDocumentWithUrl;
            })
        );

        return documentsWithUrls;
    }
}
