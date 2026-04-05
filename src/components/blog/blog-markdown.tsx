import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type BlogMarkdownProps = {
  content: string;
};

export function BlogMarkdown({ content }: BlogMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="mt-10 scroll-m-20 text-xl font-bold tracking-tight text-foreground first:mt-0 sm:text-2xl">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-8 text-lg font-semibold text-foreground sm:text-xl">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="leading-relaxed text-muted-foreground [&:not(:first-child)]:mt-4">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="my-4 list-disc space-y-2 pl-6 text-muted-foreground marker:text-primary">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-4 list-decimal space-y-2 pl-6 text-muted-foreground marker:text-primary">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ href, children }) => {
          if (href?.startsWith("/")) {
            return (
              <Link
                href={href}
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
              >
                {children}
              </Link>
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
            >
              {children}
            </a>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="mt-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        img: ({ src, alt }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={typeof src === "string" ? src : ""}
            alt={alt ?? ""}
            className="my-6 h-auto max-w-full rounded-xl border border-border/40"
            loading="lazy"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
