import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { generalLimiter } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { changeRequestsRouter } from './routes/change-requests';
import { disputesRouter } from './routes/disputes';
import { donationsRouter } from './routes/donations';
import { donorRouter } from './routes/donor';
import { geoRegionsRouter } from './routes/geo-regions';
import { healthRouter } from './routes/health';
import { institutionsRouter } from './routes/institutions';
import { notificationsRouter } from './routes/notifications';
import { successStoriesRouter } from './routes/success-stories';
import { usersRouter } from './routes/users';

/**
 * Defense-in-depth (2026-07-30, root-caused incident): every async route
 * handler and middleware in this app is wrapped in asyncHandler, which
 * forwards rejections to Express's errorHandler instead of leaving them
 * unhandled. This is the backstop for anything that isn't — Node's default
 * behavior on an unhandled rejection is to crash the whole process, which is
 * exactly what took the API down during heavy testing (a Sheets API 429
 * thrown inside the then-unwrapped requireAuth middleware). Logging and
 * surviving is strictly better than a silent, total outage.
 */
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (API stayed up):', reason);
});

const app = express();

app.use(cors({ origin: env.allowedOrigins }));
app.use(express.json());
app.use(requestLogger);
// Health checks stay unthrottled — a monitoring tool polling this shouldn't compete with real traffic for quota.
app.use(healthRouter);
app.use(generalLimiter);
app.use(authRouter);
app.use(geoRegionsRouter);
app.use(usersRouter);
app.use(donationsRouter);
app.use(institutionsRouter);
app.use(donorRouter);
app.use(notificationsRouter);
app.use(disputesRouter);
app.use(changeRequestsRouter);
app.use(successStoriesRouter);
app.use(adminRouter);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Wafina API listening on port ${env.port}`);
});
