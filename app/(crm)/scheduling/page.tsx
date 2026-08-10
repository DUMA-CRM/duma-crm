import { MyRota } from '@/components/scheduling/MyRota';

/** Your own rota. The team rota and shift cover are tabs of the staff workspace. */
export default function MyRotaPage() {
  // MyRota owns its EditorShell, same as the other top-level workspaces.
  return <MyRota />;
}
