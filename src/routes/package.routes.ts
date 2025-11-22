import { Request, Response, Router } from 'express';
import { PackageService } from '../services/package.service';
import { startOfDayUtc } from '../utils/date.util';
import { optionalAuthMiddleware } from '../middlewares/optional-auth.middleware';
import { getDB } from '../configuration/database.config';

const router = Router();
const service = new PackageService();

/**
 * @swagger
 * /packages/generate:
 *   post:
 *     summary: Generate a travel package
 *     description: |
 *       Generates a comprehensive travel package including hotels, restaurants, activities, and weather data.
 *       The package includes day-by-day itineraries, transport costs, and accommodation options.
 *       
 *       **Key Features:**
 *       - Automatically fetches weather data (5-day forecast window)
 *       - Includes hotel options from Amadeus API
 *       - Suggests restaurants based on price bucket
 *       - Calculates transport costs between destinations
 *       - Provides available cab options for UI switching
 *       - Supports date regeneration via startDate parameter
 *       
 *       **Weather Data:**
 *       - Weather data is fetched from Tomorrow.io API
 *       - If weather data is missing for a date, it will be fetched automatically
 *       - Weather may be null for dates outside the 5-day forecast window
 *       - Check `meta.weatherNullDays` for dates with missing weather
 *     tags:
 *       - Packages
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GeneratePackageRequest'
 *           examples:
 *             example1:
 *               summary: Basic package generation
 *               value:
 *                 destinationIds: ["6d04f442-3f07-4f72-90aa-bb75a7bbd167"]
 *                 people: 2
 *                 priceBucket: budget_conscious
 *                 includeCommonAttractions: true
 *                 startDate: "2025-11-01T00:00:00.000Z"
 *             regenerate:
 *               summary: Regenerate with a new startDate (use this to regenerate the package for different travel dates)
 *               value:
 *                 destinationIds: ["6d04f442-3f07-4f72-90aa-bb75a7bbd167"]
 *                 people: 2
 *                 priceBucket: optimal
 *                 includeCommonAttractions: true
 *                 startDate: "2025-12-15T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: "Generated package. Note: weather may be null for dates outside the 5-day forecast window."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PackageGenerationResult'
 *             examples:
 *               success:
 *                 summary: Successful package generation
 *                 value:
 *                   title: "Srinagar • Gulmarg Getaway"
 *                   startDate: "2025-11-01T00:00:00.000Z"
 *                   people: 2
 *                   cabType: "sedan"
 *                   totalBasePrice: 15000
 *                   perPersonPrice: 7500
 *                   currency: "INR"
 *                   days:
 *                     - date: "2025-11-01T00:00:00.000Z"
 *                       title: "Arrival & Check-in"
 *                       destinationId: "6d04f442-3f07-4f72-90aa-bb75a7bbd167"
 *                       destinationName: "Srinagar"
 *                       destinationAltitudeM: 1585
 *                       activities: []
 *                       activitiesCost: 0
 *                       transportCost: 1000
 *                   legs: []
 *                   breakdown:
 *                     accommodation: 8000
 *                     transport: 2000
 *                     activities: 3000
 *                     cab: 2000
 *       400:
 *         description: Bad Request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Bad Request"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - "startDate must not be in the past (UTC)"
 *                     - "people must be a positive number"
 */
