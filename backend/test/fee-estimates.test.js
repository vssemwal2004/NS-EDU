import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_PEERS, buildGroups, indexGroups, pickEstimate, quantile, roundFee, summarise } from '../src/modules/universities/fee-estimates.js';

const inst = (slug, city, state, ownership, rows) => ({ slug, city, state, ownership, programmesOffered: rows });
const btech = (field, value) => ({ courseSlug: 'btech', [field]: value });

describe('fee estimates', () => {
  test('percentiles and rounding never look more exact than the data', () => {
    assert.equal(quantile([10, 20, 30, 40], 0.5), 25);
    assert.equal(roundFee(123_456), 125_000);
    assert.equal(roundFee(48_700), 49_000);
    assert.equal(roundFee(1_240_000), 1_250_000);
    assert.equal(summarise([100_000, 120_000, 140_000, 160_000]), null, `needs ${MIN_PEERS} published peers`);
    const range = summarise([100_000, 110_000, 120_000, 130_000, 400_000]);
    assert.deepEqual([range.low, range.high, range.sample], [110_000, 130_000, 5], 'the outlier does not widen the range');
    assert.equal(summarise([90_000, 100_000, 1_000_000, 1_500_000, 2_000_000]), null, 'a range this wide (government and private mixed) is not shown');
  });

  test('uses the narrowest area with enough published peers, and the same fee period only', () => {
    const doon = [1, 2, 3, 4, 5].map((n) => inst(`d${n}`, 'Dehradun', 'Uttarakhand', 'private', [btech('annualFeeInr', 100_000 + n * 10_000)]));
    const haridwar = [1, 2, 3, 4, 5].map((n) => inst(`h${n}`, 'Haridwar', 'Uttarakhand', 'private', [btech('annualFeeInr', 70_000 + n * 10_000)]));
    // A semester fee must never be folded into the annual range.
    const semester = [1, 2, 3, 4, 5, 6].map((n) => inst(`s${n}`, 'Dehradun', 'Uttarakhand', 'private', [btech('semesterFeeInr', 60_000)]));
    const index = indexGroups(buildGroups([...doon, ...haridwar, ...semester.slice(0, 3)]));

    const unpriced = { courseSlug: 'btech', name: 'B.Tech' };
    const inDehradun = pickEstimate({ city: 'Dehradun', state: 'Uttarakhand', ownership: 'private' }, unpriced, index);
    assert.equal(inDehradun.scope, 'Dehradun');
    assert.equal(inDehradun.period, 'a year');
    assert.deepEqual([inDehradun.low, inDehradun.high, inDehradun.sample], [120_000, 140_000, 5]);

    const inRoorkee = pickEstimate({ city: 'Roorkee', state: 'Uttarakhand', ownership: 'private' }, unpriced, index);
    assert.equal(inRoorkee.scope, 'Uttarakhand', 'no city peers, so the state is used');
    assert.equal(inRoorkee.sample, 10);

    const elsewhere = pickEstimate({ city: 'Pune', state: 'Maharashtra', ownership: 'private' }, unpriced, index);
    assert.equal(elsewhere.scope, 'India');
  });

  test('keeps public and private apart, never estimates over a published fee, and needs a catalogue course', () => {
    const publicOnes = [1, 2, 3, 4, 5].map((n) => inst(`p${n}`, 'Dehradun', 'Uttarakhand', 'public', [btech('annualFeeInr', 20_000 + n * 1_000)]));
    const index = indexGroups(buildGroups(publicOnes));
    const row = { courseSlug: 'btech', name: 'B.Tech' };
    assert.ok(pickEstimate({ city: 'Dehradun', state: 'Uttarakhand', ownership: 'public' }, row, index));
    assert.equal(pickEstimate({ city: 'Dehradun', state: 'Uttarakhand', ownership: 'private' }, row, index), null, 'public fees do not describe a private college');
    assert.equal(pickEstimate({ city: 'Dehradun', state: 'Uttarakhand', ownership: 'public' }, { ...row, annualFeeInr: 90_000 }, index), null);
    assert.equal(pickEstimate({ city: 'Dehradun', state: 'Uttarakhand', ownership: 'public' }, { name: 'Unlinked' }, index), null);
  });

  test('one institution counts once per course however many branches it lists', () => {
    const many = inst('big', 'Dehradun', 'Uttarakhand', 'private', Array.from({ length: 40 }, () => btech('annualFeeInr', 500_000)));
    const others = [1, 2, 3, 4].map((n) => inst(`o${n}`, 'Dehradun', 'Uttarakhand', 'private', [btech('annualFeeInr', 100_000)]));
    const city = buildGroups([many, ...others]).find((group) => group.scope === 'city' && group.ownership === 'private');
    assert.equal(city.sample, 5);
    assert.equal(city.median, 100_000);
  });
});
