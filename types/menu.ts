export type MenuCategory = 'coffee' | 'other-hot-drinks' | 'coffee-over-ice' | 'tea' | 'snacks';

export interface MenuItem {
	id: string;
	tenantId: string;
	name: string;
	description?: string;
	category: MenuCategory;
	basePrice: string;
	isAvailable: boolean;
	imageUrl?: string;
	createdAt: string;
}

export interface MenuItemPayload {
	tenantId: string;
	name: string;
	category: MenuCategory;
	basePrice: string;
	description?: string;
	isAvailable?: boolean;
	imageUrl?: string;
}

export interface ModifierGroup {
	id: string;
	tenantId: string;
	name: string;
	required: boolean;
	multiSelect: boolean;
	sortOrder: number;
	createdAt: string;
}

export interface ModifierGroupPayload {
	tenantId: string;
	name: string;
	required?: boolean;
	multiSelect?: boolean;
	sortOrder?: number;
}

export type ModifierType = 'size' | 'milk' | 'syrup' | 'extra' | 'remove';


export interface Modifier {
	id: string;
	tenantId: string;
	groupId: string;
	type: ModifierType;
	name: string;
	priceAdjust?: string;
	isDefault: boolean;
	isAvailable: boolean;
	sortOrder: number;
	createdAt: string;
}

export interface ModifierPayload {
	tenantId: string;
	groupId: string;
	type: ModifierType;
	name: string;
	priceAdjust?: string;
	isDefault?: boolean;
	isAvailable?: boolean;
	sortOrder?: number;
}

export interface MenuItemModifierGroupLink {
	id: string;
	menuItemId: string;
	modifierGroupId: string;
}

export interface LocationMenuItem {
	id: string;
	locationId: string;
	menuItemId: string;
	priceOverride?: string;
	isAvailable: boolean;
}

export interface LocationModifier {
	id: string;
	locationId: string;
	modifierId: string;
	priceOverride?: string;
	isAvailable: boolean;
}
