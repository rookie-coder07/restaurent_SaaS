import { jest } from '@jest/globals';
import supabase from '../src/config/supabase.js';
import AnalyticsService from '../src/services/analyticsService.js';
import { composeNotesWithKotMeta } from '../src/utils/kotMetadata.js';

describe('AnalyticsService loyalty tenancy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getLoyaltySummary scopes members and activity to the current restaurant', async () => {
    const orderRows = [
      {
        id: 'order-1',
        created_at: '2026-04-05T09:00:00.000Z',
        total_amount: 500,
        status: 'completed',
        payment_status: 'paid',
        notes: composeNotesWithKotMeta('', {
          loyalty: {
            customerPhone: '9876543210',
            earnedPoints: 5,
            redeemedPoints: 1,
            redeemedAmount: 1,
          },
        }),
      },
      {
        id: 'order-2',
        created_at: '2026-04-04T09:00:00.000Z',
        total_amount: 200,
        status: 'completed',
        payment_status: 'paid',
        notes: composeNotesWithKotMeta('', {
          loyalty: {
            customerPhone: '9876543210',
            earnedPoints: 2,
            redeemedPoints: 0,
            redeemedAmount: 0,
          },
        }),
      },
      {
        id: 'order-3',
        created_at: '2026-04-03T09:00:00.000Z',
        total_amount: 300,
        status: 'completed',
        payment_status: 'paid',
        notes: composeNotesWithKotMeta('', {
          loyalty: {
            customerPhone: '8888888888',
            earnedPoints: 3,
            redeemedPoints: 0,
            redeemedAmount: 0,
          },
        }),
      },
    ];

    const orderBy = jest.fn().mockResolvedValue({ data: orderRows, error: null });
    const or = jest.fn(() => ({ order: orderBy }));
    const eq = jest.fn(() => ({ or }));
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn(() => ({ eq })),
    });

    const summary = await AnalyticsService.getLoyaltySummary('rest-tenant-a');

    expect(eq).toHaveBeenCalledWith('restaurant_id', 'rest-tenant-a');
    expect(summary.summary.activeMembers).toBe(2);
    expect(summary.summary.repeatCustomers).toBe(1);
    expect(summary.summary.totalPointsIssued).toBe(10);
    expect(summary.summary.totalRedeemedPoints).toBe(1);
    expect(summary.summary.totalRedeemedAmount).toBe(1);
    expect(summary.topMembers[0]).toMatchObject({
      customerPhone: '9876543210',
      pointsBalance: 6,
      visitCount: 2,
    });
    expect(summary.recentActivity.every((entry) => ['9876543210', '8888888888'].includes(entry.customerPhone))).toBe(true);
  });
});
