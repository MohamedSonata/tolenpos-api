/**
 * Example middleware to log HTTP requests and response times.
 * @param options - Middleware options.
 * @param strapi - Strapi instance.
 * @returns Koa middleware function.
 */
const middlewareA = (options: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const start = Date.now();
    await next();
    const delta = Math.ceil(Date.now() - start);
    strapi.log.http(`${ctx.method} ${ctx.url} (${delta} ms) ${ctx.status}`);
  };
};

export default middlewareA;