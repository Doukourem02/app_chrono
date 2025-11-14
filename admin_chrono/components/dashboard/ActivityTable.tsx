'use client'

import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useState } from 'react'

interface ActivityData {
  deliveryId: string
  date: string
  departure: string
  destination: string
  status: 'on_progress' | 'pending' | 'delivered'
}

const mockData: ActivityData[] = [
  {
    deliveryId: 'CA-12321-ID',
    date: '12/11/2024',
    departure: 'California, US',
    destination: 'Jakarta, ID',
    status: 'on_progress',
  },
  {
    deliveryId: 'NY-12321-SF',
    date: '14/11/2024',
    departure: 'New York, US',
    destination: 'San Francisco, US',
    status: 'on_progress',
  },
  {
    deliveryId: 'CGK-12321-NY',
    date: '14/11/2024',
    departure: 'Jakarta, ID',
    destination: 'New York, US',
    status: 'pending',
  },
  {
    deliveryId: 'UK-12321-MLG',
    date: '18/11/2024',
    departure: 'London, UK',
    destination: 'Malang, ID',
    status: 'delivered',
  },
]

const statusConfig = {
  on_progress: {
    label: 'On Progress',
    className: 'bg-orange-100 text-orange-600',
  },
  pending: {
    label: 'Pending',
    className: 'bg-red-100 text-red-600',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-green-100 text-green-600',
  },
}

export default function ActivityTable() {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4
  const totalPages = Math.ceil(100 / itemsPerPage) // Mock: 100 total entries

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Activity Data</h2>
        <div className="flex items-center gap-3">
          <select className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>This week</option>
            <option>This month</option>
            <option>This year</option>
          </select>
          <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <Filter className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                Delivery ID
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                Date
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                Departure
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                Destination
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {mockData.map((row, index) => {
              const status = statusConfig[row.status]
              const isHighlighted = row.deliveryId === 'NY-12321-SF'

              return (
                <tr
                  key={index}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    isHighlighted ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="py-4 px-4">
                    <span className="text-sm font-semibold text-gray-900">{row.deliveryId}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-700">{row.date}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-700">{row.departure}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-700">{row.destination}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Showing 1 to {itemsPerPage} of 100 entries
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          {[1, 2, 3, 4].map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

