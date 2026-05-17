/** CustomHtmlBlock renders raw HTML content for advanced custom email layouts. */

import type { CustomHtmlBlock as CustomHtmlBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: CustomHtmlBlockData;
}

/** Renders author-supplied custom HTML exactly as configured in the block editor. */
export default function CustomHtmlBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div dangerouslySetInnerHTML={{ __html: block.html }} />
    </div>
  );
}
