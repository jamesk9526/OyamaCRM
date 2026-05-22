/**
 * SocialBlock — canvas render component.
 *
 * Renders a premium social follow section with clickable links and multiple
 * layout variants that mirror the exported email HTML.
 */

'use client';

import type { SocialBlock as SocialBlockData, SocialPlatform } from '@/app/lib/email-builder-types';

interface Props {
  block: SocialBlockData;
}

/** Brand colour per social platform. */
const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  facebook:  '#1877f2',
  twitter:   '#1da1f2',
  instagram: '#e1306c',
  linkedin:  '#0a66c2',
  youtube:   '#ff0000',
  tiktok:    '#111111',
};

/** Display label per social platform. */
const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook:  'Facebook',
  twitter:   'Twitter',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  youtube:   'YouTube',
  tiktok:    'TikTok',
};

/** Compact badge content used in icon-led layouts. */
const PLATFORM_BADGES: Record<SocialPlatform, string> = {
  facebook: 'f',
  twitter: 'X',
  instagram: 'IG',
  linkedin: 'in',
  youtube: 'YT',
  tiktok: 'TT',
};

function getJustifyContent(align: SocialBlockData['align']): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';
  return 'flex-start';
}

/** Renders a social links block in the email canvas. */
export default function SocialBlock({ block }: Props) {
  const variant = block.variant ?? 'card';
  const colorMode = block.colorMode ?? 'brand';
  const showLabels = block.showLabels !== false;
  const textColor = block.textColor ?? '#0f172a';
  const accentColor = block.accentColor ?? '#2563ff';
  const backgroundColor = block.backgroundColor ?? '#ffffff';
  const borderColor = block.borderColor ?? '#e6e9f2';
  const justifyContent = getJustifyContent(block.align);

  return (
    <div
      style={{
        padding: block.padding,
        textAlign: block.align,
      }}
    >
      {(block.title?.trim() || block.intro?.trim()) && (
        <div style={{ marginBottom: 14 }}>
          {block.title?.trim() ? (
            <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700, color: textColor }}>
              {block.title}
            </div>
          ) : null}
          {block.intro?.trim() ? (
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px', color: textColor, opacity: 0.82 }}>
              {block.intro}
            </div>
          ) : null}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent,
        }}
      >
        {block.links.length === 0 && (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>No social links added</span>
        )}
        {block.links.map((link) => {
          const brandColor = PLATFORM_COLORS[link.platform] ?? accentColor;
          const badgeColor = colorMode === 'brand' ? brandColor : colorMode === 'accent' ? accentColor : textColor;
          const pillBackground = colorMode === 'neutral' ? backgroundColor : badgeColor;
          const pillText = colorMode === 'neutral' ? textColor : '#ffffff';
          const label = PLATFORM_LABELS[link.platform];
          const badge = PLATFORM_BADGES[link.platform];

          if (variant === 'minimal') {
            return (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: textColor,
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: badgeColor,
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {badge}
                </span>
                {showLabels ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{label}</span>
                ) : null}
              </a>
            );
          }

          if (variant === 'pill') {
            return (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 999,
                  backgroundColor: pillBackground,
                  color: pillText,
                  textDecoration: 'none',
                  border: colorMode === 'neutral' ? `1px solid ${borderColor}` : 'none',
                  boxShadow: colorMode === 'neutral' ? 'none' : '0 8px 18px rgba(37,99,255,0.16)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colorMode === 'neutral' ? badgeColor : 'rgba(255,255,255,0.18)',
                    color: colorMode === 'neutral' ? '#ffffff' : pillText,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {badge}
                </span>
                {showLabels ? <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span> : null}
              </a>
            );
          }

          return (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 168,
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor,
                color: textColor,
                textDecoration: 'none',
                border: `1px solid ${borderColor}`,
                boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: badgeColor,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {badge}
              </span>
              <span>
                {showLabels ? (
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: textColor }}>{label}</span>
                ) : null}
                <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: '#64748b' }}>Follow for updates</span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
