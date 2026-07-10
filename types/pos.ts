export type Category = 'all' | 'coffee' | 'other-hot-drinks' | 'coffee-over-ice' | 'tea' | 'snacks';

// A reusable modifier presented as a toggleable add-on in the POS. Price in pence.
export interface MenuOption {
  id: string;
  label: string;
  price: number;
  // Optional grouping label (e.g. "Milk", "Size"); undefined = uncategorised.
  category?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  price: number; // pence
  image: string;
  // Flat list of add-ons attached to this item (multi-select).
  modifiers: MenuOption[];
}

export interface CartItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  // Chosen add-ons for this line.
  selected: MenuOption[];
}
