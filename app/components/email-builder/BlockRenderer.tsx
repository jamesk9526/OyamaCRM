/**
 * BlockRenderer — dispatches an EmailBlock to its canvas component.
 *
 * Acts as a switch/lookup so callers never need to import every block type.
 */

'use client';

import type { EmailBlock } from '@/app/lib/email-builder-types';
import TextBlock    from './blocks/TextBlock';
import QuoteBlock   from './blocks/QuoteBlock';
import ImpactStatBlock from './blocks/ImpactStatBlock';
import ImageBlock   from './blocks/ImageBlock';
import VideoBlock   from './blocks/VideoBlock';
import ButtonBlock  from './blocks/ButtonBlock';
import AiTextBlock  from './blocks/AiTextBlock';
import AiButtonBlock from './blocks/AiButtonBlock';
import DividerBlock from './blocks/DividerBlock';
import SpacerBlock  from './blocks/SpacerBlock';
import SocialBlock  from './blocks/SocialBlock';
import ColumnsBlock from './blocks/ColumnsBlock';

interface Props {
  block: EmailBlock;
}

/** Renders the appropriate canvas component for any EmailBlock. */
export default function BlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'text':    return <TextBlock    block={block} />;
    case 'quote':   return <QuoteBlock   block={block} />;
    case 'impactStat': return <ImpactStatBlock block={block} />;
    case 'image':   return <ImageBlock   block={block} />;
    case 'video':   return <VideoBlock   block={block} />;
    case 'button':  return <ButtonBlock  block={block} />;
    case 'aiText':  return <AiTextBlock  block={block} />;
    case 'aiButton': return <AiButtonBlock block={block} />;
    case 'divider': return <DividerBlock block={block} />;
    case 'spacer':  return <SpacerBlock  block={block} />;
    case 'social':  return <SocialBlock  block={block} />;
    case 'columns': return <ColumnsBlock block={block} />;
    default:        return null;
  }
}
