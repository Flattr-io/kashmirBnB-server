import 'dotenv/config';

import { AppBootstrap } from './src/bootstrap/app.bootstrap';

export const startApp = () => {
    AppBootstrap.run();
};

startApp();
