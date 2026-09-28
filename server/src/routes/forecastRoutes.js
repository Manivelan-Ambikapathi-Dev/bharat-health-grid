import { Router } from 'express';
import {
  getForecastAlertsHandler,
  getForecastHandler,
  getMedicineForecastHandler,
} from '../controllers/forecastController.js';

const forecastRouter = Router();

forecastRouter.get('/forecast', getForecastHandler);
forecastRouter.get('/medicine-forecast', getMedicineForecastHandler);
forecastRouter.get('/forecast-alerts', getForecastAlertsHandler);

export { forecastRouter };
