import { OnlineDriver } from '../useRealTimeTracking'


export function isDriverValid(driver: OnlineDriver): boolean {
  if (!driver.is_online) {
    return false
  }

  if (!driver.current_latitude || !driver.current_longitude) {
    return false
  }

  if (!driver.updated_at) {
    return false
  }

  const updatedAt = new Date(driver.updated_at)
  const diffInMinutes = (Date.now() - updatedAt.getTime()) / 60000
  return diffInMinutes <= 5
}

