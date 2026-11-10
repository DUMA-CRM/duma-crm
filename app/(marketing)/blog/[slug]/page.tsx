import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticlePage } from '@/components/marketing/blog/ArticlePage';
import { JsonLd } from '@/components/marketing/JsonLd';

import { BLOG_AUTHOR } from '@/lib/blog/model';
import { type BlogPost, getPost, listPosts, relatedPosts } from '@/lib/blog/posts';
import { blogPostingSchema, breadcrumbSchema, faqSchema } from '@/lib/marketing/schema';
import { SITE_NAME, absoluteUrl } from '@/lib/marketing/site';

/** The share image: the SEO block's, then the cover, then the post's generated card. */
function shareImage(post: BlogPost) {
  const image = post.seo.ogImage ?? post.cover;
  if (image) return { url: image.url, width: image.width ?? undefined, height: image.height ?? undefined, alt: image.altText ?? post.title };
  return { url: `/blog/${post.slug}/og`, width: 1200, height: 630, alt: post.title };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: 'Post not found | DUMA', robots: { index: false } };

  const title = post.seo.metaTitle ?? `${post.title} | ${SITE_NAME}`;
  const description = post.seo.metaDescription ?? post.excerpt;
  const canonical = post.seo.canonicalUrl ?? absoluteUrl(`/blog/${post.slug}`);
  const image = shareImage(post);
  const index = !post.seo.noIndex && !post.sample;

  return {
    title,
    description,
    alternates: { canonical, types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'DUMA blog' }] } },
    robots: { index, follow: !post.seo.noFollow, 'max-image-preview': 'large', 'max-snippet': -1 },
    authors: [{ name: BLOG_AUTHOR.name, url: absoluteUrl(BLOG_AUTHOR.path) }],
    category: post.category,
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: SITE_NAME,
      locale: 'en_GB',
      title: post.seo.socialTitle ?? post.seo.metaTitle ?? post.title,
      description: post.seo.socialDescription ?? description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      section: post.category,
      authors: [absoluteUrl(BLOG_AUTHOR.path)],
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo.socialTitle ?? post.seo.metaTitle ?? post.title,
      description: post.seo.socialDescription ?? description,
      images: [image],
    },
  };
}

/** /blog/[slug] — one post from DUMA's CMS, in the shared article layout (ArticlePage). */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const { posts } = await listPosts();
  const related = relatedPosts(post, posts);

  return (
    <>
      <JsonLd data={blogPostingSchema(post)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }])} />
      {post.faq.length > 0 && <JsonLd data={faqSchema(post.faq)} />}

      <ArticlePage post={post} crumb={{ label: 'Blog', href: '/blog' }} kind="post" related={related} />
    </>
  );
}

