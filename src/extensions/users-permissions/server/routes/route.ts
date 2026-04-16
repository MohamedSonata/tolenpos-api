// Example of how to use Strapi's createCoreRouter factory for users-permissions
// Uncomment and configure as needed for your plugin
// import { createCoreRouter } from '@strapi/strapi';
//
// export default createCoreRouter('plugin::users-permissions.user', {
//   prefix: '',
//   only: ['find', 'findOne'],
//   except: [],
//   config: {
//     find: {
//       auth: false,
//       policies: [],
//       middlewares: [],
//     },
//     findOne: {},
//     create: {},
//     update: {},
//     delete: {},
//   },
// });