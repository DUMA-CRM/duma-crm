export type Category = 'all' | 'coffee' | 'other-hot-drinks' | 'coffee-over-ice' | 'tea' | 'snacks';

export interface MenuOption {
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  price: number;
  image: string;
  sizes?: MenuOption[];
  milk?: MenuOption[];
  syrups?: MenuOption[];
}

export interface CartItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  size: MenuOption | null;
  milk: MenuOption | null;
  syrup: MenuOption | null;
}

export interface PendingOptions {
  size: MenuOption | null;
  milk: MenuOption | null;
  syrup: MenuOption | null;
}
