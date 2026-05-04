import { Router } from 'express';
import { checkin } from '../controllers/checkin.controller.js';

const router = Router();

router.post('/', checkin);

export default router;
