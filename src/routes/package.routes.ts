import { Request, Response, Router } from 'express';
import { PackageService } from '../services/package.service';
import { startOfDayUtc } from '../utils/date.util';
import { optionalAuthMiddleware } from '../middlewares/optional-auth.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
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
 *       - If user is authenticated, the package is automatically associated with their user_id
 *       
 *       **Weather Data:**
 *       - Weather data is fetched from Tomorrow.io API
 *       - If weather data is missing for a date, it will be fetched automatically
 *       - Weather may be null for dates outside the 5-day forecast window
 *       - Check `meta.weatherNullDays` for dates with missing weather
 *     tags:
 *       - Packages
 *     security:
 *       - bearerAuth: []
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
router.post('/generate', [optionalAuthMiddleware], async (req: Request, res: Response) => {
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

    const user = (req as any).user as { id: string } | undefined;
    const userId = user?.id || undefined;

    const result = await service.generate({ destinationIds, people: Number(people), priceBucket, activities, includeCommonAttractions, startDate }, userId);
    res.json(result);
});

/**
 * @swagger
 * /packages/{packageId}/book:
 *   post:
 *     summary: Attempt to book a generated package
 *     description: |
 *       Initiates the booking flow for a previously generated package.
 *       Optionally accepts configuration updates (cab, hotels, activities, date) to apply before booking.
 *       
 *       - If configuration is provided, the package is updated first.
 *       - Then, the booking logic matches the user and updates status.
 *       - If unauthenticated, `booking_status` -> `awaiting_auth` (401).
 *       - If authenticated but unverified, `booking_status` -> `awaiting_verification` (403).
 *       - If verified but no KYC, `booking_status` -> `pending_kyc` (202).
 *       - If fully verified, `booking_status` -> `booked` (200).
 *     tags:
 *       - Packages
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePackageConfigurationRequest'
 *     responses:
 *       200:
 *         description: Booking confirmed
 *       202:
 *         description: KYC required
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Verification required
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.post('/:packageId/book', [optionalAuthMiddleware], async (req: Request, res: Response) => {
    const { packageId } = req.params;
    const { cabId, dayConfigurations } = req.body || {};
    const db = getDB();

    // 1. If configuration updates are provided, apply them first
    if (cabId || (dayConfigurations && Array.isArray(dayConfigurations) && dayConfigurations.length > 0)) {
        try {
            await service.updateConfiguration(packageId, { cabId, dayConfigurations });
        } catch (error: any) {
            if (error.message?.includes('booked')) {
                return res.status(409).json({ error: 'Cannot update configuration: Package is already booked' });
            } else if (error.message?.includes('not found')) {
                return res.status(404).json({ error: 'Package not found during update' });
            }
            // Log warning but maybe proceed? Or fail? Better to fail if explicit update requested.
            return res.status(400).json({ error: 'Failed to apply configuration updates', details: error.message });
        }
    }

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


/**
 * @swagger
 * /packages/{packageId}:
 *   get:
 *     summary: Get package details
 *     description: Retrieve full details of a specific package. Requires authentication and ownership.
 *     tags:
 *       - Packages
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Package details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PackageGenerationResult'
 *       403:
 *         description: Forbidden (Not owned by user)
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.get('/:packageId', authMiddleware, async (req: Request, res: Response) => {
    const { packageId } = req.params;
    const user = (req as any).user;
    const db = getDB();

    try {
        // 1. Check ownership or public access
        const { data: pkg, error } = await db
            .from('packages')
            .select('user_id, is_public')
            .eq('id', packageId)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!pkg) return res.status(404).json({ error: 'Package not found' });

        if (pkg.user_id !== user.id && !pkg.is_public) {
            return res.status(403).json({ error: 'Access denied: You do not own this package' });
        }

        // 2. Fetch full details
        const result = await service.getById(packageId);
        res.json(result);
    } catch (error: any) {
        if (error.message === 'Package not found') {
            return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Failed to fetch package' });
    }
});

/**
 * @swagger
 * /packages/{packageId}/clone:
 *   post:
 *     summary: Clone a package
 *     description: Creates a new package based on an existing one with a new start date. The source package must be owned by the user or be public.
 *     tags:
 *       - Packages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the package to clone
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: New start date for the cloned package
 *             required:
 *               - startDate
 *     responses:
 *       201:
 *         description: Package cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PackageGenerationResult'
 *       403:
 *         description: Access denied (source package is private and not owned by user)
 *       404:
 *         description: Source package not found
 *       500:
 *         description: Server error
 */
router.post('/:packageId/clone', authMiddleware, async (req: Request, res: Response) => {
    const { packageId } = req.params;
    const { startDate } = req.body;
    const user = (req as any).user;
    const db = getDB();

    if (!startDate) {
        return res.status(400).json({ error: 'startDate is required' });
    }

    try {
        // 1. Verify access (Public or Owner)
        const { data: pkg, error } = await db
            .from('packages')
            .select('user_id, is_public')
            .eq('id', packageId)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!pkg) return res.status(404).json({ error: 'Package not found' });

        if (pkg.user_id !== user.id && !pkg.is_public) {
            return res.status(403).json({ error: 'Access denied: Source package is private' });
        }

        // 2. Clone package (user is authenticated, so pass user.id)
        const result = await service.clonePackage(packageId, startDate, user.id);
        res.status(201).json(result);
    } catch (error: any) {
        if (error.message?.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to clone package' });
    }
});

/**
 * @swagger
 * /packages/{packageId}:
 *   patch:
 *     summary: Update package configuration (Cab, Hotels)
 *     description: |
 *       Update specific configurations of a generated package before booking.
 *       Supports changing Cab, Hotels, Activities, or **Rescheduling** (via `startDate`).
 *       Note: Changing `startDate` will regenerate the entire itinerary (prices, weather, availability).
 *     tags:
 *       - Packages
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePackageConfigurationRequest'
 *     responses:
 *       200:
 *         description: Package updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PackageGenerationResult'
 *       400:
 *         description: Bad Request
 *       403:
 *         description: Forbidden (booked package)
 *       500:
 *         description: Internal Server Error
 */
router.patch('/:packageId', [optionalAuthMiddleware], async (req: Request, res: Response) => {
    const { packageId } = req.params;
    const body = req.body;
    try {
        const result = await service.updateConfiguration(packageId, body);
        res.json(result);
    } catch (error: any) {
        if (error.message?.includes('booked')) {
            res.status(403).json({ error: error.message });
        } else if (error.message?.includes('not found')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: error.message || 'Failed to update package' });
        }
    }
});


/**
 * @swagger
 * /packages/history:
 *   get:
 *     summary: Get user's booking history
 *     description: Retrieve recent bookings (default 5) for the authenticated user with essential metadata for UI cards.
 *     tags:
 *       - Packages
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BookingHistoryItem'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const result = await service.getUserBookings(user.id);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch booking history' });
    }
});

export default router;




