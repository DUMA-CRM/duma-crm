/**
 * Hugeicons (free) — the app's single icon source.
 *
 * Each icon is re-exported as a plain component so call sites keep the shape they
 * had before: `<Coffee className="h-4 w-4" />` and `icon={Coffee}` both work.
 * Hugeicons' own API takes the glyph as data (`<HugeiconsIcon icon={CoffeeIcon} />`),
 * which can't be passed around as a component the way this codebase does.
 *
 * Names on the left are ours; names on the right are Hugeicons'. Where the two sets
 * don't line up one-to-one, the closest free Hugeicon is used.
 */
import {
  ActivityIcon,
  Alert02Icon,
  AlertCircleIcon,
  ArchiveIcon,
  ArrowDownIcon,
  ArrowDownRightIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  AwardIcon,
  BanIcon,
  BanknoteIcon,
  BarChartIcon,
  BarcodeIcon,
  BellIcon,
  BookMarkedIcon,
  BookOpenCheckIcon,
  BookOpenIcon,
  BoxIcon,
  BoxesIcon,
  BuildingIcon,
  CalculatorIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CalendarRangeIcon,
  CallIcon,
  CameraIcon,
  Cancel01Icon,
  CandyIcon,
  ChampionIcon,
  ChartLineIcon,
  CheckIcon,
  CheckListIcon,
  ChefHatIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsUpIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDollarSignIcon,
  CircleDotIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  ClockIcon,
  CloudOffIcon,
  CloudUploadIcon,
  CoffeeIcon,
  CoinsIcon,
  CombineIcon,
  ComputerIcon,
  CopyIcon,
  CreditCardIcon,
  CursorMove01Icon,
  DashboardSquare01Icon,
  Delete02Icon,
  DownloadIcon,
  DropletIcon,
  DropletsIcon,
  Edit03Icon,
  EggIcon,
  EqualSignIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  File01Icon,
  FileEditIcon,
  FingerPrintIcon,
  FlameIcon,
  FlaskConicalIcon,
  GaugeIcon,
  GiftIcon,
  GitCompareArrowsIcon,
  GlobeIcon,
  GraduationCapIcon,
  Grid2X2Icon,
  HeadphonesIcon,
  HeartHandshakeIcon,
  HeartPulseIcon,
  HelpCircleIcon,
  HistoryIcon,
  ImageAddIcon,
  InformationCircleIcon,
  Invoice01Icon,
  KeyIcon,
  KitchenUtensilsIcon,
  LandmarkIcon,
  LayersIcon,
  LayoutGridIcon,
  LeafIcon,
  LibraryIcon,
  LifebuoyIcon,
  LinkIcon,
  ListViewIcon,
  Loading03Icon,
  Location01Icon,
  LockIcon,
  Login03Icon,
  Logout03Icon,
  MailIcon,
  MailRemove01Icon,
  Maximize04Icon,
  MegaphoneIcon,
  MenuIcon,
  MessageAdd01Icon,
  MinusSignIcon,
  Moon02Icon,
  MoreHorizontalIcon,
  PackageAddIcon,
  PackageDeliveredIcon,
  PackageIcon,
  PackageOpenIcon,
  PackageRemove01Icon,
  PackageSearchIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightIcon,
  Plant01Icon,
  PlayIcon,
  PlugIcon,
  PlugSocketIcon,
  PlusSignIcon,
  PrinterIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  Refresh01Icon,
  RepeatIcon,
  RouteIcon,
  ScanIcon,
  ScissorIcon,
  SearchIcon,
  SecurityBlockIcon,
  SecurityCheckIcon,
  SecurityWarningIcon,
  SentIcon,
  ServerStack01Icon,
  SettingsIcon,
  ShieldIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  SmartPhone01Icon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  SunIcon,
  SwitchCameraIcon,
  TagIcon,
  TagsIcon,
  TargetIcon,
  TimerIcon,
  TradeDownIcon,
  TradeUpIcon,
  TruckIcon,
  UnfoldMoreIcon,
  UserAddIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  UserMinusIcon,
  UserMultipleIcon,
  VideoOffIcon,
  VolumeHighIcon,
  VolumeOffIcon,
  WalletCardsIcon,
  WalletIcon,
  WeightScaleIcon,
  WheatIcon,
  WifiOffIcon,
  WrenchIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import type { FC } from 'react';

export type IconProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, 'icon' | 'altIcon' | 'showAlt'>;

/** A renderable icon — the type to use when an icon is passed around as a value. */
export type IconComponent = FC<IconProps>;

const glyph = (svg: IconSvgElement, name: string): IconComponent => {
  const Icon: IconComponent = (props) => <HugeiconsIcon icon={svg} {...props} />;
  Icon.displayName = name;
  return Icon;
};

export const Activity = /*#__PURE__*/ glyph(ActivityIcon, 'Activity');
export const AlertCircle = /*#__PURE__*/ glyph(AlertCircleIcon, 'AlertCircle');
export const AlertTriangle = /*#__PURE__*/ glyph(Alert02Icon, 'AlertTriangle');
export const Archive = /*#__PURE__*/ glyph(ArchiveIcon, 'Archive');
export const ArrowDown = /*#__PURE__*/ glyph(ArrowDownIcon, 'ArrowDown');
export const ArrowDownRight = /*#__PURE__*/ glyph(ArrowDownRightIcon, 'ArrowDownRight');
export const ArrowLeft = /*#__PURE__*/ glyph(ArrowLeftIcon, 'ArrowLeft');
export const ArrowLeftRight = /*#__PURE__*/ glyph(ArrowLeftRightIcon, 'ArrowLeftRight');
export const ArrowRight = /*#__PURE__*/ glyph(ArrowRightIcon, 'ArrowRight');
export const ArrowUp = /*#__PURE__*/ glyph(ArrowUpIcon, 'ArrowUp');
export const ArrowUpRight = /*#__PURE__*/ glyph(ArrowUpRightIcon, 'ArrowUpRight');
export const Award = /*#__PURE__*/ glyph(AwardIcon, 'Award');
export const Ban = /*#__PURE__*/ glyph(BanIcon, 'Ban');
export const Banknote = /*#__PURE__*/ glyph(BanknoteIcon, 'Banknote');
export const BarChart3 = /*#__PURE__*/ glyph(BarChartIcon, 'BarChart3');
export const Barcode = /*#__PURE__*/ glyph(BarcodeIcon, 'Barcode');
export const Bell = /*#__PURE__*/ glyph(BellIcon, 'Bell');
export const BookMarked = /*#__PURE__*/ glyph(BookMarkedIcon, 'BookMarked');
export const BookOpen = /*#__PURE__*/ glyph(BookOpenIcon, 'BookOpen');
export const BookOpenCheck = /*#__PURE__*/ glyph(BookOpenCheckIcon, 'BookOpenCheck');
export const Box = /*#__PURE__*/ glyph(BoxIcon, 'Box');
export const Boxes = /*#__PURE__*/ glyph(BoxesIcon, 'Boxes');
export const Building2 = /*#__PURE__*/ glyph(BuildingIcon, 'Building2');
export const Calculator = /*#__PURE__*/ glyph(CalculatorIcon, 'Calculator');
export const Calendar = /*#__PURE__*/ glyph(CalendarIcon, 'Calendar');
export const CalendarCheck = /*#__PURE__*/ glyph(CalendarCheckIcon, 'CalendarCheck');
export const CalendarClock = /*#__PURE__*/ glyph(CalendarClockIcon, 'CalendarClock');
export const CalendarDays = /*#__PURE__*/ glyph(CalendarDaysIcon, 'CalendarDays');
export const CalendarRange = /*#__PURE__*/ glyph(CalendarRangeIcon, 'CalendarRange');
export const Camera = /*#__PURE__*/ glyph(CameraIcon, 'Camera');
export const Candy = /*#__PURE__*/ glyph(CandyIcon, 'Candy');
export const Check = /*#__PURE__*/ glyph(CheckIcon, 'Check');
export const CheckCircle2 = /*#__PURE__*/ glyph(CircleCheckIcon, 'CheckCircle2');
export const ChefHat = /*#__PURE__*/ glyph(ChefHatIcon, 'ChefHat');
export const ChevronDown = /*#__PURE__*/ glyph(ChevronDownIcon, 'ChevronDown');
export const ChevronLeft = /*#__PURE__*/ glyph(ChevronLeftIcon, 'ChevronLeft');
export const ChevronRight = /*#__PURE__*/ glyph(ChevronRightIcon, 'ChevronRight');
export const ChevronsUp = /*#__PURE__*/ glyph(ChevronsUpIcon, 'ChevronsUp');
export const ChevronsUpDown = /*#__PURE__*/ glyph(UnfoldMoreIcon, 'ChevronsUpDown');
export const ChevronUp = /*#__PURE__*/ glyph(ChevronUpIcon, 'ChevronUp');
export const CircleAlert = /*#__PURE__*/ glyph(AlertCircleIcon, 'CircleAlert');
export const CircleDashed = /*#__PURE__*/ glyph(CircleDashedIcon, 'CircleDashed');
export const CircleDollarSign = /*#__PURE__*/ glyph(CircleDollarSignIcon, 'CircleDollarSign');
export const CircleDot = /*#__PURE__*/ glyph(CircleDotIcon, 'CircleDot');
export const CircleHelp = /*#__PURE__*/ glyph(HelpCircleIcon, 'CircleHelp');
export const ClipboardCheck = /*#__PURE__*/ glyph(ClipboardCheckIcon, 'ClipboardCheck');
export const ClipboardList = /*#__PURE__*/ glyph(ClipboardListIcon, 'ClipboardList');
export const Clock = /*#__PURE__*/ glyph(ClockIcon, 'Clock');
export const Clock3 = /*#__PURE__*/ glyph(ClockIcon, 'Clock3');
export const CloudOff = /*#__PURE__*/ glyph(CloudOffIcon, 'CloudOff');
export const CloudUpload = /*#__PURE__*/ glyph(CloudUploadIcon, 'CloudUpload');
export const Coffee = /*#__PURE__*/ glyph(CoffeeIcon, 'Coffee');
export const Coins = /*#__PURE__*/ glyph(CoinsIcon, 'Coins');
export const Combine = /*#__PURE__*/ glyph(CombineIcon, 'Combine');
export const Copy = /*#__PURE__*/ glyph(CopyIcon, 'Copy');
export const CreditCard = /*#__PURE__*/ glyph(CreditCardIcon, 'CreditCard');
export const CursorMove = /*#__PURE__*/ glyph(CursorMove01Icon, 'CursorMove');
export const Download = /*#__PURE__*/ glyph(DownloadIcon, 'Download');
export const Droplet = /*#__PURE__*/ glyph(DropletIcon, 'Droplet');
export const Droplets = /*#__PURE__*/ glyph(DropletsIcon, 'Droplets');
export const Egg = /*#__PURE__*/ glyph(EggIcon, 'Egg');
export const Equal = /*#__PURE__*/ glyph(EqualSignIcon, 'Equal');
export const ExternalLink = /*#__PURE__*/ glyph(ExternalLinkIcon, 'ExternalLink');
export const Eye = /*#__PURE__*/ glyph(EyeIcon, 'Eye');
export const EyeOff = /*#__PURE__*/ glyph(EyeOffIcon, 'EyeOff');
export const FileEdit = /*#__PURE__*/ glyph(FileEditIcon, 'FileEdit');
export const FileText = /*#__PURE__*/ glyph(File01Icon, 'FileText');
export const Fingerprint = /*#__PURE__*/ glyph(FingerPrintIcon, 'Fingerprint');
export const Flame = /*#__PURE__*/ glyph(FlameIcon, 'Flame');
export const FlaskConical = /*#__PURE__*/ glyph(FlaskConicalIcon, 'FlaskConical');
export const Gauge = /*#__PURE__*/ glyph(GaugeIcon, 'Gauge');
export const Gift = /*#__PURE__*/ glyph(GiftIcon, 'Gift');
export const GitCompareArrows = /*#__PURE__*/ glyph(GitCompareArrowsIcon, 'GitCompareArrows');
export const Globe = /*#__PURE__*/ glyph(GlobeIcon, 'Globe');
export const GraduationCap = /*#__PURE__*/ glyph(GraduationCapIcon, 'GraduationCap');
export const Grid2X2 = /*#__PURE__*/ glyph(Grid2X2Icon, 'Grid2X2');
export const Headphones = /*#__PURE__*/ glyph(HeadphonesIcon, 'Headphones');
export const HeartHandshake = /*#__PURE__*/ glyph(HeartHandshakeIcon, 'HeartHandshake');
export const HeartPulse = /*#__PURE__*/ glyph(HeartPulseIcon, 'HeartPulse');
export const HelpCircle = /*#__PURE__*/ glyph(HelpCircleIcon, 'HelpCircle');
export const History = /*#__PURE__*/ glyph(HistoryIcon, 'History');
export const ImagePlus = /*#__PURE__*/ glyph(ImageAddIcon, 'ImagePlus');
export const Info = /*#__PURE__*/ glyph(InformationCircleIcon, 'Info');
export const KeyRound = /*#__PURE__*/ glyph(KeyIcon, 'KeyRound');
export const Landmark = /*#__PURE__*/ glyph(LandmarkIcon, 'Landmark');
export const Layers3 = /*#__PURE__*/ glyph(LayersIcon, 'Layers3');
export const LayoutDashboard = /*#__PURE__*/ glyph(DashboardSquare01Icon, 'LayoutDashboard');
export const LayoutGrid = /*#__PURE__*/ glyph(LayoutGridIcon, 'LayoutGrid');
export const Leaf = /*#__PURE__*/ glyph(LeafIcon, 'Leaf');
export const LibraryBig = /*#__PURE__*/ glyph(LibraryIcon, 'LibraryBig');
export const LifeBuoy = /*#__PURE__*/ glyph(LifebuoyIcon, 'LifeBuoy');
export const LineChart = /*#__PURE__*/ glyph(ChartLineIcon, 'LineChart');
export const Link2 = /*#__PURE__*/ glyph(LinkIcon, 'Link2');
export const ListChecks = /*#__PURE__*/ glyph(CheckListIcon, 'ListChecks');
export const ListView = /*#__PURE__*/ glyph(ListViewIcon, 'ListView');
export const Loader2 = /*#__PURE__*/ glyph(Loading03Icon, 'Loader2');
export const Lock = /*#__PURE__*/ glyph(LockIcon, 'Lock');
export const LogIn = /*#__PURE__*/ glyph(Login03Icon, 'LogIn');
export const LogOut = /*#__PURE__*/ glyph(Logout03Icon, 'LogOut');
export const Mail = /*#__PURE__*/ glyph(MailIcon, 'Mail');
export const MailX = /*#__PURE__*/ glyph(MailRemove01Icon, 'MailX');
export const MapPin = /*#__PURE__*/ glyph(Location01Icon, 'MapPin');
export const Maximize = /*#__PURE__*/ glyph(Maximize04Icon, 'Maximize');
export const Megaphone = /*#__PURE__*/ glyph(MegaphoneIcon, 'Megaphone');
export const Menu = /*#__PURE__*/ glyph(MenuIcon, 'Menu');
export const MessageSquarePlus = /*#__PURE__*/ glyph(MessageAdd01Icon, 'MessageSquarePlus');
export const Minus = /*#__PURE__*/ glyph(MinusSignIcon, 'Minus');
export const Monitor = /*#__PURE__*/ glyph(ComputerIcon, 'Monitor');
export const Moon = /*#__PURE__*/ glyph(Moon02Icon, 'Moon');
export const MoreHorizontal = /*#__PURE__*/ glyph(MoreHorizontalIcon, 'MoreHorizontal');
export const Package = /*#__PURE__*/ glyph(PackageIcon, 'Package');
export const PackageCheck = /*#__PURE__*/ glyph(PackageDeliveredIcon, 'PackageCheck');
export const PackageMinus = /*#__PURE__*/ glyph(PackageRemove01Icon, 'PackageMinus');
export const PackageOpen = /*#__PURE__*/ glyph(PackageOpenIcon, 'PackageOpen');
export const PackagePlus = /*#__PURE__*/ glyph(PackageAddIcon, 'PackagePlus');
export const PackageSearch = /*#__PURE__*/ glyph(PackageSearchIcon, 'PackageSearch');
export const PanelLeftClose = /*#__PURE__*/ glyph(PanelLeftCloseIcon, 'PanelLeftClose');
export const PanelLeftOpen = /*#__PURE__*/ glyph(PanelLeftOpenIcon, 'PanelLeftOpen');
export const PanelRight = /*#__PURE__*/ glyph(PanelRightIcon, 'PanelRight');
export const Pencil = /*#__PURE__*/ glyph(Edit03Icon, 'Pencil');
export const Phone = /*#__PURE__*/ glyph(CallIcon, 'Phone');
export const Play = /*#__PURE__*/ glyph(PlayIcon, 'Play');
export const Plug = /*#__PURE__*/ glyph(PlugIcon, 'Plug');
export const PlugZap = /*#__PURE__*/ glyph(PlugSocketIcon, 'PlugZap');
export const Plus = /*#__PURE__*/ glyph(PlusSignIcon, 'Plus');
export const Printer = /*#__PURE__*/ glyph(PrinterIcon, 'Printer');
export const QrCode = /*#__PURE__*/ glyph(QrCodeIcon, 'QrCode');
export const Radio = /*#__PURE__*/ glyph(CircleDotIcon, 'Radio');
export const Receipt = /*#__PURE__*/ glyph(Invoice01Icon, 'Receipt');
export const ReceiptText = /*#__PURE__*/ glyph(ReceiptTextIcon, 'ReceiptText');
export const RefreshCw = /*#__PURE__*/ glyph(Refresh01Icon, 'RefreshCw');
export const Repeat = /*#__PURE__*/ glyph(RepeatIcon, 'Repeat');
export const RotateCcw = /*#__PURE__*/ glyph(Refresh01Icon, 'RotateCcw');
export const Route = /*#__PURE__*/ glyph(RouteIcon, 'Route');
export const Scale = /*#__PURE__*/ glyph(WeightScaleIcon, 'Scale');
export const ScanLine = /*#__PURE__*/ glyph(ScanIcon, 'ScanLine');
export const Scissors = /*#__PURE__*/ glyph(ScissorIcon, 'Scissors');
export const Search = /*#__PURE__*/ glyph(SearchIcon, 'Search');
export const Send = /*#__PURE__*/ glyph(SentIcon, 'Send');
export const Server = /*#__PURE__*/ glyph(ServerStack01Icon, 'Server');
export const Settings = /*#__PURE__*/ glyph(SettingsIcon, 'Settings');
export const Shield = /*#__PURE__*/ glyph(ShieldIcon, 'Shield');
export const ShieldAlert = /*#__PURE__*/ glyph(SecurityWarningIcon, 'ShieldAlert');
export const ShieldCheck = /*#__PURE__*/ glyph(SecurityCheckIcon, 'ShieldCheck');
export const ShieldOff = /*#__PURE__*/ glyph(SecurityBlockIcon, 'ShieldOff');
export const ShoppingBag = /*#__PURE__*/ glyph(ShoppingBagIcon, 'ShoppingBag');
export const ShoppingCart = /*#__PURE__*/ glyph(ShoppingCartIcon, 'ShoppingCart');
export const SlidersHorizontal = /*#__PURE__*/ glyph(SlidersHorizontalIcon, 'SlidersHorizontal');
export const Smartphone = /*#__PURE__*/ glyph(SmartPhone01Icon, 'Smartphone');
export const Sparkles = /*#__PURE__*/ glyph(SparklesIcon, 'Sparkles');
export const Sprout = /*#__PURE__*/ glyph(Plant01Icon, 'Sprout');
export const Star = /*#__PURE__*/ glyph(StarIcon, 'Star');
export const Store = /*#__PURE__*/ glyph(StoreIcon, 'Store');
export const Sun = /*#__PURE__*/ glyph(SunIcon, 'Sun');
export const SwitchCamera = /*#__PURE__*/ glyph(SwitchCameraIcon, 'SwitchCamera');
export const Tag = /*#__PURE__*/ glyph(TagIcon, 'Tag');
export const Tags = /*#__PURE__*/ glyph(TagsIcon, 'Tags');
export const Target = /*#__PURE__*/ glyph(TargetIcon, 'Target');
export const Timer = /*#__PURE__*/ glyph(TimerIcon, 'Timer');
export const Trash2 = /*#__PURE__*/ glyph(Delete02Icon, 'Trash2');
export const TrendingDown = /*#__PURE__*/ glyph(TradeDownIcon, 'TrendingDown');
export const TrendingUp = /*#__PURE__*/ glyph(TradeUpIcon, 'TrendingUp');
export const TriangleAlert = /*#__PURE__*/ glyph(Alert02Icon, 'TriangleAlert');
export const Trophy = /*#__PURE__*/ glyph(ChampionIcon, 'Trophy');
export const Truck = /*#__PURE__*/ glyph(TruckIcon, 'Truck');
export const UploadCloud = /*#__PURE__*/ glyph(CloudUploadIcon, 'UploadCloud');
export const User = /*#__PURE__*/ glyph(UserIcon, 'User');
export const UserCircle2 = /*#__PURE__*/ glyph(UserCircleIcon, 'UserCircle2');
export const UserMinus = /*#__PURE__*/ glyph(UserMinusIcon, 'UserMinus');
export const UserPlus = /*#__PURE__*/ glyph(UserAddIcon, 'UserPlus');
export const UserRound = /*#__PURE__*/ glyph(UserIcon, 'UserRound');
export const Users = /*#__PURE__*/ glyph(UserMultipleIcon, 'Users');
export const UsersRound = /*#__PURE__*/ glyph(UserGroupIcon, 'UsersRound');
export const UtensilsCrossed = /*#__PURE__*/ glyph(KitchenUtensilsIcon, 'UtensilsCrossed');
export const VideoOff = /*#__PURE__*/ glyph(VideoOffIcon, 'VideoOff');
export const Volume2 = /*#__PURE__*/ glyph(VolumeHighIcon, 'Volume2');
export const VolumeX = /*#__PURE__*/ glyph(VolumeOffIcon, 'VolumeX');
export const Wallet = /*#__PURE__*/ glyph(WalletIcon, 'Wallet');
export const WalletCards = /*#__PURE__*/ glyph(WalletCardsIcon, 'WalletCards');
export const Wheat = /*#__PURE__*/ glyph(WheatIcon, 'Wheat');
export const WifiOff = /*#__PURE__*/ glyph(WifiOffIcon, 'WifiOff');
export const Wrench = /*#__PURE__*/ glyph(WrenchIcon, 'Wrench');
export const X = /*#__PURE__*/ glyph(Cancel01Icon, 'X');
export const XCircle = /*#__PURE__*/ glyph(CircleXIcon, 'XCircle');
export const Zap = /*#__PURE__*/ glyph(ZapIcon, 'Zap');
