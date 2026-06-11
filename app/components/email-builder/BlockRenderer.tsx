/**
 * BlockRenderer — dispatches an EmailBlock to its canvas component.
 *
 * Acts as a switch/lookup so callers never need to import every block type.
 */

'use client';

import type { EmailBlock } from '@/app/lib/email-builder-types';
import HeadingBlock from './blocks/HeadingBlock';
import TextBlock    from './blocks/TextBlock';
import QuoteBlock   from './blocks/QuoteBlock';
import ImpactStatBlock from './blocks/ImpactStatBlock';
import StatisticsBlock from './blocks/StatisticsBlock';
import ImpactStoryBlock from './blocks/ImpactStoryBlock';
import ImpactGridBlock from './blocks/ImpactGridBlock';
import ProgressBlock from './blocks/ProgressBlock';
import TimelineBlock from './blocks/TimelineBlock';
import CalloutBlock from './blocks/CalloutBlock';
import FeatureListBlock from './blocks/FeatureListBlock';
import DonorThankYouBlock from './blocks/DonorThankYouBlock';
import DonationReceiptBlock from './blocks/DonationReceiptBlock';
import GivingSummaryBlock from './blocks/GivingSummaryBlock';
import DonationCtaBlock from './blocks/DonationCtaBlock';
import MonthlyDonorInvitationBlock from './blocks/MonthlyDonorInvitationBlock';
import LapsedDonorReengagementBlock from './blocks/LapsedDonorReengagementBlock';
import FirstTimeDonorWelcomeBlock from './blocks/FirstTimeDonorWelcomeBlock';
import StaffSignatureBlock from './blocks/StaffSignatureBlock';
import FooterComplianceBlock from './blocks/FooterComplianceBlock';
import EventDetailsBlock from './blocks/EventDetailsBlock';
import PartnerLogosBlock from './blocks/PartnerLogosBlock';
import ContactCardBlock from './blocks/ContactCardBlock';
import ImageBlock   from './blocks/ImageBlock';
import VideoBlock   from './blocks/VideoBlock';
import ButtonBlock  from './blocks/ButtonBlock';
import AiTextBlock  from './blocks/AiTextBlock';
import AiButtonBlock from './blocks/AiButtonBlock';
import DividerBlock from './blocks/DividerBlock';
import SpacerBlock  from './blocks/SpacerBlock';
import SocialBlock  from './blocks/SocialBlock';
import ColumnsBlock from './blocks/ColumnsBlock';
import CustomHtmlBlock from './blocks/CustomHtmlBlock';

interface Props {
  block: EmailBlock;
  templateFontFamily?: string;
  editable?: boolean;
  onChangeContent?: (id: string, content: string) => void;
}

/** Renders the appropriate canvas component for any EmailBlock. */
export default function BlockRenderer({ block, templateFontFamily, editable = false, onChangeContent }: Props) {
  switch (block.type) {
    case 'heading': return <HeadingBlock block={block} />;
    case 'text':    return <TextBlock    block={block} fontFamily={templateFontFamily} editable={editable} onChangeContent={(content) => onChangeContent?.(block.id, content)} />;
    case 'quote':   return <QuoteBlock   block={block} />;
    case 'impactStat': return <ImpactStatBlock block={block} />;
    case 'statistics': return <StatisticsBlock block={block} />;
    case 'impactStory': return <ImpactStoryBlock block={block} />;
    case 'impactGrid': return <ImpactGridBlock block={block} />;
    case 'progress': return <ProgressBlock block={block} />;
    case 'timeline': return <TimelineBlock block={block} />;
    case 'callout': return <CalloutBlock block={block} />;
    case 'featureList': return <FeatureListBlock block={block} />;
    case 'donorThankYou': return <DonorThankYouBlock block={block} />;
    case 'donationReceipt': return <DonationReceiptBlock block={block} />;
    case 'givingSummary': return <GivingSummaryBlock block={block} />;
    case 'donationCta': return <DonationCtaBlock block={block} />;
    case 'monthlyDonorInvitation': return <MonthlyDonorInvitationBlock block={block} />;
    case 'lapsedDonorReengagement': return <LapsedDonorReengagementBlock block={block} />;
    case 'firstTimeDonorWelcome': return <FirstTimeDonorWelcomeBlock block={block} />;
    case 'staffSignature': return <StaffSignatureBlock block={block} />;
    case 'footerCompliance': return <FooterComplianceBlock block={block} />;
    case 'eventDetails': return <EventDetailsBlock block={block} />;
    case 'partnerLogos': return <PartnerLogosBlock block={block} />;
    case 'contactCard': return <ContactCardBlock block={block} />;
    case 'image':   return <ImageBlock   block={block} />;
    case 'video':   return <VideoBlock   block={block} />;
    case 'button':  return <ButtonBlock  block={block} />;
    case 'aiText':  return <AiTextBlock  block={block} fontFamily={templateFontFamily} editable={editable} onChangeContent={(content) => onChangeContent?.(block.id, content)} />;
    case 'aiButton': return <AiButtonBlock block={block} />;
    case 'divider': return <DividerBlock block={block} />;
    case 'spacer':  return <SpacerBlock  block={block} />;
    case 'social':  return <SocialBlock  block={block} />;
    case 'columns': return <ColumnsBlock block={block} templateFontFamily={templateFontFamily} />;
    case 'customHtml': return <CustomHtmlBlock block={block} />;
    default:        return null;
  }
}
