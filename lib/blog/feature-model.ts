// Relative, with .ts, like lib/blog/model.ts, so a setup script can import it under plain Node.


/**
 * The model for /features/[slug] pages in DUMA's own CMS. Like blog posts,
 * they are written in the internal workspace (Admin → Content) and read
 * through the public blog API, which serves exactly this type and blog-post.
 * A page renders with the blog post layout; its slug must be a module's slug
 * (lib/marketing/site.ts MODULES), or the route answers 404.
 */

export const FEATURE_TYPE_KEY = 'feature-page';
