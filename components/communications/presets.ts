// Ready-made starting points for people who have never written an email template
// or set up an automation before. Template presets are authored as simple-mode
// blocks, so they open in the friendly editor rather than raw HTML.
import type { EmailAutomationPayload, EmailTemplatePayload } from '@/lib/api/email.service';

import { type SimpleBlock, blocksToPlainText, renderSimpleBody } from './simpleBody';

export interface TemplatePreset {
  key: string;
  name: string;
  category: string;
  subject: string;
  description: string;
  /** Which automation trigger this template is written for. */
  recommendedTrigger: string;
  blocks: SimpleBlock[];
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    key: 'order-confirmation',
    name: 'Order confirmation',
    category: 'orders',
    subject: 'We received your order {{order.number}}',
    description: 'Confirms an order straight away, with its items and total.',
    recommendedTrigger: 'An order is placed',
    blocks: [
      { type: 'heading', text: 'Thanks, {{customer.firstName}}!' },
      { type: 'text', text: 'We have your order {{order.number}} from {{location.name}} and are getting it ready.' },
      { type: 'text', text: '{{order.items}}\n\nTotal: {{order.total}}' },
      { type: 'divider' },
      { type: 'text', text: 'See you soon,\n{{brand.name}}' },
    ],
  },
  {
    key: 'order-ready',
    name: 'Order ready for collection',
    category: 'orders',
    subject: 'Your order {{order.number}} is ready',
    description: 'Tells the customer the moment their order is ready to collect.',
    recommendedTrigger: 'An order is ready for collection',
    blocks: [
      { type: 'heading', text: 'Your order is ready, {{customer.firstName}}' },
      { type: 'text', text: 'Order {{order.number}} is waiting for you at {{location.name}}.' },
      { type: 'text', text: '{{order.items}}' },
      { type: 'text', text: 'Thanks,\n{{brand.name}}' },
    ],
  },
  {
    key: 'order-completed',
    name: 'Order completed thank-you',
    category: 'orders',
    subject: 'Thanks for visiting {{location.name}}',
    description: 'A short thank-you once the order is finished.',
    recommendedTrigger: 'An order is completed',
    blocks: [
      { type: 'heading', text: 'Thank you, {{customer.firstName}}' },
      { type: 'text', text: 'We hope you enjoyed your order from {{location.name}}. Total: {{order.total}}.' },
      { type: 'text', text: 'We would love to see you again soon.' },
      { type: 'text', text: '{{brand.name}}' },
    ],
  },
  {
    key: 'welcome',
    name: 'Welcome new customer',
    category: 'lifecycle',
    subject: 'Welcome to {{brand.name}}, {{customer.firstName}}',
    description: 'Introduces your brand when a customer profile is created.',
    recommendedTrigger: 'A new customer is added',
    blocks: [
      { type: 'heading', text: 'Welcome, {{customer.firstName}}!' },
      { type: 'text', text: 'Thanks for joining {{brand.name}}. Every visit earns you loyalty points towards a free drink.' },
      { type: 'button', text: 'See what we serve', url: 'https://' },
      { type: 'text', text: 'See you at {{location.name}},\n{{brand.name}}' },
    ],
  },
  {
    key: 'birthday',
    name: 'Happy birthday',
    category: 'birthday',
    subject: 'Happy birthday, {{customer.firstName}}! 🎉',
    description: 'A warm birthday greeting for opted-in customers.',
    recommendedTrigger: "It is a customer's birthday · on the day",
    blocks: [
      { type: 'heading', text: 'Happy birthday, {{customer.firstName}}! 🎂' },
      { type: 'text', text: 'Everyone at {{brand.name}} hopes your day is full of good coffee and great company.' },
      { type: 'text', text: 'Pop in whenever you like — the first cup is on us.' },
      { type: 'text', text: 'With love,\n{{brand.name}}' },
    ],
  },
  {
    key: 'birthday-coming',
    name: 'Birthday coming soon',
    category: 'birthday',
    subject: 'Your birthday is nearly here, {{customer.firstName}}',
    description: 'Starts the celebration a week before the birthday.',
    recommendedTrigger: "It is a customer's birthday · 7 days before",
    blocks: [
      { type: 'heading', text: 'Your birthday week starts now ✨' },
      { type: 'text', text: 'Hi {{customer.firstName}}, we wanted to start the celebrations early.' },
      { type: 'text', text: 'Drop by {{location.name}} this week and let us treat you.' },
      { type: 'text', text: '{{brand.name}}' },
    ],
  },
  {
    key: 'win-back',
    name: 'We miss you',
    category: 'lifecycle',
    subject: 'It has been a while, {{customer.firstName}}',
    description: 'Gently invites a customer back after a quiet spell.',
    recommendedTrigger: 'A customer has not visited for a while',
    blocks: [
      { type: 'heading', text: 'We miss you, {{customer.firstName}}' },
      { type: 'text', text: 'It has been a little while since your last visit to {{location.name}}.' },
      { type: 'text', text: 'Your loyalty points are still waiting for you — come and spend them.' },
      { type: 'button', text: 'Find us', url: 'https://' },
      { type: 'text', text: '{{brand.name}}' },
    ],
  },
];

