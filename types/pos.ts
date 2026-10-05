export type Category = string;

// A reusable modifier presented as a toggleable add-on in the POS. Price in pence.
export interface MenuOption {
  id: string;
  label: string;
  price: number;
  // Optional grouping label (e.g. "Milk", "Size"); undefined = uncategorised.
  category?: string;
  // Pre-selected as the item's default variant when the customiser opens.
  isDefault?: boolean;
  // The modifier group whose selection rule applies (see `buildOptionGroups`).
  groupId?: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  category: Category;
  price: number; // pence
  image: string;
  // Flat list of add-ons attached to this item (multi-select).
  modifiers: MenuOption[];
  // False while this item's modifier query is still streaming in — an empty
  // `modifiers` array is only trustworthy once this is true.
  modifiersLoaded?: boolean;
}

export interface CartItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  // Chosen add-ons for this line.
  selected: MenuOption[];
  // Kitchen note for this line only ("no foam") — sent as `items[].notes`.
  note?: string;
}

export interface AppliedLoyaltyReward {
  programId: string;
  cartId: string;
  modifierId?: string;
  quantity: number;
  unitDiscountCents: number;
  discountCents: number;
  label: string;
}
