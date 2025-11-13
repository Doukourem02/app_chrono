export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') {
    return '***';
  }

  const [name, domain] = email.split('@');

  if (!domain) {
    return name.length > 2 ? name.substring(0, 2) + '***' : '***';
  }

  const maskedName = name.length > 2 ? name.substring(0, 2) + '***' : '***';
  return `${maskedName}@${domain}`;
}

export function maskToken(token: string | null | undefined): string {
  if (!token || typeof token !== 'string' || token.length < 10) {
    return '***';
  }

  return token.substring(0, 6) + '***' + token.substring(token.length - 4);
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') {
    return '***';
  }

  const cleaned = phone.replace(/\s/g, '');

  if (cleaned.length < 6) {
    return '***';
  }

  return cleaned.substring(0, 4) + '***' + cleaned.substring(cleaned.length - 2);
}

export function maskPhoneNumber(phone: string | null | undefined): string {
  return maskPhone(phone);
}

export function maskPassword(password: string | null | undefined): string {
  if (!password) {
    return '***';
  }

  return '***' + password.length + ' chars';
}

export function maskUserId(userId: string | null | undefined): string {
  if (!userId || typeof userId !== 'string') {
    return '***';
  }

  if (userId.length < 8) {
    return '***';
  }

  return userId.substring(0, 4) + '***' + userId.substring(userId.length - 4);
}

export function maskIP(ip: string | null | undefined): string {
  if (!ip || typeof ip !== 'string') {
    return '***';
  }

  const parts = ip.split('.');

  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  const parts6 = ip.split(':');

  if (parts6.length > 4) {
    return parts6.slice(0, 2).join(':') + ':***:***';
  }

  return '***';
}

export function maskAmount(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined) {
    return '***';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '***';
  }

  return '*** FCFA';
}

export function maskOrderId(orderId: string | null | undefined): string {
  if (!orderId || typeof orderId !== 'string') {
    return '***';
  }

  if (orderId.length < 8) {
    return '***';
  }

  return orderId.substring(0, 4) + '***' + orderId.substring(orderId.length - 4);
}

export function maskFinancialStats(stats: {
  totalEarnings?: number;
  totalDeliveries?: number;
  averageEarningPerDelivery?: number;
  [key: string]: any;
}): Record<string, any> {
  const masked: any = { ...stats };

  if (masked.totalEarnings !== undefined) {
    masked.totalEarnings = '***';
  }

  if (masked.averageEarningPerDelivery !== undefined) {
    masked.averageEarningPerDelivery = '***';
  }

  if (masked.earningsByMethod) {
    masked.earningsByMethod = {
      moto: '***',
      vehicule: '***',
      cargo: '***',
    };
  }

  if (masked.earningsByDay) {
    masked.earningsByDay = '***';
  }

  return masked;
}

export function sanitizeObject(
  obj: Record<string, any>
): Record<string, any> {
  const sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'email',
    'phone',
    'userId',
    'user_id',
    'driver_id',
    'price',
    'price_cfa',
    'totalEarnings',
    'earnings',
  ];

  const sanitized = { ...obj };

  for (const field of sensitiveFields) {
    if (sanitized[field] !== undefined) {
      if (field === 'email') {
        sanitized[field] = maskEmail(sanitized[field]);
      } else if (field === 'phone') {
        sanitized[field] = maskPhone(sanitized[field]);
      } else if (field.includes('token') || field.includes('Token')) {
        sanitized[field] = maskToken(sanitized[field]);
      } else if (field === 'password') {
        sanitized[field] = maskPassword(sanitized[field]);
      } else if (
        field === 'userId' ||
        field === 'user_id' ||
        field === 'driver_id'
      ) {
        sanitized[field] = maskUserId(sanitized[field]);
      } else if (
        field === 'price' ||
        field === 'price_cfa' ||
        field.includes('Earnings') ||
        field.includes('earnings')
      ) {
        sanitized[field] = maskAmount(sanitized[field]);
      } else {
        sanitized[field] = '***';
      }
    }
  }

  return sanitized;
}
