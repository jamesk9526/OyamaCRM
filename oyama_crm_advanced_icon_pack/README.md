# Oyama CRM Advanced Icon Pack

A ready-to-use SVG icon pack for OyamaCRM with a special Steward Paths icon.

## Included

- `184` SVG icon files
- Special Steward Paths master icon
- Small Steward Paths app-size SVG variants
- Icon sprite sheet
- React/TypeScript `OyamaIcon` component
- Manifest JSON
- Browser preview page

## Core design language

- Dark Oyama green foundation
- Steward mint accents
- Clean CRM/SaaS outline icons
- Tile variants for dashboard cards and sidebar feature cards
- Special Steward Paths mark: rooted stewardship tree + branching automation path nodes

## Suggested install

1. Copy `icons/` into your design assets folder.
2. Copy `sprite/oyama-icons-sprite.svg` into your app `public/sprite/` folder.
3. Copy `react/OyamaIcon.tsx` into your shared UI components.
4. Use the special icon for `/steward-paths`, the Steward button, and path library empty states.

## Example

```tsx
import { OyamaIcon } from "@/components/OyamaIcon";

<OyamaIcon name="steward-paths-special" size={32} title="Steward Paths" />
<OyamaIcon name="path-library" size={22} />
```

## Notes

This pack was built from the Steward Paths V2 workspace direction:
Path Library → Create or Select Path → Build → Validate → Publish → Enroll → Run → Activity + Analytics.
