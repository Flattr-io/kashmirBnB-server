import { Router, Request, Response } from 'express';

const router = Router();

/**
 *  @method      GET
 *  @desc        Get all users
 *  @access      Protected
 */
router.get('/', async (req: Request, res: Response) => {
    res.send('everything okay');
});

export default router;
