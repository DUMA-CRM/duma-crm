import {
  AlignLeft,
  Braces,
  Calendar,
  Clock,
  Globe,
  Hash,
  type IconComponent,
  ImageIcon,
  Layers,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Palette,
  Pilcrow,
  Tag,
  ToggleRight,
  Type,
} from '@/components/icons';

import type { CmsFieldType } from '@/lib/modules/cms/client';

/** One glyph per field type, used wherever a field is shown as a tile. */
export const FIELD_ICONS: Record<CmsFieldType, IconComponent> = {
  text: Type,
  longText: AlignLeft,
  richText: Pilcrow,
  slug: Tag,
  email: Mail,
  url: Globe,
  number: Hash,
  boolean: ToggleRight,
  date: Calendar,
  dateTime: Clock,
  select: ListChecks,
  color: Palette,
  location: MapPin,
  media: ImageIcon,
  reference: Link2,
  group: Layers,
  json: Braces,
};
