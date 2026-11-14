import {afterEach,describe,expect,it,vi} from 'vitest';
import {scheduleWait} from '../src/lib/wait-state.ts';

afterEach(()=>vi.useRealTimers());
describe('wait timing',()=>{
 it('shows the placeholder at 400 ms and the explanation at 2 seconds',()=>{
  vi.useFakeTimers();const change=vi.fn();const cancel=scheduleWait(change);
  vi.advanceTimersByTime(399);expect(change).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);expect(change).toHaveBeenLastCalledWith('placeholder');
  vi.advanceTimersByTime(1599);expect(change).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);expect(change).toHaveBeenLastCalledWith('long');cancel();
 });
 it('never flashes after a fast load or an interrupted wait',()=>{
  vi.useFakeTimers();const change=vi.fn();const cancel=scheduleWait(change);
  vi.advanceTimersByTime(250);cancel();vi.advanceTimersByTime(3000);expect(change).not.toHaveBeenCalled();
 });
});
