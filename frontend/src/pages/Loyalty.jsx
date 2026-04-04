import { Gift, Loader, Percent, RefreshCcw, Star, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { analyticsAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';

export default function Loyalty() {
  const { data, loading, refetch } = useApi(analyticsAPI.getLoyaltySummary);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const topMembers = data?.topMembers || [];
  const recentActivity = data?.recentActivity || [];
  const program = data?.program || {};

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_35%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Loyalty</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Customer loyalty, repeat visits, and reward usage</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Keep an eye on loyal guests, how many points are being issued, and how much value the program is returning.
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Active Members" value={summary.activeMembers || 0} subtitle="Customers with loyalty history" iconTone="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
        <StatCard icon={Star} label="Repeat Customers" value={summary.repeatCustomers || 0} subtitle="More than one loyalty visit" iconTone="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={Gift} label="Points Issued" value={summary.totalPointsIssued || 0} subtitle={program.earnRule || 'Earn rule active'} iconTone="bg-amber-500/15 text-amber-400" />
        <StatCard icon={Percent} label="Redeemed Value" value={formatCurrency(summary.totalRedeemedAmount || 0)} subtitle={`${summary.totalRedeemedPoints || 0} points redeemed`} iconTone="bg-violet-500/15 text-violet-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Top Members</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Customers with the strongest loyalty balance</h2>
          <div className="mt-5 space-y-3">
            {topMembers.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No loyalty members yet"
                description="Once bills are settled with loyalty phone numbers, members will start appearing here."
              />
            ) : (
              topMembers.map((member) => (
                <div key={member.customerPhone} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-[var(--text-primary)]">{member.customerPhone}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {member.visitCount} visits • last seen {member.lastVisitAt ? formatDate(member.lastVisitAt) : 'recently'}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-bold text-[var(--color-primary)]">
                      {member.pointsBalance} pts
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-[var(--text-secondary)]">Spend</p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">{formatCurrency(member.totalSpend || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-secondary)]">Earned</p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">{member.totalEarnedPoints}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-secondary)]">Redeemed</p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">{member.totalRedeemedPoints}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-secondary)]">Savings</p>
                      <p className="mt-1 font-semibold text-[var(--text-primary)]">{formatCurrency(member.totalRedeemedAmount || 0)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Program Rules</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">How this loyalty program works</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Earn</p>
              <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">{program.earnRule || '1 point for every Rs 100 spent'}</p>
            </div>
            <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Redeem</p>
              <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">{program.redeemRule || '1 point = Rs 1 discount'}</p>
            </div>
            <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Owner Visibility</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                The owner can now see member growth, points issued, redemptions, and recent loyalty activity from one place.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <p className="text-sm text-[var(--text-secondary)]">Recent Activity</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Latest loyalty earn and redeem activity</h2>
        <div className="mt-5 space-y-3">
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No recent loyalty activity"
              description="New earn and redeem actions will show here after customers start using the program."
            />
          ) : (
            recentActivity.map((entry) => (
              <div key={`${entry.orderId}-${entry.createdAt}`} className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{entry.customerPhone}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(entry.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-sm font-semibold text-[var(--text-primary)]">
                    {formatCurrency(entry.totalAmount || 0)}
                  </span>
                  {entry.earnedPoints > 0 ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      +{entry.earnedPoints} pts
                    </span>
                  ) : null}
                  {entry.redeemedPoints > 0 ? (
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      -{entry.redeemedPoints} pts • {formatCurrency(entry.redeemedAmount || 0)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
