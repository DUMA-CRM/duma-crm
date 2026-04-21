export type Category = 'all' | 'coffee' | 'other-hot-drinks' | 'coffee-over-ice' | 'tea' | 'snacks';

export interface MenuOption {
  id?: string;
  label: string;
  price: number;
}

export interface PosModifierGroup {
  groupId: string;
  groupName: string;
  required: boolean;
  multiSelect: boolean;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  price: number;
  image: string;
  modifierGroups: PosModifierGroup[];
}

// groupId → selected option (null = none selected)
export type PendingOptions = Record<string, MenuOption | null>;

export interface CartItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  selections: PendingOptions;
}
