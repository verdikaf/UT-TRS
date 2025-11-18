import {
  computeOffsetMs,
  computeInitialSendTime,
  computeNextWeekly,
} from "../../../src/utils/scheduler.js";
import { jest } from '@jest/globals';

function freeze(date) {
  jest.useFakeTimers();
  jest.setSystemTime(date.getTime());
}

describe("scheduler utils", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("computeOffsetMs valid values", () => {
    expect(computeOffsetMs("3d")).toBe(3 * 24 * 60 * 60 * 1000);
    expect(computeOffsetMs("1d")).toBe(24 * 60 * 60 * 1000);
    expect(computeOffsetMs("3h")).toBe(3 * 60 * 60 * 1000);
  });

  test("computeOffsetMs invalid throws", () => {
    expect(() => computeOffsetMs("2d")).toThrow("Invalid reminderOffset");
  });

  test("computeInitialSendTime once future deadline", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    freeze(now);
    const deadline = new Date("2025-01-05T00:00:00Z");
    const { sendAt, normalizedDeadline } = computeInitialSendTime(
      deadline,
      "3d",
      "once"
    );
    // 3 days before deadline
    expect(sendAt.toISOString()).toBe("2025-01-02T00:00:00.000Z");
    expect(normalizedDeadline.toISOString()).toBe(deadline.toISOString());
  });

  test("computeInitialSendTime once past offset schedules +60s", () => {
    const now = new Date("2025-01-04T23:59:30Z");
    freeze(now);
    const deadline = new Date("2025-01-05T00:00:00Z");
    const { sendAt } = computeInitialSendTime(deadline, "3h", "once");
    // Past offset => sendAt ~ now + 60s
    expect(sendAt.getTime()).toBe(now.getTime() + 60 * 1000);
  });

  test("computeInitialSendTime weekly advances until future and respects endDate", () => {
    const now = new Date("2025-01-10T00:00:00Z");
    freeze(now);
    const startDeadline = new Date("2025-01-01T00:00:00Z");
    const endDate = new Date("2025-02-01T00:00:00Z");
    const { sendAt, normalizedDeadline } = computeInitialSendTime(
      startDeadline,
      "3d",
      "weekly",
      { endDate }
    );
    expect(sendAt > now).toBe(true);
    expect(normalizedDeadline > startDeadline).toBe(true);
  });

  test("computeInitialSendTime weekly returns null when beyond endDate", () => {
    const now = new Date("2025-03-10T00:00:00Z");
    freeze(now);
    const startDeadline = new Date("2025-02-01T00:00:00Z");
    const endDate = new Date("2025-02-05T00:00:00Z");
    const { sendAt } = computeInitialSendTime(startDeadline, "3d", "weekly", {
      endDate,
    });
    expect(sendAt).toBeNull();
  });

  test("computeNextWeekly normal case", () => {
    const deadline = new Date("2025-01-01T00:00:00Z");
    const { nextDeadline, sendAt } = computeNextWeekly(deadline, "1d");
    expect(nextDeadline.toISOString()).toBe("2025-01-08T00:00:00.000Z");
    expect(sendAt.toISOString()).toBe("2025-01-07T00:00:00.000Z");
  });

  test("computeNextWeekly beyond endDate", () => {
    const deadline = new Date("2025-01-25T00:00:00Z");
    const endDate = new Date("2025-01-28T00:00:00Z");
    const { nextDeadline, sendAt } = computeNextWeekly(deadline, "3h", endDate);
    expect(nextDeadline).toBeNull();
    expect(sendAt).toBeNull();
  });
});
