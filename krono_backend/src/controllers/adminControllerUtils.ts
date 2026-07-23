import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { isTwilioSmsConfigured, sendTransactionalSMSTwilio } from '../services/twilioSmsService.js';
import { publicTrackPageBaseUrl } from '../services/recipientOrderNotifyService.js';

export const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const liveOrderStatuses = `'pending', 'accepted', 'enroute', 'in_progress', 'picked_up', 'delivering'`;
export const staleLiveOrderCondition = `(o.status IN (${liveOrderStatuses}) AND o.created_at < CURRENT_DATE)`;
export const inactiveOrderCondition = `(o.status IN ('cancelled', 'declined') OR ${staleLiveOrderCondition})`;
export const activeOrderCondition = `(o.id IS NULL OR (o.status NOT IN ('cancelled', 'declined') AND NOT ${staleLiveOrderCondition}))`;
export const liveOrderCondition = `(o.status IN (${liveOrderStatuses}) AND o.created_at >= CURRENT_DATE)`;
export const orderLossDateExpression = `CASE WHEN ${staleLiveOrderCondition} THEN o.created_at ELSE COALESCE(o.cancelled_at, o.created_at) END`;
export const effectiveOrderStatusExpression = `CASE WHEN ${staleLiveOrderCondition} THEN 'cancelled' ELSE o.status END`;
export const effectivePaymentStatusExpression = `CASE
  WHEN ${inactiveOrderCondition} OR t.status IN ('cancelled', 'refunded') THEN 'cancelled'
  WHEN t.payment_method_type = 'deferred' AND t.status IN ('pending', 'delayed') THEN 'delayed'
  WHEN t.payment_method_type = 'cash' AND t.status = 'pending' AND (o.status = 'completed' OR t.created_at < CURRENT_DATE) THEN 'paid'
  WHEN t.status = 'pending' AND t.created_at < CURRENT_DATE THEN 'cancelled'
  ELSE t.status
END`;

export const normalizeDate = (date: Date, endOfDay = false): Date => {
  const normalized = new Date(date);
  if (endOfDay) {
    normalized.setHours(23, 59, 59, 999);
  } else {
    normalized.setHours(0, 0, 0, 0);
  }
  return normalized;
};

export const parseDateParam = (value?: string, endOfDay = false): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return normalizeDate(parsed, endOfDay);
};

export function isUsableLatLon(value: any): value is { latitude: number; longitude: number } {
  return (
    value &&
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180 &&
    !(value.latitude === 0 && value.longitude === 0)
  );
}

export function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type DeliveryCodeSmsStatus =
  | { status: 'not_attempted'; reason: string }
  | { status: 'sent'; messageId?: string }
  | { status: 'failed'; error?: string };

export async function sendAdminOrderDeliveryCodeSms(params: {
  phone: string;
  verificationCode: string;
  orderId: string;
  trackingToken?: string | null;
}): Promise<DeliveryCodeSmsStatus> {
  const phone = params.phone.trim();
  if (!phone) {
    return { status: 'not_attempted', reason: 'recipient_phone_missing' };
  }
  if (!params.verificationCode) {
    return { status: 'not_attempted', reason: 'verification_code_missing' };
  }
  if (!isTwilioSmsConfigured()) {
    return { status: 'not_attempted', reason: 'sms_not_configured' };
  }

  const brand = process.env.TWILIO_SMS_BODY_BRAND?.trim() || 'Krono';
  const orderLabel = `CMD-${params.orderId.substring(0, 8).toUpperCase()}`;
  let body =
    `${brand} - code de livraison ${orderLabel}: ${params.verificationCode}. ` +
    'Donnez ce code uniquement au livreur Krono quand vous recevez le colis.';

  const trackBase = publicTrackPageBaseUrl();
  if (params.trackingToken && trackBase) {
    body += ` Suivi: ${trackBase}/track/${encodeURIComponent(params.trackingToken)}`;
  }

  const result = await sendTransactionalSMSTwilio(phone, body);
  if (result.success) {
    return { status: 'sent', messageId: result.messageId };
  }

  return { status: 'failed', error: result.error };
}

export const getDateRange = (startParam?: string, endParam?: string) => {
  const now = new Date();
  let rangeStart = parseDateParam(startParam) ?? normalizeDate(new Date(now.getFullYear(), now.getMonth(), 1));
  let rangeEnd = parseDateParam(endParam, true) ?? normalizeDate(now, true);

  if (rangeStart > rangeEnd) {
    const tmp = rangeStart;
    rangeStart = normalizeDate(rangeEnd);
    rangeEnd = normalizeDate(tmp, true);
  }

  const duration = Math.max(rangeEnd.getTime() - rangeStart.getTime(), DAY_IN_MS);
  const previousEnd = normalizeDate(new Date(rangeStart.getTime() - 1), true);
  const previousStart = normalizeDate(new Date(previousEnd.getTime() - duration));

  return { rangeStart, rangeEnd, previousStart, previousEnd, duration };
};
