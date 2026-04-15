import type { Category, MenuOption, MenuItem } from '@/types/pos';

export const LOYALTY_DISCOUNT = 0.05;

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'other-hot-drinks', label: 'Other Hot Drinks' },
  { value: 'coffee-over-ice', label: 'Coffee Over Ice' },
  { value: 'tea', label: 'Tea' },
  { value: 'snacks', label: 'Snacks' },
];

export const SIZE_OPTIONS: MenuOption[] = [
  { label: 'S', price: 0 },
  { label: 'M', price: 10 },
  { label: 'L', price: 20 },
];
export const MILK_OPTIONS: MenuOption[] = [
  { label: 'Standard', price: 0 },
  { label: 'Oat', price: 15 },
  { label: 'Almond', price: 20 },
  { label: 'Soy', price: 15 },
];
export const SYRUP_OPTIONS: MenuOption[] = [
  { label: 'None', price: 0 },
  { label: 'Vanilla', price: 10 },
  { label: 'Caramel', price: 10 },
  { label: 'Hazelnut', price: 10 },
];

export const MENU: MenuItem[] = [
  {
    id: '1',
    name: 'Flat White',
    category: 'coffee',
    price: 85,
    image: 'https://mdm-assets.integration.costacoffee.com/vended-product/ebe22988-1a40-45a9-b59a-792437ffa868/drinks/Flat_White_Thumb.png',
    sizes: SIZE_OPTIONS,
    milk: MILK_OPTIONS,
    syrups: SYRUP_OPTIONS,
  },
  {
    id: '2',
    name: 'Cappuccino',
    category: 'coffee',
    price: 75,
    image: 'https://mdm-assets.integration.costacoffee.com/vended-product/ebe22988-1a40-45a9-b59a-792437ffa868/drinks/Cappucino_Thumb.png',
    sizes: SIZE_OPTIONS,
    milk: MILK_OPTIONS,
    syrups: SYRUP_OPTIONS,
  },
  {
    id: '3',
    name: 'Latte',
    category: 'coffee',
    price: 60,
    image: 'https://mdm-assets.integration.costacoffee.com/vended-product/3df03589-0367-4516-907c-58dda30bcb4c/Latte_Thumb.png',
    sizes: SIZE_OPTIONS,
    milk: MILK_OPTIONS,
    syrups: SYRUP_OPTIONS,
  },
  {
    id: '4',
    name: 'Double Shot',
    category: 'coffee',
    price: 65,
    image: 'https://mdm-assets.integration.costacoffee.com/vended-product/ebe22988-1a40-45a9-b59a-792437ffa868/drinks/Espresso_Thumb.png',
    sizes: SIZE_OPTIONS,
  },
  {
    id: '5',
    name: 'Americano',
    category: 'coffee',
    price: 55,
    image:
      'https://mdm-assets.integration.costacoffee.com/vended-product/b598c0f3-bd2d-487f-b30b-38c33948fb7a/Costa_Americano_High_Angle_thumbnail.jpeg',
    sizes: SIZE_OPTIONS,
  },
  {
    id: '6',
    name: 'Espresso',
    category: 'coffee',
    price: 45,
    image: 'https://mdm-assets.integration.costacoffee.com/vended-product/ebe22988-1a40-45a9-b59a-792437ffa868/drinks/Espresso_Thumb.png',
  },
  {
    id: '7',
    name: 'V60 Ethiopia',
    category: 'coffee',
    price: 110,
    image: 'https://mdm-assets.integration.costacoffee.com/vended-product/3df03589-0367-4516-907c-58dda30bcb4c/Latte_Thumb.png',
    sizes: [SIZE_OPTIONS[0], SIZE_OPTIONS[1]],
  },
  {
    id: '8',
    name: 'Matcha Latte',
    category: 'tea',
    price: 95,
    image:
      'https://mdm-assets.integration.costacoffee.com/vended-product/20311dec-4849-49bd-9adb-c2c06b681b3c/Hot_Matcha_Latte_thumbnail.jpg',
    sizes: SIZE_OPTIONS,
    milk: MILK_OPTIONS,
  },
  {
    id: '9',
    name: 'Chai Latte',
    category: 'other-hot-drinks',
    price: 85,
    image:
      'https://mdm-assets.integration.costacoffee.com/vended-product/648839ee-3bbe-4cec-9dff-d398e83991a6/4_MP-0000358_Costa_Chai_Latte_thumbnail.jpeg',
    sizes: SIZE_OPTIONS,
    milk: MILK_OPTIONS,
    syrups: SYRUP_OPTIONS,
  },
  {
    id: '10',
    name: 'Classic Croissant',
    category: 'snacks',
    price: 70,
    image:
      'https://mdm-assets.integration.costacoffee.com/vended-product/ebe22988-1a40-45a9-b59a-792437ffa868/food/Improved_Almond_Crossiant_Thumb.jpg',
  },
  {
    id: '11',
    name: 'Banana Bread',
    category: 'snacks',
    price: 60,
    image:
      'https://mdm-assets.integration.costacoffee.com/vended-product/983cb8b0-055e-48f6-b6a8-a8bf04432545/image_2023-12-27_110148545.png',
  },
  {
    id: '12',
    name: 'Almond Tart',
    category: 'snacks',
    price: 65,
    image:
      'https://mdm-assets.integration.costacoffee.com/vended-product/78dbbe71-72a7-4123-a5e6-d0c876cf1f62/Lemon_Curd_Tart_thumbnail.jpg',
  },
];
