import { Request, Response, Router } from 'express';
import { PackageService } from '../services/package.service';

const router = Router();
const service = new PackageService();

/**
 * @swagger
 * /packages/generate:
 *   post:
 *     summary: Generate a travel package
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
 *               value:
 *                 destinationIds: ["6d04f442-3f07-4f72-90aa-bb75a7bbd167"]
 *                 people: 2
 *                 priceBucket: budget_conscious
 *                 includeCommonAttractions: true
 *                 startDate: "2025-11-01T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Generated package
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PackageGenerationResult'
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

    if (errors.length) return res.status(400).json({ error: 'Bad Request', details: errors });

    const result = await service.generate({ destinationIds, people: Number(people), priceBucket, activities, includeCommonAttractions, startDate });
    res.json(result);
});

export default router;