router.post('/generate', async (req: Request, res: Response) => {
    const { destinationIds, people, priceBucket, activities, includeCommonAttractions, startDate } = req.body || {};

    const errors: string[] = [];
    if (!Array.isArray(destinationIds) || destinationIds.length === 0) errors.push('destinationIds must be a non-empty array');
    const validBuckets = ['budget_conscious', 'optimal', 'go_crazy'];
    if (!validBuckets.includes(String(priceBucket))) errors.push('priceBucket must be one of budget_conscious | optimal | go_crazy');
    if (Number.isNaN(Number(people)) || Number(people) <= 0) errors.push('people must be a positive number');
    if (activities && !Array.isArray(activities)) errors.push('activities must be an array when provided');
    if (includeCommonAttractions !== undefined && typeof includeCommonAttractions !== 'boolean') errors.push('includeCommonAttractions must be boolean when provided');
    if (startDate && Number.isNaN(Date.parse(startDate))) errors.push('startDate must be a valid ISO date string when provided');
    if (startDate && !Number.isNaN(Date.parse(startDate))) {
        const parsed = new Date(startDate);
        const todayStart = startOfDayUtc(new Date());
        if (parsed < todayStart) errors.push('startDate must not be in the past (UTC)');
    }

    if (errors.length) return res.status(400).json({ error: 'Bad Request', details: errors });

    const result = await service.generate({ destinationIds, people: Number(people), priceBucket, activities, includeCommonAttractions, startDate });
    res.json(result);
});

/**
 * @swagger
 * /packages/{packageId}/book:
 *   post:
 *     summary: Attempt to book a generated package
 *     description: |
 *       Initiates the booking flow for a previously generated package.
 *       - If unauthenticated, the package booking_status becomes `awaiting_auth` and the API returns 401 to trigger login.
 *       - If authenticated but not phone/verification complete, booking_status becomes `awaiting_verification` and the API returns 403.
 *       - If verification complete but KYC incomplete, booking_status becomes `pending_kyc` and the API returns 202.
 *       - If fully verified and KYC complete, booking_status becomes `booked` and the API returns 200.
 *     tags:
 *       - Packages
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Booking confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 packageId:
 *                   type: string
 *                   format: uuid
 *                 booking_status:
 *                   type: string
 *                   example: "booked"
 *       202:
 *         description: KYC required to finalize booking
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Verification required (phone or verification_status)
 *       404:
 *         description: Package not found
 */
router.post('/:packageId/book', [optionalAuthMiddleware], async (req: Request, res: Response) => {
    const { packageId } = req.params;
    const db = getDB();

    const { data: pkg, error } = await db
        .from('packages')
        .select('id,user_id,booking_status')
        .eq('id', packageId)
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const user = (req as any).user as { id: string } | undefined;

    // Unauthenticated: set awaiting_auth and prompt login
    if (!user) {
        if ((pkg as any).booking_status !== 'booked') {
            await db.from('packages').update({ booking_status: 'awaiting_auth' }).eq('id', (pkg as any).id);
        }
        return res.status(401).json({
            error: 'authentication_required',
            packageId,
            booking_status: 'awaiting_auth',
        });
    }

    // If package is owned by a different user, block
    if ((pkg as any).user_id && (pkg as any).user_id !== user.id) {
        return res.status(409).json({ error: 'package_owned_by_another_user' });
    }

    // Attach package to this user if not already
    if (!(pkg as any).user_id) {
        await db.from('packages').update({ user_id: user.id }).eq('id', (pkg as any).id);
    }

    // Fetch profile for verification and KYC checks
    const { data: profile, error: profErr } = await db
        .from('user_profiles')
        .select('verification_status,kyc_status,phone')
        .eq('id', user.id)
        .maybeSingle();
    if (profErr) return res.status(500).json({ error: profErr.message });

    const verificationStatus = (profile as any)?.verification_status;
    const kycStatus = (profile as any)?.kyc_status;
    const phone = (profile as any)?.phone;

    if (verificationStatus !== 'verified' || !phone) {
        await db.from('packages').update({ booking_status: 'awaiting_verification' }).eq('id', (pkg as any).id);
        return res.status(403).json({
            error: 'verification_required',
            packageId,
            booking_status: 'awaiting_verification',
        });
    }

    if (kycStatus !== 'verified') {
        await db.from('packages').update({ booking_status: 'pending_kyc' }).eq('id', (pkg as any).id);
        return res.status(202).json({
            message: 'KYC required to finalize booking',
            packageId,
            booking_status: 'pending_kyc',
        });
    }

    await db.from('packages').update({ booking_status: 'booked' }).eq('id', (pkg as any).id);
    return res.json({ packageId, booking_status: 'booked' });
});

export default router;


