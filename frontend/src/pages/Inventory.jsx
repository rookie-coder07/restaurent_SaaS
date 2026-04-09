import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';

export default function Inventory() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <EmptyState
          title="Inventory coming soon"
          description="Inventory tracking is temporarily disabled. Orders, KOTs, and bills will continue without stock restrictions."
        />
      </Card>
    </div>
  );
}
