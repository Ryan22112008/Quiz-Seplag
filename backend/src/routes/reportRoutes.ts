import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ReportController } from '../controllers/reportController.js';

export function createReportRoutes(controller: ReportController, requireAuth: RequestHandler) {
  const router = Router();
  router.get('/reports', requireAuth, controller.list);
  router.get('/reports/trash', requireAuth, controller.trash);
  router.patch('/reports/:id/restore', requireAuth, controller.restore);
  router.delete('/reports/:id/permanent', requireAuth, controller.permanentlyDelete);
  router.delete('/reports/:id', requireAuth, controller.delete);
  router.get('/reports/:id', requireAuth, controller.get);
  return router;
}
