import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';

export default function ManagerInventory() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <EmptyState
          title="Inventory coming soon"
          description="Inventory management is disabled for now. You can continue managing orders without stock checks."
        />
      </Card>
    </div>
  );
}
