import * as routes from './routes';
import * as services from './services';
import * as controllers from './controllers';
import * as middlewares from './middlewares';


export default () => ({
  routes,
  services,
  controllers,
  middlewares,
  
  type: 'content-api', // can also be 'admin' depending on the type of route
});