/** Preset turned into a template payload the editor can open directly. */
export function presetPayload(preset: TemplatePreset): EmailTemplatePayload {
  return {
    name: preset.name,
    category: preset.category,
    subject: preset.subject,
    htmlBody: renderSimpleBody(preset.blocks),
    textBody: blocksToPlainText(preset.blocks),
    isActive: true,
  };
}

export { TEMPLATE_PRESETS };

export interface AutomationPreset {
  key: string;
  name: string;
  description: string;
  /** Template preset that pairs with this scenario, matched on name. */
  suggestedTemplate: string;
  initial: Partial<EmailAutomationPayload>;
}

export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    key: 'order-confirmation',
    name: 'Confirm every order',
    description: 'Emails a confirmation the moment an order is placed.',
    suggestedTemplate: 'Order confirmation',
    initial: { name: 'Order confirmation', trigger: 'order_created', offsetDays: 0 },
  },
  {
    key: 'order-ready',
    name: 'Tell customers their order is ready',
    description: 'Great for collection orders — no more waiting at the counter.',
    suggestedTemplate: 'Order ready for collection',
    initial: { name: 'Order ready for collection', trigger: 'order_ready', offsetDays: 0 },
  },
  {
    key: 'order-completed',
    name: 'Thank customers afterwards',
    description: 'Sends a thank-you once the order is marked completed.',
    suggestedTemplate: 'Order completed thank-you',
    initial: { name: 'Order completed follow-up', trigger: 'order_completed', offsetDays: 0 },
  },
  {
    key: 'welcome',
    name: 'Welcome new customers',
    description: 'Introduces your brand and loyalty scheme to new sign-ups.',
    suggestedTemplate: 'Welcome new customer',
    initial: { name: 'Welcome new customer', trigger: 'customer_created', offsetDays: 0 },
  },
  {
    key: 'birthday',
    name: 'Birthday greeting',
    description: 'Celebrates with opted-in customers on the day itself.',
    suggestedTemplate: 'Happy birthday',
    initial: { name: 'Birthday greeting', trigger: 'customer_birthday', offsetDays: 0 },
  },
  {
    key: 'birthday-week',
    name: 'Birthday week reminder',
    description: 'Lands seven days before the birthday, so they can plan a visit.',
    suggestedTemplate: 'Birthday coming soon',
    initial: { name: 'Birthday week reminder', trigger: 'customer_birthday', offsetDays: -7 },
  },
  {
    key: 'win-back',
    name: '30-day win-back',
    description: 'Reaches out once an opted-in customer has been away for a month.',
    suggestedTemplate: 'We miss you',
    initial: { name: '30-day win-back', trigger: 'customer_inactive', offsetDays: 30 },
  },
];
